<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    public const STATUS_WAITING_FOR_ARTWORK = 'waiting-for-artwork';

    public const STATUS_IN_PRODUCTION = 'in-production';

    public const STATUS_IN_TRANSIT = 'in-transit';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUSES = [
        self::STATUS_WAITING_FOR_ARTWORK,
        self::STATUS_IN_PRODUCTION,
        self::STATUS_IN_TRANSIT,
        self::STATUS_DELIVERED,
    ];

    public const TRANSITIONS = [
        self::STATUS_WAITING_FOR_ARTWORK => [self::STATUS_IN_PRODUCTION],
        self::STATUS_IN_PRODUCTION => [self::STATUS_IN_TRANSIT, self::STATUS_DELIVERED],
        self::STATUS_IN_TRANSIT => [self::STATUS_DELIVERED],
        self::STATUS_DELIVERED => [],
    ];

    protected $fillable = [
        'order_id',
        'date',
        'customer_id',
        'product',
        'total',
        'value',
        'status',
        'delivery_date',
        'delivery_type',
        'delivery_warehouse_id',
        'delivery_address',
        'warehouse_location',
        'notes',
        'user_id',
        'quotation_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function deliveryWarehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'delivery_warehouse_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function artwork(): HasOne
    {
        return $this->hasOne(Artwork::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    public static function normalizeStatus(?string $status): string
    {
        return match ($status) {
            'pending' => self::STATUS_WAITING_FOR_ARTWORK,
            'ready', 'shipped' => self::STATUS_IN_TRANSIT,
            'completed' => self::STATUS_DELIVERED,
            default => $status ?: self::STATUS_WAITING_FOR_ARTWORK,
        };
    }
}
