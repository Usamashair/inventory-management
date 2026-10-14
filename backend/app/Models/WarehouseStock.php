<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarehouseStock extends Model
{
    protected $fillable = [
        'warehouse_id',
        'customer_id',
        'product_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
        ];
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public static function credit(int $warehouseId, int $customerId, int $productId, float $qty): self
    {
        $stock = static::query()->firstOrNew([
            'warehouse_id' => $warehouseId,
            'customer_id' => $customerId,
            'product_id' => $productId,
        ]);

        $stock->quantity = (float) ($stock->quantity ?? 0) + $qty;
        $stock->save();

        return $stock;
    }

    public static function deduct(int $warehouseId, int $customerId, int $productId, float $qty): self
    {
        $stock = static::query()->where([
            'warehouse_id' => $warehouseId,
            'customer_id' => $customerId,
            'product_id' => $productId,
        ])->firstOrFail();

        if ((float) $stock->quantity < $qty) {
            abort(422, "Insufficient stock for product #{$productId}.");
        }

        $stock->quantity = (float) $stock->quantity - $qty;
        $stock->save();

        return $stock;
    }
}
