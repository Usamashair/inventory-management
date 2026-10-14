<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Warehouse;
use App\Models\WarehouseStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::query()->with('warehouseRelation')->latest();

        if (! $request->user()->isStaffOrAdmin()) {
            $query->where(function ($builder) use ($request) {
                $builder->where('user_id', $request->user()->id)
                    ->orWhereNull('user_id');
            });
        }

        $products = $query->get();

        // Keep denormalized product.warehouse names aligned with current warehouse records.
        $stale = $products->filter(function (Product $product) {
            if (! $product->warehouse_id || ! $product->warehouseRelation) {
                return false;
            }

            return ($product->getAttributes()['warehouse'] ?? null) !== $product->warehouseRelation->name;
        });

        foreach ($stale->groupBy('warehouse_id') as $warehouseId => $group) {
            $name = $group->first()->warehouseRelation?->name;
            if (! $name) {
                continue;
            }
            Product::query()->where('warehouse_id', $warehouseId)->update(['warehouse' => $name]);
            foreach ($group as $product) {
                $product->setAttribute('warehouse', $name);
            }
        }

        $heldByProduct = WarehouseStock::query()
            ->selectRaw('product_id, SUM(quantity) as held')
            ->whereIn('product_id', $products->pluck('id'))
            ->groupBy('product_id')
            ->pluck('held', 'product_id');

        $data = $products->map(
            fn (Product $product) => $this->format($product, (float) ($heldByProduct[$product->id] ?? 0))
        );

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        $data = $this->validated($request);
        $data['user_id'] = $request->user()->id;

        $product = Product::query()->create($data);

        return response()->json([
            'message' => 'Product created successfully.',
            'data' => $this->format($product->load('warehouseRelation')),
        ], 201);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        $this->authorizeAccess($request, $product);

        return response()->json(['data' => $this->format($product->load('warehouseRelation'))]);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        $this->authorizeAccess($request, $product);

        $data = $this->validated($request, $product->id);
        $product->update($data);

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $this->format($product->fresh()->load('warehouseRelation')),
        ]);
    }

    public function destroy(Request $request, Product $product): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        $this->authorizeAccess($request, $product);
        $product->delete();

        return response()->json(['message' => 'Product deleted successfully.']);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $validated = $request->validate([
            'sku' => [
                $ignoreId ? 'sometimes' : 'required',
                'string',
                'max:255',
                Rule::unique('products', 'sku')->ignore($ignoreId),
            ],
            'product' => [$ignoreId ? 'sometimes' : 'required', 'string', 'max:255'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'quantity' => ['nullable', 'string', 'max:255'],
            'available' => ['nullable', 'string', 'max:255'],
            'reserved' => ['nullable', 'string', 'max:255'],
            'warehouseId' => ['nullable', 'integer', 'exists:warehouses,id'],
            'warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'warehouse' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:in-stock,low-stock,out-of-stock'],
            'threshold' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        $warehouseId = $validated['warehouseId'] ?? $validated['warehouse_id'] ?? null;
        $warehouseName = $validated['warehouse'] ?? null;

        if ($warehouseId) {
            $warehouseName = Warehouse::query()->find($warehouseId)?->name ?? $warehouseName;
        } elseif ($warehouseName) {
            $warehouseId = Warehouse::query()->where('name', $warehouseName)->value('id');
        }

        $payload = array_filter([
            'sku' => $validated['sku'] ?? null,
            'product' => $validated['product'] ?? null,
            'price' => array_key_exists('price', $validated) ? (float) $validated['price'] : null,
            'quantity' => $validated['quantity'] ?? null,
            'available' => $validated['available'] ?? ($validated['quantity'] ?? null),
            'reserved' => $validated['reserved'] ?? ($ignoreId ? null : '0'),
            'warehouse_id' => $warehouseId,
            'warehouse' => $warehouseName,
            'status' => $validated['status'] ?? ($ignoreId ? null : 'in-stock'),
            'threshold' => $validated['threshold'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ], fn ($value) => $value !== null);

        if (! $ignoreId) {
            $payload['price'] = $payload['price'] ?? 0.00;
            $payload['status'] = $payload['status'] ?? 'in-stock';
            $payload['reserved'] = $payload['reserved'] ?? '0';
        }

        return $payload;
    }

    private function authorizeAccess(Request $request, Product $product): void
    {
        if ($request->user()->isStaffOrAdmin()) {
            return;
        }

        abort_unless(
            $product->user_id === null || $product->user_id === $request->user()->id,
            403
        );
    }

    private function format(Product $product, ?float $held = null): array
    {
        $heldQty = $held;
        if ($heldQty === null) {
            $heldQty = (float) WarehouseStock::query()
                ->where('product_id', $product->id)
                ->sum('quantity');
        }

        return [
            'id' => (string) $product->id,
            'sku' => $product->sku,
            'product' => $product->product,
            'price' => number_format((float) ($product->price ?? 0), 2, '.', ''),
            'quantity' => $product->quantity ?? '',
            'available' => $product->available ?? $product->quantity ?? '',
            'reserved' => $product->reserved ?? '0',
            'customerHeld' => number_format($heldQty, 2, '.', ''),
            'warehouseId' => $product->warehouse_id,
            'warehouse' => $this->resolveWarehouseName($product),
            'status' => $product->status,
            'threshold' => $product->threshold ?? '',
            'notes' => $product->notes ?? '',
        ];
    }

    private function resolveWarehouseName(Product $product): string
    {
        if ($product->warehouse_id) {
            if ($product->relationLoaded('warehouseRelation') && $product->warehouseRelation) {
                return (string) $product->warehouseRelation->name;
            }

            $name = Warehouse::query()->whereKey($product->warehouse_id)->value('name');
            if ($name) {
                return (string) $name;
            }
        }

        // Legacy rows without warehouse_id — last resort only.
        return (string) ($product->getAttributes()['warehouse'] ?? '');
    }
}
