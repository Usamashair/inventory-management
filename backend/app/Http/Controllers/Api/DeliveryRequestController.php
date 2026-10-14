<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryRequest;
use App\Models\DeliveryRequestItem;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Support\PortalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeliveryRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = DeliveryRequest::query()
            ->with(['items.product', 'warehouse', 'customer'])
            ->latest();

        if (! $request->user()->isStaffOrAdmin()) {
            $query->where('customer_id', $request->user()->id);
        }

        $data = $query->get()->map(fn (DeliveryRequest $requestModel) => $this->format($requestModel));

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isCustomer() || $request->user()->isStaffOrAdmin(), 403);

        $validated = $request->validate([
            'warehouseId' => ['required', 'integer', 'exists:warehouses,id'],
            'warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'deliveryAddress' => ['nullable', 'string'],
            'delivery_address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.productId' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
        ]);

        $customerId = $request->user()->isStaffOrAdmin()
            ? (int) $request->input('customerId', $request->user()->id)
            : (int) $request->user()->id;

        $warehouseId = (int) ($validated['warehouseId'] ?? $validated['warehouse_id']);
        $address = $validated['deliveryAddress'] ?? $validated['delivery_address'] ?? null;

        if (! $address) {
            $user = $request->user();
            $address = trim(collect([$user->address, $user->city, $user->post_code])->filter()->implode(', '));
        }

        if ($address === '') {
            throw ValidationException::withMessages([
                'deliveryAddress' => ['Delivery address is required.'],
            ]);
        }

        $deliveryRequest = DB::transaction(function () use ($validated, $customerId, $warehouseId, $address, $request) {
            foreach ($validated['items'] as $item) {
                $productId = (int) ($item['productId'] ?? $item['product_id']);
                $qty = (float) $item['quantity'];

                $stock = WarehouseStock::query()->where([
                    'warehouse_id' => $warehouseId,
                    'customer_id' => $customerId,
                    'product_id' => $productId,
                ])->first();

                if (! $stock || (float) $stock->quantity < $qty) {
                    throw ValidationException::withMessages([
                        'items' => ["Insufficient stock for product #{$productId} in this warehouse."],
                    ]);
                }
            }

            $model = DeliveryRequest::query()->create([
                'request_id' => '#DR-'.now()->format('ymdHis'),
                'customer_id' => $customerId,
                'warehouse_id' => $warehouseId,
                'delivery_address' => $address,
                'status' => 'pending',
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($validated['items'] as $item) {
                $model->items()->create([
                    'product_id' => $item['productId'] ?? $item['product_id'],
                    'quantity' => $item['quantity'],
                ]);
            }

            return $model->fresh()->load(['items.product', 'warehouse', 'customer']);
        });

        $label = $deliveryRequest->request_id ?: '#'.$deliveryRequest->id;
        $customerName = $deliveryRequest->customer?->name ?: 'Customer';
        PortalNotifier::notifyStaff(
            'calloff.created',
            'call-off',
            'Call-off requested',
            "{$customerName} submitted call-off {$label}.",
            '/dashboard/call-offs',
            $deliveryRequest,
            exceptUserId: (int) $request->user()->id,
        );

        return response()->json([
            'message' => 'Delivery request submitted.',
            'data' => $this->format($deliveryRequest),
        ], 201);
    }

    public function show(Request $request, DeliveryRequest $deliveryRequest): JsonResponse
    {
        $this->authorizeAccess($request, $deliveryRequest);

        return response()->json([
            'data' => $this->format($deliveryRequest->load(['items.product', 'warehouse', 'customer'])),
        ]);
    }

    public function fulfill(Request $request, DeliveryRequest $deliveryRequest): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        abort_unless($deliveryRequest->status === 'pending', 422, 'Request is not pending.');

        $deliveryRequest = DB::transaction(function () use ($deliveryRequest, $request) {
            $deliveryRequest->load('items');

            foreach ($deliveryRequest->items as $item) {
                WarehouseStock::deduct(
                    (int) $deliveryRequest->warehouse_id,
                    (int) $deliveryRequest->customer_id,
                    (int) $item->product_id,
                    (float) $item->quantity
                );
            }

            $deliveryRequest->update([
                'status' => 'fulfilled',
                'fulfilled_by' => $request->user()->id,
                'fulfilled_at' => now(),
            ]);

            return $deliveryRequest->fresh()->load(['items.product', 'warehouse', 'customer']);
        });

        $label = $deliveryRequest->request_id ?: '#'.$deliveryRequest->id;
        PortalNotifier::notifyCustomer(
            (int) $deliveryRequest->customer_id,
            'calloff.fulfilled',
            'call-off',
            'Call-off fulfilled',
            "Your call-off {$label} has been fulfilled.",
            '/dashboard/call-offs',
            $deliveryRequest,
        );
        PortalNotifier::notifyStaff(
            'calloff.fulfilled',
            'call-off',
            'Call-off fulfilled',
            "{$label} was fulfilled.",
            '/dashboard/call-offs',
            $deliveryRequest,
            exceptUserId: (int) $request->user()->id,
        );

        return response()->json([
            'message' => 'Delivery request fulfilled. Stock deducted.',
            'data' => $this->format($deliveryRequest),
        ]);
    }

    public function reject(Request $request, DeliveryRequest $deliveryRequest): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        abort_unless($deliveryRequest->status === 'pending', 422, 'Request is not pending.');

        $deliveryRequest->update(['status' => 'rejected']);
        $deliveryRequest = $deliveryRequest->fresh()->load(['items.product', 'warehouse', 'customer']);

        $label = $deliveryRequest->request_id ?: '#'.$deliveryRequest->id;
        PortalNotifier::notifyCustomer(
            (int) $deliveryRequest->customer_id,
            'calloff.rejected',
            'call-off',
            'Call-off rejected',
            "Your call-off {$label} was rejected.",
            '/dashboard/call-offs',
            $deliveryRequest,
        );
        PortalNotifier::notifyStaff(
            'calloff.rejected',
            'call-off',
            'Call-off rejected',
            "{$label} was rejected.",
            '/dashboard/call-offs',
            $deliveryRequest,
            exceptUserId: (int) $request->user()->id,
        );

        return response()->json([
            'message' => 'Delivery request rejected.',
            'data' => $this->format($deliveryRequest),
        ]);
    }

    private function authorizeAccess(Request $request, DeliveryRequest $deliveryRequest): void
    {
        if ($request->user()->isStaffOrAdmin()) {
            return;
        }

        abort_unless((int) $deliveryRequest->customer_id === (int) $request->user()->id, 403);
    }

    private function format(DeliveryRequest $deliveryRequest): array
    {
        return [
            'id' => (string) $deliveryRequest->id,
            'requestId' => $deliveryRequest->request_id,
            'customerId' => $deliveryRequest->customer_id,
            'customer' => $deliveryRequest->customer?->name ?? '',
            'warehouseId' => $deliveryRequest->warehouse_id,
            'warehouse' => $deliveryRequest->warehouse?->name ?? '',
            'deliveryAddress' => $deliveryRequest->delivery_address,
            'status' => $deliveryRequest->status,
            'notes' => $deliveryRequest->notes ?? '',
            'fulfilledAt' => $deliveryRequest->fulfilled_at?->toDateTimeString(),
            'items' => $deliveryRequest->items->map(fn (DeliveryRequestItem $item) => [
                'id' => (string) $item->id,
                'productId' => $item->product_id,
                'product' => $item->product?->product ?? '',
                'sku' => $item->product?->sku ?? '',
                'quantity' => number_format((float) $item->quantity, 2, '.', ''),
            ])->values()->all(),
        ];
    }
}
