<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class MailSetting extends Model
{
    protected $fillable = [
        'enabled',
        'host',
        'port',
        'encryption',
        'username',
        'password',
        'from_address',
        'from_name',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'port' => 'integer',
        ];
    }

    public static function current(): self
    {
        $row = static::query()->first();
        if ($row) {
            return $row;
        }

        return static::query()->create([
            'enabled' => false,
            'port' => 587,
            'encryption' => 'tls',
            'from_name' => 'Rexapack',
        ]);
    }

    public function setPasswordAttribute(?string $value): void
    {
        if ($value === null || $value === '') {
            return;
        }

        $this->attributes['password'] = Crypt::encryptString($value);
    }

    public function plainPassword(): ?string
    {
        $value = $this->attributes['password'] ?? null;
        if (! $value) {
            return null;
        }

        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return null;
        }
    }

    public function hasPassword(): bool
    {
        return ! empty($this->attributes['password'] ?? null);
    }

    public function isConfigured(): bool
    {
        return $this->enabled
            && filled($this->host)
            && filled($this->port)
            && filled($this->from_address)
            && $this->hasPassword()
            && filled($this->username);
    }
}
