<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Quotation extends Model
{
    protected $fillable = [
        'quote_id',
        'date',
        'product_id',
        'product',
        'quantity',
        'unit_price',
        'value',
        'status',
        'notes',
        'expires_date',
        'user_id',
        'customer_id',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function productRelation(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationItem::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(QuotationMessage::class);
    }

    public function order(): HasOne
    {
        return $this->hasOne(Order::class);
    }
}
