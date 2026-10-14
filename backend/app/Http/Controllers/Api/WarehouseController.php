<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WarehouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $warehouses = Warehouse::query()
            ->latest()
            ->get()
            ->map(fn (Warehouse $warehouse) => $this->format($warehouse));

        return response()->json(['data' => $warehouses]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'date' => ['nullable', 'string', 'max:100'],
        ]);

        if (empty($data['date'])) {
            $data['date'] = now()->format('d M Y');
        }

        $warehouse = Warehouse::query()->create($data);

        return response()->json([
            'message' => 'Warehouse created successfully.',
            'data' => $this->format($warehouse),
        ], 201);
    }

    public function show(Request $request, Warehouse $warehouse): JsonResponse
    {
        return response()->json(['data' => $this->format($warehouse, true, $request)]);
    }

    public function update(Request $request, Warehouse $warehouse): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'date' => ['nullable', 'string', 'max:100'],
        ]);

        $warehouse->update($data);

        // Keep denormalized product.warehouse names in sync with the live warehouse.
        if (array_key_exists('name', $data)) {
            Product::query()
                ->where('warehouse_id', $warehouse->id)
                ->update(['warehouse' => $data['name']]);
        }

        return response()->json([
            'message' => 'Warehouse updated successfully.',
            'data' => $this->format($warehouse->fresh()),
        ]);
    }

    public function destroy(Request $request, Warehouse $warehouse): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        $warehouse->delete();

        return response()->json(['message' => 'Warehouse deleted successfully.']);
    }

    public function stocks(Request $request, Warehouse $warehouse): JsonResponse
    {
        $query = WarehouseStock::query()
            ->with(['customer', 'product', 'warehouse'])
            ->where('warehouse_id', $warehouse->id)
            ->where('quantity', '>', 0);

        if (! $request->user()->isStaffOrAdmin()) {
            $query->where('customer_id', $request->user()->id);
        }

        $stocks = $query->get()->map(fn (WarehouseStock $stock) => $this->formatStock($stock));

        return response()->json(['data' => $stocks]);
    }

    public function allStocks(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        $stocks = WarehouseStock::query()
            ->with(['customer', 'product', 'warehouse'])
            ->where('quantity', '>', 0)
            ->latest()
            ->get()
            ->map(fn (WarehouseStock $stock) => $this->formatStock($stock));

        return response()->json(['data' => $stocks]);
    }

    public function myStock(Request $request): JsonResponse
    {
        $customerId = $request->user()->isStaffOrAdmin() && $request->filled('customerId')
            ? $request->integer('customerId')
            : $request->user()->id;

        abort_unless(
            $request->user()->isStaffOrAdmin() || (int) $customerId === (int) $request->user()->id,
            403
        );

        $stocks = WarehouseStock::query()
            ->with(['warehouse', 'product', 'customer'])
            ->where('customer_id', $customerId)
            ->where('quantity', '>', 0)
            ->get()
            ->map(fn (WarehouseStock $stock) => $this->formatStock($stock));

        return response()->json(['data' => $stocks]);
    }

    private function formatStock(WarehouseStock $stock): array
    {
        return [
            'id' => (string) $stock->id,
            'warehouseId' => (string) $stock->warehouse_id,
            'warehouse' => $stock->warehouse?->name ?? '',
            'customerId' => $stock->customer_id,
            'customer' => $stock->customer?->name ?? '',
            'productId' => (string) $stock->product_id,
            'product' => $stock->product?->product ?? '',
            'sku' => $stock->product?->sku ?? '',
            'quantity' => number_format((float) $stock->quantity, 2, '.', ''),
        ];
    }

    private function format(Warehouse $warehouse, bool $withStocks = false, ?Request $request = null): array
    {
        $data = [
            'id' => $warehouse->id,
            'name' => $warehouse->name,
            'date' => $warehouse->date ?? $warehouse->created_at?->format('d M Y'),
        ];

        if ($withStocks && $request) {
            $query = WarehouseStock::query()
                ->with(['customer', 'product', 'warehouse'])
                ->where('warehouse_id', $warehouse->id)
                ->where('quantity', '>', 0);

            if (! $request->user()->isStaffOrAdmin()) {
                $query->where('customer_id', $request->user()->id);
            }

            $data['stocks'] = $query->get()->map(fn (WarehouseStock $stock) => $this->formatStock($stock))->values()->all();
        }

        return $data;
    }
}
