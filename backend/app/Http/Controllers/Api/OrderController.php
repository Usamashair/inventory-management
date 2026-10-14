<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\Invoice;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use App\Support\DocumentNumber;
use App\Support\PortalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Order::query()
            ->with(['items.product', 'items.warehouse', 'customer', 'deliveryWarehouse', 'artwork', 'invoice'])
            ->latest();

        if (! $request->user()->isStaffOrAdmin()) {
            $query->where('customer_id', $request->user()->id);
        }

        if ($request->filled('deliveryType')) {
            $query->where('delivery_type', $request->string('deliveryType'));
        }

        $orders = $query->get()->map(fn (Order $order) => $this->format($order));

        return response()->json(['data' => $orders]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403, 'Customers create orders by approving quotations.');

        $payload = $this->validated($request);

        $order = DB::transaction(function () use ($request, $payload) {
            $items = $payload['items'];
            unset($payload['items']);

            $payload['user_id'] = $request->user()->id;
            $payload['order_id'] = $payload['order_id'] ?? DocumentNumber::next('ORD');
            $payload['date'] = $payload['date'] ?? now()->format('M d, Y');
            $payload['status'] = $payload['status'] ?? Order::STATUS_WAITING_FOR_ARTWORK;

            $order = Order::query()->create($payload);
            $this->syncItems($order, $items);

            return $order->fresh()->load(['items.product', 'items.warehouse', 'customer', 'deliveryWarehouse', 'artwork', 'invoice']);
        });

        return response()->json([
            'message' => 'Order created successfully.',
            'data' => $this->format($order),
        ], 201);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        $this->authorizeAccess($request, $order);

        return response()->json([
            'data' => $this->format($order->load(['items.product', 'items.warehouse', 'customer', 'deliveryWarehouse', 'artwork', 'invoice'])),
        ]);
    }

    public function update(Request $request, Order $order): JsonResponse
    {
        abort(422, 'Orders cannot be edited once created.');
    }

    public function advance(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        $this->authorizeAccess($request, $order);

        $validated = $request->validate([
            'to' => ['nullable', 'string', 'in:'.implode(',', Order::STATUSES)],
        ]);

        $target = $validated['to'] ?? null;

        $order = DB::transaction(function () use ($request, $order, $target) {
            if ($target) {
                $this->walkStatusTo($request, $order, $target);
            } else {
                $next = $this->nextStatus($order);
                abort_unless($next, 422, 'Order has no further status to advance to.');
                $this->applyStatusStep($request, $order, $next);
            }

            return $order->fresh()->load([
                'items.product',
                'items.warehouse',
                'customer',
                'deliveryWarehouse',
                'artwork',
                'invoice',
            ]);
        });

        return response()->json([
            'message' => 'Order status advanced successfully.',
            'data' => $this->format($order),
        ]);
    }

    public function destroy(Request $request, Order $order): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        $this->authorizeAccess($request, $order);
        $order->delete();

        return response()->json(['message' => 'Order deleted successfully.']);
    }

    private function assertStatusTransition(Request $request, Order $order, string $newStatus): void
    {
        $newStatus = Order::normalizeStatus($newStatus);
        $currentStatus = Order::normalizeStatus($order->status);

        if (! in_array($newStatus, Order::STATUSES, true)) {
            throw ValidationException::withMessages(['status' => ['Invalid order status.']]);
        }

        // Customers cannot move production statuses.
        if (! $request->user()->isStaffOrAdmin()) {
            abort(403, 'Only admin or staff can change order production status.');
        }

        // waiting-for-artwork → in-production must go through artwork approval.
        if (
            $currentStatus === Order::STATUS_WAITING_FOR_ARTWORK
            && $newStatus === Order::STATUS_IN_PRODUCTION
        ) {
            $artwork = $order->artwork;
            abort_unless(
                $artwork && $artwork->isApproved(),
                422,
                'Approve the order artwork before moving to in-production.'
            );

            return;
        }

        $allowed = Order::TRANSITIONS[$currentStatus] ?? [];
        if (! in_array($newStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Cannot transition from {$currentStatus} to {$newStatus}."],
            ]);
        }
    }

    private function nextStatus(Order $order): ?string
    {
        $currentStatus = Order::normalizeStatus($order->status);
        $allowed = Order::TRANSITIONS[$currentStatus] ?? [];

        return $allowed[0] ?? null;
    }

    /**
     * Main production path used for jump-ahead.
     *
     * @return list<string>
     */
    private function pipeline(): array
    {
        return [
            Order::STATUS_WAITING_FOR_ARTWORK,
            Order::STATUS_IN_PRODUCTION,
            Order::STATUS_IN_TRANSIT,
            Order::STATUS_DELIVERED,
        ];
    }

    private function walkStatusTo(Request $request, Order $order, string $target): void
    {
        $target = Order::normalizeStatus($target);
        $currentStatus = Order::normalizeStatus($order->status);

        if ($currentStatus === $target) {
            return;
        }

        $allowed = Order::TRANSITIONS[$currentStatus] ?? [];
        if (in_array($target, $allowed, true)) {
            $this->applyStatusStep($request, $order, $target);

            return;
        }

        $pipeline = $this->pipeline();
        $fromIndex = array_search($currentStatus, $pipeline, true);
        $toIndex = array_search($target, $pipeline, true);

        abort_unless(
            $fromIndex !== false && $toIndex !== false && $toIndex > $fromIndex,
            422,
            "Cannot jump from {$currentStatus} to {$target}."
        );

        $steps = array_slice($pipeline, $fromIndex + 1, $toIndex - $fromIndex);

        foreach ($steps as $step) {
            $this->applyStatusStep($request, $order, $step);
            $order = $order->fresh()->load(['artwork', 'items', 'invoice']);
        }
    }

    private function applyStatusStep(Request $request, Order $order, string $newStatus): void
    {
        $previousStatus = Order::normalizeStatus($order->status);
        $newStatus = Order::normalizeStatus($newStatus);
        $this->assertStatusTransition($request, $order, $newStatus);

        $payload = ['status' => $newStatus];
        if ($newStatus === Order::STATUS_DELIVERED && empty($order->delivery_date)) {
            $payload['delivery_date'] = now()->format('M d, Y');
        }

        $order->update($payload);
        $order = $order->fresh()->load(['items.product', 'items.warehouse', 'customer', 'deliveryWarehouse', 'artwork', 'invoice']);

        $this->maybeCreditWarehouseStock($order, $previousStatus, $newStatus);
        $this->maybeDeductCatalogInventory($order, $previousStatus, $newStatus);
        $this->maybeCreateInvoice($order, $previousStatus, $newStatus);
        $this->notifyStatusChange($order, $previousStatus, $newStatus, (int) $request->user()->id);
    }

    private function notifyStatusChange(Order $order, string $previousStatus, string $newStatus, int $actorId): void
    {
        if ($previousStatus === $newStatus) {
            return;
        }

        $label = $order->order_id ?: '#'.$order->id;
        $statusLabel = str_replace('-', ' ', $newStatus);
        $customerName = $order->customer?->name ?: 'customer';

        $titles = [
            Order::STATUS_IN_PRODUCTION => 'Order in production',
            Order::STATUS_IN_TRANSIT => 'Order in transit',
            Order::STATUS_DELIVERED => 'Order delivered',
            Order::STATUS_WAITING_FOR_ARTWORK => 'Order waiting for artwork',
        ];

        $title = $titles[$newStatus] ?? 'Order status updated';
        $customerMessage = "Your order {$label} is now {$statusLabel}.";
        $staffMessage = "{$label} ({$customerName}) moved to {$statusLabel}.";

        PortalNotifier::notifyCustomer(
            (int) $order->customer_id,
            'order.'.$newStatus,
            'order',
            $title,
            $customerMessage,
            '/dashboard/orders/'.$order->id,
            $order,
            ['status' => $newStatus, 'previousStatus' => $previousStatus],
        );

        PortalNotifier::notifyStaff(
            'order.'.$newStatus,
            'order',
            $title,
            $staffMessage,
            '/dashboard/orders/'.$order->id,
            $order,
            ['status' => $newStatus, 'previousStatus' => $previousStatus],
            exceptUserId: $actorId,
        );
    }

    private function maybeCreditWarehouseStock(Order $order, string $previousStatus, string $newStatus): void
    {
        if ($newStatus !== Order::STATUS_DELIVERED) {
            return;
        }

        if ($previousStatus === Order::STATUS_DELIVERED) {
            return;
        }

        if ($order->delivery_type !== 'warehouse' || ! $order->delivery_warehouse_id || ! $order->customer_id) {
            return;
        }

        foreach ($order->items as $item) {
            if (! $item->product_id) {
                continue;
            }

            $qty = (float) preg_replace('/[^0-9.]/', '', (string) $item->qty);
            if ($qty <= 0) {
                continue;
            }

            WarehouseStock::credit(
                (int) $order->delivery_warehouse_id,
                (int) $order->customer_id,
                (int) $item->product_id,
                $qty
            );
        }
    }

    /**
     * Catalog inventory (products.quantity) decreases when goods are delivered,
     * for both warehouse and customer-address deliveries.
     */
    private function maybeDeductCatalogInventory(Order $order, string $previousStatus, string $newStatus): void
    {
        if ($newStatus !== Order::STATUS_DELIVERED) {
            return;
        }

        if ($previousStatus === Order::STATUS_DELIVERED) {
            return;
        }

        foreach ($order->items as $item) {
            if (! $item->product_id) {
                continue;
            }

            $qty = (float) preg_replace('/[^0-9.]/', '', (string) $item->qty);
            if ($qty <= 0) {
                continue;
            }

            Product::deductSoldQuantity((int) $item->product_id, $qty);
        }
    }

    private function maybeCreateInvoice(Order $order, string $previousStatus, string $newStatus): void
    {
        if ($newStatus !== Order::STATUS_DELIVERED) {
            return;
        }

        if ($previousStatus === Order::STATUS_DELIVERED) {
            return;
        }

        if ($order->invoice()->exists()) {
            return;
        }

        $itemCount = $order->items->count();
        $amount = number_format((float) ($order->total ?? 0), 2, '.', '');

        $invoice = Invoice::query()->create([
            'invoice_no' => DocumentNumber::next('INV'),
            'issue_date' => now()->format('M d, Y'),
            'due_date' => now()->addDays(30)->format('M d, Y'),
            'description' => 'Invoice for order '.($order->order_id ?: '#'.$order->id),
            'amount' => $amount,
            'paid' => '0',
            'status' => 'pending',
            'items' => $itemCount,
            'notes' => $order->notes,
            'user_id' => $order->user_id,
            'order_id' => $order->id,
            'customer_id' => $order->customer_id,
            'quotation_id' => $order->quotation_id,
        ]);

        $invoiceLabel = $invoice->invoice_no ?: '#'.$invoice->id;
        $orderLabel = $order->order_id ?: '#'.$order->id;

        PortalNotifier::notifyCustomer(
            (int) $order->customer_id,
            'invoice.created',
            'invoice',
            'Invoice created',
            "{$invoiceLabel} was created for order {$orderLabel} (amount \${$amount}).",
            '/dashboard/invoices/'.$invoice->id,
            $invoice,
        );
        PortalNotifier::notifyStaff(
            'invoice.created',
            'invoice',
            'Invoice created',
            "{$invoiceLabel} was created for order {$orderLabel}.",
            '/dashboard/invoices/'.$invoice->id,
            $invoice,
        );
    }

    private function validated(Request $request, bool $isUpdate = false): array
    {
        $customerRequired = $request->user()->isStaffOrAdmin()
            ? ($isUpdate ? 'sometimes' : 'required')
            : 'nullable';

        $validated = $request->validate([
            'orderId' => ['nullable', 'string', 'max:255'],
            'order_id' => ['nullable', 'string', 'max:255'],
            'date' => ['nullable', 'string', 'max:100'],
            'customerId' => [$customerRequired, 'integer', 'exists:users,id'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'status' => ['nullable', 'string', 'in:'.implode(',', Order::STATUSES)],
            'deliveryDate' => ['nullable', 'string', 'max:100'],
            'delivery_date' => ['nullable', 'string', 'max:100'],
            'deliveryType' => ['nullable', 'string', 'in:warehouse,customer_address'],
            'delivery_type' => ['nullable', 'string', 'in:warehouse,customer_address'],
            'deliveryWarehouseId' => ['nullable', 'integer', 'exists:warehouses,id'],
            'delivery_warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'deliveryAddress' => ['nullable', 'string'],
            'delivery_address' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'items' => [$isUpdate ? 'sometimes' : 'required', 'array', 'min:1'],
            'items.*.productId' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'string', 'max:255'],
            'items.*.price' => ['nullable', 'numeric', 'min:0'],
            'items.*.warehouseId' => ['nullable', 'integer', 'exists:warehouses,id'],
            'items.*.warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
        ]);

        $customerId = $validated['customerId'] ?? $validated['customer_id'] ?? null;
        if (! $request->user()->isStaffOrAdmin()) {
            $customerId = $request->user()->id;
        }

        if (! $isUpdate && ! $customerId) {
            throw ValidationException::withMessages([
                'customerId' => ['Customer is required.'],
            ]);
        }

        $data = array_filter([
            'order_id' => $validated['orderId'] ?? $validated['order_id'] ?? null,
            'date' => $validated['date'] ?? null,
            'customer_id' => $customerId,
            'status' => $validated['status'] ?? ($isUpdate ? null : Order::STATUS_WAITING_FOR_ARTWORK),
            'delivery_date' => $validated['deliveryDate'] ?? $validated['delivery_date'] ?? null,
            'delivery_type' => $validated['deliveryType'] ?? $validated['delivery_type'] ?? null,
            'delivery_warehouse_id' => $validated['deliveryWarehouseId'] ?? $validated['delivery_warehouse_id'] ?? null,
            'delivery_address' => $validated['deliveryAddress'] ?? $validated['delivery_address'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ], fn ($value) => $value !== null);

        if (array_key_exists('items', $validated)) {
            $productIds = collect($validated['items'])->map(function (array $item) {
                return $item['productId'] ?? $item['product_id'] ?? null;
            })->filter()->values();

            if ($productIds->count() !== $productIds->unique()->count()) {
                throw ValidationException::withMessages([
                    'items' => ['Each product can only be added once per order.'],
                ]);
            }

            $data['items'] = collect($validated['items'])->map(function (array $item) {
                $productId = $item['productId'] ?? $item['product_id'] ?? null;
                $qty = $item['qty'] ?? $item['quantity'] ?? '0';
                $product = Product::query()->find($productId);
                $price = isset($item['price'])
                    ? (float) $item['price']
                    : (float) ($product?->price ?? 0);
                $qtyNum = (float) preg_replace('/[^0-9.]/', '', (string) $qty);
                $warehouseId = $item['warehouseId']
                    ?? $item['warehouse_id']
                    ?? $product?->warehouse_id;

                return [
                    'product_id' => $productId,
                    'qty' => $qty,
                    'price' => round($price, 2),
                    'sub_total' => round($qtyNum * $price, 2),
                    'warehouse_id' => $warehouseId,
                    'product_name' => $product?->product,
                    'warehouse_name' => $warehouseId
                        ? Warehouse::query()->find($warehouseId)?->name
                        : null,
                ];
            })->values()->all();
        }

        return $data;
    }

    private function syncItems(Order $order, array $items): void
    {
        $order->items()->delete();

        foreach ($items as $item) {
            $order->items()->create([
                'product_id' => $item['product_id'],
                'qty' => $item['qty'],
                'price' => $item['price'],
                'sub_total' => $item['sub_total'],
                'warehouse_id' => $item['warehouse_id'],
            ]);
        }

        $total = collect($items)->sum('sub_total');
        $names = collect($items)->pluck('product_name')->filter()->unique()->values();
        $warehouses = collect($items)->pluck('warehouse_name')->filter()->unique()->values();

        $order->update([
            'total' => round($total, 2),
            'value' => '$'.number_format($total, 2),
            'product' => $names->implode(', '),
            'warehouse_location' => $warehouses->implode(', '),
        ]);
    }

    private function authorizeAccess(Request $request, Order $order): void
    {
        if ($request->user()->isStaffOrAdmin()) {
            return;
        }

        abort_unless((int) $order->customer_id === (int) $request->user()->id, 403);
    }

    private function format(Order $order): array
    {
        $items = $order->items->map(function ($item) {
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
        })->values()->all();

        $total = (float) ($order->total ?? 0);
        $artwork = $order->relationLoaded('artwork') ? $order->artwork : $order->artwork()->first();
        $invoice = $order->relationLoaded('invoice') ? $order->invoice : $order->invoice()->first();

        return [
            'id' => (string) $order->id,
            'orderId' => $order->order_id,
            'date' => $order->date ?? '',
            'customerId' => $order->customer_id,
            'customer' => $order->customer?->name ?? '',
            'quotationId' => $order->quotation_id,
            'product' => $order->product ?? '',
            'quantity' => (string) collect($items)->sum(fn ($item) => (float) preg_replace('/[^0-9.]/', '', (string) $item['qty'])),
            'total' => number_format($total, 2, '.', ''),
            'value' => $order->value ?: ('$'.number_format($total, 2)),
            'status' => Order::normalizeStatus($order->status),
            'deliveryDate' => $order->delivery_date ?? '',
            'deliveryType' => $order->delivery_type,
            'deliveryWarehouseId' => $order->delivery_warehouse_id,
            'deliveryWarehouse' => $order->deliveryWarehouse?->name ?? '',
            'deliveryAddress' => $order->delivery_address ?? '',
            'warehouseLocation' => $order->warehouse_location ?? '',
            'notes' => $order->notes ?? '',
            'artworkId' => $artwork?->id ? (string) $artwork->id : null,
            'artworkStatus' => $artwork ? \App\Models\Artwork::normalizeStatus($artwork->status) : null,
            'invoiceId' => $invoice?->id ? (string) $invoice->id : null,
            'invoiceNo' => $invoice?->invoice_no,
            'items' => $items,
        ];
    }
}
