<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortalNotification;
use App\Support\PortalNotificationBackfiller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! Schema::hasTable('portal_notifications')) {
            return response()->json([
                'data' => [],
                'unreadCount' => 0,
                'message' => 'Notifications table is not ready. Run migrations.',
            ]);
        }

        $validated = $request->validate([
            'category' => ['nullable', 'string', 'max:40'],
            'unread' => ['nullable', 'boolean'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        // Populate inbox from existing quotes/orders/etc. the first time a user opens it.
        PortalNotificationBackfiller::ensureFor($request->user());

        $query = PortalNotification::query()
            ->where('user_id', $request->user()->id)
            ->latest();

        if (! empty($validated['category']) && $validated['category'] !== 'all') {
            $query->where('category', $validated['category']);
        }

        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $limit = $validated['limit'] ?? 100;
        $notifications = $query->limit($limit)->get()->map(fn (PortalNotification $n) => $this->format($n));

        $unreadCount = PortalNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => $notifications,
            'unreadCount' => $unreadCount,
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        if (! Schema::hasTable('portal_notifications')) {
            return response()->json(['unreadCount' => 0]);
        }

        PortalNotificationBackfiller::ensureFor($request->user());

        $count = PortalNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['unreadCount' => $count]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $notification = PortalNotification::query()->findOrFail($id);
        abort_unless((int) $notification->user_id === (int) $request->user()->id, 403);

        $notification->markRead();

        return response()->json([
            'message' => 'Notification marked as read.',
            'data' => $this->format($notification->fresh()),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        if (! Schema::hasTable('portal_notifications')) {
            return response()->json(['message' => 'Nothing to update.']);
        }

        PortalNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    private function format(PortalNotification $notification): array
    {
        return [
            'id' => (string) $notification->id,
            'type' => $notification->type,
            'category' => $notification->category,
            'title' => $notification->title,
            'message' => $notification->message,
            'href' => $notification->href,
            'meta' => $notification->meta ?? [],
            'readAt' => $notification->read_at?->toIso8601String(),
            'createdAt' => $notification->created_at?->toIso8601String(),
            'createdAtLabel' => $notification->created_at?->diffForHumans() ?? '',
            'isRead' => $notification->read_at !== null,
        ];
    }
}
