<?php

namespace App\Support;

use App\Models\PortalNotification;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class PortalNotifier
{
    /**
     * @param  array<string, mixed>  $meta
     */
    public static function notifyUser(
        int $userId,
        string $type,
        string $category,
        string $title,
        string $message,
        ?string $href = null,
        ?Model $notifiable = null,
        array $meta = [],
    ): ?PortalNotification {
        if ($userId <= 0) {
            return null;
        }

        return PortalNotification::query()->create([
            'user_id' => $userId,
            'type' => $type,
            'category' => $category,
            'title' => $title,
            'message' => $message,
            'href' => $href,
            'notifiable_type' => $notifiable ? $notifiable::class : null,
            'notifiable_id' => $notifiable?->getKey(),
            'meta' => $meta ?: null,
        ]);
    }

    /**
     * Notify every admin and staff user.
     *
     * @param  array<string, mixed>  $meta
     * @return Collection<int, PortalNotification>
     */
    public static function notifyStaff(
        string $type,
        string $category,
        string $title,
        string $message,
        ?string $href = null,
        ?Model $notifiable = null,
        array $meta = [],
        ?int $exceptUserId = null,
    ): Collection {
        $query = User::query()->whereIn('role', ['admin', 'staff']);

        if ($exceptUserId) {
            $query->where('id', '!=', $exceptUserId);
        }

        return $query->pluck('id')->map(
            fn (int $userId) => self::notifyUser(
                $userId,
                $type,
                $category,
                $title,
                $message,
                $href,
                $notifiable,
                $meta,
            )
        )->filter();
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    public static function notifyCustomer(
        ?int $customerId,
        string $type,
        string $category,
        string $title,
        string $message,
        ?string $href = null,
        ?Model $notifiable = null,
        array $meta = [],
    ): ?PortalNotification {
        if (! $customerId) {
            return null;
        }

        return self::notifyUser(
            $customerId,
            $type,
            $category,
            $title,
            $message,
            $href,
            $notifiable,
            $meta,
        );
    }
}
