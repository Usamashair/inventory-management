<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = [
        'sku',
        'product',
        'price',
        'quantity',
        'available',
        'reserved',
        'warehouse_id',
        'warehouse',
        'status',
        'threshold',
        'notes',
        'user_id',
    ];

    public function warehouseRelation(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    /**
     * Reduce catalog quantity/available when units are sold (order delivered).
     */
    public static function deductSoldQuantity(int $productId, float $qty): void
    {
        if ($qty <= 0) {
            return;
        }

        $product = static::query()->lockForUpdate()->find($productId);
        if (! $product) {
            return;
        }

        $current = (float) preg_replace('/[^0-9.]/', '', (string) ($product->quantity ?? $product->available ?? '0'));
        $newQty = max(0, round($current - $qty, 2));
        $threshold = (float) preg_replace('/[^0-9.]/', '', (string) ($product->threshold ?? '0'));

        $status = 'in-stock';
        if ($newQty <= 0) {
            $status = 'out-of-stock';
        } elseif ($threshold > 0 && $newQty <= $threshold) {
            $status = 'low-stock';
        }

        $qtyLabel = fmod($newQty, 1.0) === 0.0
            ? (string) (int) $newQty
            : rtrim(rtrim(number_format($newQty, 2, '.', ''), '0'), '.');

        $product->update([
            'quantity' => $qtyLabel,
            'available' => $qtyLabel,
            'status' => $status,
        ]);
    }
}
