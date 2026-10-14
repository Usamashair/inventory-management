<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

#[Fillable([
    'name',
    'email',
    'address',
    'password',
    'role',
    'city',
    'post_code',
    'phone',
    'api_token',
])]
#[Hidden(['password', 'remember_token', 'api_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /** Plain bearer token for the current request (set by auth middleware). */
    public ?string $currentAccessToken = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isStaff(): bool
    {
        return $this->role === 'staff';
    }

    public function isCustomer(): bool
    {
        return $this->role === 'customer';
    }

    /** Admin and staff share the same elevated permissions. */
    public function isStaffOrAdmin(): bool
    {
        return $this->isAdmin() || $this->isStaff();
    }

    public function apiTokens(): HasMany
    {
        return $this->hasMany(ApiToken::class);
    }

    /** Issue a new token without invalidating other device sessions. */
    public function createApiToken(?string $name = null): string
    {
        $token = Str::random(60);

        $this->apiTokens()->create([
            'token' => hash('sha256', $token),
            'name' => $name,
            'last_used_at' => now(),
        ]);

        return $token;
    }

    /** Revoke only the current session token (or all if none provided / legacy). */
    public function clearApiToken(?string $plainToken = null): void
    {
        $plainToken = $plainToken ?? $this->currentAccessToken;

        if ($plainToken) {
            $this->apiTokens()
                ->where('token', hash('sha256', $plainToken))
                ->delete();

            return;
        }

        // Fallback: clear legacy single-token column if still present.
        if ($this->api_token) {
            $this->forceFill(['api_token' => null])->save();
        }
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function artworks(): HasMany
    {
        return $this->hasMany(Artwork::class);
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }
}
