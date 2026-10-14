<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Artwork extends Model
{
    public const STATUS_AWAITING_APPROVAL = 'awaiting-approval';

    public const STATUS_REVISION_REQUESTED = 'revision-requested';

    public const STATUS_REVISION_SENT = 'revision-sent';

    public const STATUS_APPROVED = 'approved';

    public const STATUSES = [
        self::STATUS_AWAITING_APPROVAL,
        self::STATUS_REVISION_REQUESTED,
        self::STATUS_REVISION_SENT,
        self::STATUS_APPROVED,
    ];

    protected $fillable = [
        'image',
        'description',
        'status',
        'customer_id',
        'user_id',
        'order_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public static function normalizeStatus(?string $status): string
    {
        return match ($status) {
            'waiting', 'review', 'in-design' => self::STATUS_AWAITING_APPROVAL,
            'production' => self::STATUS_APPROVED,
            default => $status ?: self::STATUS_AWAITING_APPROVAL,
        };
    }

    public function isApproved(): bool
    {
        return self::normalizeStatus($this->status) === self::STATUS_APPROVED;
    }
}
