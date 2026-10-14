<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quotation;
use App\Models\User;
use App\Models\Warehouse;
use App\Support\DocumentNumber;
use App\Support\MailConfig;
use App\Support\PortalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class QuotationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Quotation::query()
            ->with(['productRelation', 'customer', 'order', 'items.product', 'items.warehouse'])
            ->latest();

        if (! $request->user()->isStaffOrAdmin()) {
            $query->where('customer_id', $request->user()->id);
        }

        $quotations = $query->get()->map(fn (Quotation $quotation) => $this->format($quotation));

        return response()->json(['data' => $quotations]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403, 'Only admin or staff can create quotations.');

        $payload = $this->validated($request);

        $quotation = DB::transaction(function () use ($request, $payload) {
            $items = $payload['items'] ?? null;
            unset($payload['items']);

            $payload['user_id'] = $request->user()->id;
            $payload['quote_id'] = $payload['quote_id'] ?? DocumentNumber::next('QT');
            $payload['date'] = $payload['date'] ?? now()->format('M d, Y');
            $payload['status'] = $payload['status'] ?? 'draft';

            if (! isset($payload['value']) && isset($payload['quantity'], $payload['unit_price'])) {
                $payload['value'] = $this->calculateValue($payload['quantity'], $payload['unit_price']);
            }

            $quotation = Quotation::query()->create($payload);

            if (is_array($items) && count($items) > 0) {
                $this->syncItems($quotation, $items);
            } elseif (! empty($payload['product_id'])) {
                $this->ensureLegacyItem($quotation);
            }

            return $quotation->fresh()->load(['productRelation', 'customer', 'order', 'items.product', 'items.warehouse']);
        });

        return response()->json([
            'message' => 'Quotation created successfully.',
            'data' => $this->format($quotation),
        ], 201);
    }

    public function show(Request $request, Quotation $quotation): JsonResponse
    {
        $this->authorizeAccess($request, $quotation);

        return response()->json([
            'data' => $this->format(
                $quotation->load(['productRelation', 'customer', 'order', 'items.product', 'items.warehouse'])
            ),
        ]);
    }

    public function update(Request $request, Quotation $quotation): JsonResponse
    {
        $this->authorizeAccess($request, $quotation);
        abort_unless($request->user()->isStaffOrAdmin(), 403, 'Only admin or staff can edit quotations.');
        abort_if(
            $quotation->order()->exists(),
            422,
            'This quotation already has an order and can no longer be edited.'
        );

        $payload = $this->validated($request, true);

        $quotation = DB::transaction(function () use ($quotation, $payload) {
            $items = $payload['items'] ?? null;
            unset($payload['items']);

            if (isset($payload['quantity']) || isset($payload['unit_price'])) {
                $payload['value'] = $payload['value']
                    ?? $this->calculateValue(
                        $payload['quantity'] ?? $quotation->quantity,
                        $payload['unit_price'] ?? $quotation->unit_price
                    );
            }

            if (! empty($payload)) {
                $quotation->update($payload);
            }

            if (is_array($items)) {
                $this->syncItems($quotation, $items);
            }

            return $quotation->fresh()->load(['productRelation', 'customer', 'order', 'items.product', 'items.warehouse']);
        });

        return response()->json([
            'message' => 'Quotation updated successfully.',
            'data' => $this->format($quotation),
        ]);
    }

    public function destroy(Request $request, Quotation $quotation): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        $this->authorizeAccess($request, $quotation);
        abort_if(
            $quotation->order()->exists(),
            422,
            'This quotation already has an order and cannot be deleted.'
        );
        $quotation->delete();

        return response()->json(['message' => 'Quotation deleted successfully.']);
    }

    public function send(Request $request, Quotation $quotation): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        abort_unless($quotation->customer_id, 422, 'Quotation must have a customer before sending.');
        abort_unless(
            in_array($quotation->status, ['draft', 'under-review', 'sent'], true),
            422,
            'This quotation cannot be sent in its current status.'
        );

        $quotation->update(['status' => 'sent']);
        $quotation = $quotation->fresh()->load(['productRelation', 'customer', 'order', 'items.product', 'items.warehouse']);

        $label = $quotation->quote_id ?: '#'.$quotation->id;
        PortalNotifier::notifyCustomer(
            (int) $quotation->customer_id,
            'quotation.sent',
            'quotation',
            'Quotation sent',
            "{$label} has been sent for your review.",
            '/dashboard/quotations/'.$quotation->id,
            $quotation,
        );
        PortalNotifier::notifyStaff(
            'quotation.sent',
            'quotation',
            'Quotation sent',
            "{$label} was sent to ".($quotation->customer?->name ?: 'customer').'.',
            '/dashboard/quotations/'.$quotation->id,
            $quotation,
            exceptUserId: (int) $request->user()->id,
        );

        $emailNote = '';
        if (MailConfig::canSend() && $quotation->customer?->email) {
            try {
                MailConfig::apply();
                $customerEmail = $quotation->customer->email;
                $customerName = $quotation->customer->name ?: 'Customer';
                Mail::raw(
                    "Hello {$customerName},\n\nQuotation {$label} has been sent for your review in the Rexapack portal.\n\nOpen: ".rtrim((string) config('app.frontend_url', config('app.url')), '/').'/dashboard/quotations/'.$quotation->id."\n\nThank you,\nRexapack",
                    function ($message) use ($customerEmail, $customerName, $label) {
                        $message->to($customerEmail, $customerName)
                            ->subject("Quotation {$label} ready for review");
                    }
                );
                $emailNote = ' Email notification sent.';
            } catch (\Throwable $error) {
                $emailNote = ' Portal updated, but email failed: '.$error->getMessage();
            }
        }

        return response()->json([
            'message' => 'Quotation sent to customer.'.$emailNote,
            'data' => $this->format($quotation),
        ]);
    }

    public function reject(Request $request, Quotation $quotation): JsonResponse
    {
        $this->authorizeCustomerAction($request, $quotation);
        abort_unless(in_array($quotation->status, ['sent', 'under-review'], true), 422, 'Quotation cannot be rejected in its current status.');

        $quotation->update(['status' => 'rejected']);
        $quotation = $quotation->fresh()->load(['productRelation', 'customer', 'order', 'items.product', 'items.warehouse']);

        $label = $quotation->quote_id ?: '#'.$quotation->id;
        PortalNotifier::notifyStaff(
            'quotation.rejected',
            'quotation',
            'Quotation rejected',
            "{$label} was rejected by ".($quotation->customer?->name ?: 'the customer').'.',
            '/dashboard/quotations/'.$quotation->id,
            $quotation,
        );

        return response()->json([
            'message' => 'Quotation rejected.',
            'data' => $this->format($quotation),
        ]);
    }

    public function approve(Request $request, Quotation $quotation): JsonResponse
    {
        $this->authorizeCustomerAction($request, $quotation);
        abort_unless(in_array($quotation->status, ['sent', 'under-review'], true), 422, 'Quotation cannot be approved in its current status.');
        abort_unless(! $quotation->order()->exists(), 422, 'Quotation already converted to an order.');

        $validated = $request->validate([
            'deliveryType' => ['required', 'string', 'in:warehouse,customer_address'],
            'delivery_type' => ['nullable', 'string', 'in:warehouse,customer_address'],
            'deliveryWarehouseId' => ['nullable', 'integer', 'exists:warehouses,id'],
            'delivery_warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'deliveryAddress' => ['nullable', 'string'],
            'delivery_address' => ['nullable', 'string'],
        ]);

        $deliveryType = $validated['deliveryType'] ?? $validated['delivery_type'];
        $warehouseId = $validated['deliveryWarehouseId'] ?? $validated['delivery_warehouse_id'] ?? null;
        $deliveryAddress = $validated['deliveryAddress'] ?? $validated['delivery_address'] ?? null;

        if ($deliveryType === 'warehouse') {
            if (! $warehouseId) {
                throw ValidationException::withMessages([
                    'deliveryWarehouseId' => ['Please select a warehouse.'],
                ]);
            }
            $warehouse = Warehouse::query()->findOrFail($warehouseId);
            $deliveryAddress = $warehouse->name;
        } else {
            $customer = User::query()->findOrFail($quotation->customer_id);
            $deliveryAddress = $deliveryAddress ?: trim(collect([
                $customer->address,
                $customer->city,
                $customer->post_code,
            ])->filter()->implode(', '));

            if ($deliveryAddress === '') {
                throw ValidationException::withMessages([
                    'deliveryAddress' => ['Customer address is missing. Please update your profile address.'],
                ]);
            }
            $warehouseId = null;
        }

        $order = DB::transaction(function () use ($quotation, $deliveryType, $warehouseId, $deliveryAddress, $request) {
            $quotation->load(['items.product', 'items.warehouse', 'productRelation']);

            $lineItems = $quotation->items;
            if ($lineItems->isEmpty() && $quotation->product_id) {
                $product = $quotation->productRelation;
                $qty = $quotation->quantity ?? '1';
                $price = (float) preg_replace('/[^0-9.]/', '', (string) ($quotation->unit_price ?? $product?->price ?? 0));
                $qtyNum = (float) preg_replace('/[^0-9.]/', '', (string) $qty);
                $lineItems = collect([(object) [
                    'product_id' => $quotation->product_id,
                    'qty' => $qty,
                    'price' => $price,
                    'sub_total' => round($qtyNum * $price, 2),
                    'warehouse_id' => $product?->warehouse_id,
                    'product' => $product,
                ]]);
            }

            $total = round((float) $lineItems->sum(fn ($item) => (float) ($item->sub_total ?? 0)), 2);
            $productNames = $lineItems
                ->map(fn ($item) => $item->product?->product ?? null)
                ->filter()
                ->unique()
                ->values();

            $order = Order::query()->create([
                'order_id' => DocumentNumber::next('ORD'),
                'date' => now()->format('M d, Y'),
                'customer_id' => $quotation->customer_id,
                'user_id' => $request->user()->id,
                'quotation_id' => $quotation->id,
                'status' => Order::STATUS_WAITING_FOR_ARTWORK,
                'delivery_type' => $deliveryType,
                'delivery_warehouse_id' => $warehouseId,
                'delivery_address' => $deliveryAddress,
                'product' => $productNames->implode(', ') ?: ($quotation->product ?? ''),
                'total' => $total,
                'value' => '$'.number_format($total, 2),
                'warehouse_location' => $deliveryType === 'warehouse'
                    ? (Warehouse::query()->find($warehouseId)?->name ?? '')
                    : 'Customer address',
                'notes' => $quotation->notes,
            ]);

            foreach ($lineItems as $item) {
                if (! $item->product_id) {
                    continue;
                }

                $order->items()->create([
                    'product_id' => $item->product_id,
                    'qty' => $item->qty,
                    'price' => $item->price,
                    'sub_total' => $item->sub_total,
                    'warehouse_id' => $deliveryType === 'warehouse'
                        ? $warehouseId
                        : ($item->warehouse_id ?? null),
                ]);
            }

            $quotation->update(['status' => 'approved']);

            return $order->fresh()->load(['items.product', 'items.warehouse', 'customer', 'deliveryWarehouse']);
        });

        $freshQuote = $quotation->fresh()->load(['productRelation', 'customer', 'order', 'items.product', 'items.warehouse']);
        $quoteLabel = $freshQuote->quote_id ?: '#'.$freshQuote->id;
        $orderLabel = $order->order_id ?: '#'.$order->id;
        $customerName = $freshQuote->customer?->name ?: 'Customer';

        PortalNotifier::notifyStaff(
            'quotation.approved',
            'quotation',
            'Quotation approved',
            "{$quoteLabel} was approved by {$customerName}. Order {$orderLabel} created — waiting for artwork.",
            '/dashboard/orders/'.$order->id,
            $freshQuote,
        );
        PortalNotifier::notifyStaff(
            'order.created',
            'order',
            'Order created',
            "{$orderLabel} was created from {$quoteLabel} and is waiting for artwork.",
            '/dashboard/orders/'.$order->id,
            $order,
        );
        PortalNotifier::notifyCustomer(
            (int) $order->customer_id,
            'order.created',
            'order',
            'Order created',
            "Your order {$orderLabel} was created. Please upload artwork to continue.",
            '/dashboard/orders/'.$order->id,
            $order,
        );

        return response()->json([
            'message' => 'Quotation approved and converted to order. Waiting for artwork.',
            'data' => [
                'quotation' => $this->format($freshQuote),
                'order' => [
                    'id' => (string) $order->id,
                    'orderId' => $order->order_id,
                    'status' => $order->status,
                    'deliveryType' => $order->delivery_type,
                    'deliveryWarehouseId' => $order->delivery_warehouse_id,
                    'deliveryAddress' => $order->delivery_address,
                ],
            ],
        ]);
    }

    private function validated(Request $request, bool $isUpdate = false): array
    {
        $hasItems = $request->has('items');

        $validated = $request->validate([
            'quoteId' => ['nullable', 'string', 'max:255'],
            'quote_id' => ['nullable', 'string', 'max:255'],
            'date' => ['nullable', 'string', 'max:100'],
            'productId' => [
                $hasItems || $isUpdate ? 'nullable' : 'required_without:items',
                'integer',
                'exists:products,id',
            ],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'product' => ['nullable', 'string', 'max:255'],
            'quantity' => ['nullable', 'string', 'max:255'],
            'unitPrice' => ['nullable', 'string', 'max:255'],
            'unit_price' => ['nullable', 'string', 'max:255'],
            'value' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:draft,sent,under-review,approved,rejected,expired'],
            'notes' => ['nullable', 'string'],
            'expiresDate' => ['nullable', 'string', 'max:100'],
            'expires_date' => ['nullable', 'string', 'max:100'],
            'customerId' => [$isUpdate ? 'sometimes' : 'required', 'integer', 'exists:users,id'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'items' => [$isUpdate ? 'sometimes' : 'required_without:productId', 'array', 'min:1'],
            'items.*.productId' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'string', 'max:255'],
            'items.*.price' => ['nullable', 'numeric', 'min:0'],
            'items.*.warehouseId' => ['nullable', 'integer', 'exists:warehouses,id'],
            'items.*.warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
        ]);

        $productId = $validated['productId'] ?? $validated['product_id'] ?? null;
        $productName = $validated['product'] ?? null;
        $customerId = $validated['customerId'] ?? $validated['customer_id'] ?? null;

        if ($productId) {
            $productName = Product::query()->find($productId)?->product ?? $productName;
        }

        if ($customerId) {
            $customer = User::query()->find($customerId);
            abort_unless($customer && $customer->role === 'customer', 422, 'Selected user must be a customer.');
        }

        $data = array_filter([
            'quote_id' => $validated['quoteId'] ?? $validated['quote_id'] ?? null,
            'date' => $validated['date'] ?? null,
            'product_id' => $productId,
            'product' => $productName,
            'quantity' => $validated['quantity'] ?? null,
            'unit_price' => $validated['unitPrice'] ?? $validated['unit_price'] ?? null,
            'value' => $validated['value'] ?? null,
            'status' => $validated['status'] ?? ($isUpdate ? null : 'draft'),
            'notes' => $validated['notes'] ?? null,
            'expires_date' => $validated['expiresDate'] ?? $validated['expires_date'] ?? null,
            'customer_id' => $customerId,
        ], fn ($value) => $value !== null);

        if (array_key_exists('items', $validated)) {
            $productIds = collect($validated['items'])->map(function (array $item) {
                return $item['productId'] ?? $item['product_id'] ?? null;
            })->filter()->values();

            if ($productIds->count() !== $productIds->unique()->count()) {
                throw ValidationException::withMessages([
                    'items' => ['Each product can only be added once per quotation.'],
                ]);
            }

            $data['items'] = collect($validated['items'])->map(function (array $item) {
                $itemProductId = $item['productId'] ?? $item['product_id'] ?? null;
                $qty = $item['qty'] ?? $item['quantity'] ?? '0';
                $product = Product::query()->find($itemProductId);
                $price = isset($item['price'])
                    ? (float) $item['price']
                    : (float) ($product?->price ?? 0);
                $qtyNum = (float) preg_replace('/[^0-9.]/', '', (string) $qty);
                $warehouseId = $item['warehouseId']
                    ?? $item['warehouse_id']
                    ?? $product?->warehouse_id;

                return [
                    'product_id' => $itemProductId,
                    'qty' => $qty,
                    'price' => round($price, 2),
                    'sub_total' => round($qtyNum * $price, 2),
                    'warehouse_id' => $warehouseId,
                    'product_name' => $product?->product,
                ];
            })->values()->all();

            // Keep legacy summary columns filled from line items.
            $first = $data['items'][0] ?? null;
            if ($first) {
                $data['product_id'] = $first['product_id'];
                $data['product'] = collect($data['items'])->pluck('product_name')->filter()->unique()->implode(', ');
                $data['quantity'] = (string) collect($data['items'])->sum(
                    fn ($row) => (float) preg_replace('/[^0-9.]/', '', (string) $row['qty'])
                );
                $data['unit_price'] = number_format((float) $first['price'], 2, '.', '');
                $data['value'] = '$'.number_format(collect($data['items'])->sum('sub_total'), 2);
            }
        }

        return $data;
    }

    private function syncItems(Quotation $quotation, array $items): void
    {
        $quotation->items()->delete();

        foreach ($items as $item) {
            $quotation->items()->create([
                'product_id' => $item['product_id'],
                'qty' => $item['qty'],
                'price' => $item['price'],
                'sub_total' => $item['sub_total'],
                'warehouse_id' => $item['warehouse_id'],
            ]);
        }

        $total = collect($items)->sum('sub_total');
        $names = collect($items)->pluck('product_name')->filter()->unique()->values();
        $first = $items[0] ?? null;

        $quotation->update([
            'product_id' => $first['product_id'] ?? $quotation->product_id,
            'product' => $names->implode(', '),
            'quantity' => (string) collect($items)->sum(
                fn ($row) => (float) preg_replace('/[^0-9.]/', '', (string) $row['qty'])
            ),
            'unit_price' => isset($first['price'])
                ? number_format((float) $first['price'], 2, '.', '')
                : $quotation->unit_price,
            'value' => '$'.number_format($total, 2),
        ]);
    }

    private function ensureLegacyItem(Quotation $quotation): void
    {
        if ($quotation->items()->exists() || ! $quotation->product_id) {
            return;
        }

        $product = Product::query()->find($quotation->product_id);
        $qty = $quotation->quantity ?? '1';
        $price = (float) preg_replace('/[^0-9.]/', '', (string) ($quotation->unit_price ?? $product?->price ?? 0));
        $qtyNum = (float) preg_replace('/[^0-9.]/', '', (string) $qty);

        $quotation->items()->create([
            'product_id' => $quotation->product_id,
            'qty' => $qty,
            'price' => round($price, 2),
            'sub_total' => round($qtyNum * $price, 2),
            'warehouse_id' => $product?->warehouse_id,
        ]);
    }

    private function calculateValue(?string $quantity, ?string $unitPrice): ?string
    {
        if ($quantity === null || $unitPrice === null) {
            return null;
        }

        $qty = (float) preg_replace('/[^0-9.]/', '', $quantity);
        $price = (float) preg_replace('/[^0-9.]/', '', $unitPrice);

        if ($qty <= 0 || $price <= 0) {
            return null;
        }

        return '$'.number_format($qty * $price, 2);
    }

    private function authorizeAccess(Request $request, Quotation $quotation): void
    {
        if ($request->user()->isStaffOrAdmin()) {
            return;
        }

        abort_unless((int) $quotation->customer_id === (int) $request->user()->id, 403);
    }

    private function authorizeCustomerAction(Request $request, Quotation $quotation): void
    {
        abort_unless($request->user()->isCustomer(), 403, 'Only the customer can approve or reject this quotation.');
        abort_unless((int) $quotation->customer_id === (int) $request->user()->id, 403);
    }

    private function format(Quotation $quotation): array
    {
        $order = $quotation->relationLoaded('order') ? $quotation->order : $quotation->order()->first();
        $items = ($quotation->relationLoaded('items') ? $quotation->items : $quotation->items()->with(['product', 'warehouse'])->get())
            ->map(function ($item) {
                return [
                    'id' => (string) $item->id,
                    'productId' => $item->product_id,
                    'product' => $item->product?->product ?? '',
                    'sku' => $item->product?->sku ?? '',
                    'qty' => $item->qty ?? '',
                    'quantity' => $item->qty ?? '',
                    'price' => number_format((float) $item->price, 2, '.', ''),
                    'subTotal' => number_format((float) $item->sub_total, 2, '.', ''),
                    'warehouseId' => $item->warehouse_id,
                    'warehouse' => $item->warehouse?->name ?? '',
                ];
            })
            ->values()
            ->all();

        return [
            'id' => (string) $quotation->id,
            'quoteId' => $quotation->quote_id,
            'date' => $quotation->date ?? '',
            'productId' => $quotation->product_id,
            'product' => $quotation->product
                ?? $quotation->productRelation?->product
                ?? '',
            'quantity' => $quotation->quantity ?? '',
            'unitPrice' => $quotation->unit_price ?? '',
            'value' => $quotation->value ?? '',
            'status' => $quotation->status,
            'notes' => $quotation->notes ?? '',
            'expiresDate' => $quotation->expires_date ?? '',
            'customerId' => $quotation->customer_id,
            'customer' => $quotation->customer?->name ?? '',
            'orderId' => $order?->id ? (string) $order->id : null,
            'items' => $items,
        ];
    }
}
