<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Models\Order;
use App\Support\PortalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ArtworkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Artwork::query()->with(['customer', 'order'])->latest();

        if (! $request->user()->isStaffOrAdmin()) {
            $query->where(function ($builder) use ($request) {
                $uid = $request->user()->id;
                $builder->where('customer_id', $uid)
                    ->orWhere('user_id', $uid)
                    ->orWhereHas('order', fn ($q) => $q->where('customer_id', $uid));
            });
        }

        if ($request->filled('orderId')) {
            $query->where('order_id', $request->integer('orderId'));
        }

        if ($request->filled('customerId')) {
            $query->where('customer_id', $request->integer('customerId'));
        }

        if ($request->filled('status')) {
            $status = Artwork::normalizeStatus((string) $request->input('status'));
            $query->where('status', $status);
        }

        if ($request->filled('orderStatus')) {
            $orderStatus = (string) $request->input('orderStatus');
            $query->whereHas('order', fn ($builder) => $builder->where('status', $orderStatus));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->input('search'));
            if ($search !== '') {
                $query->where(function ($builder) use ($search) {
                    $builder->where('description', 'like', "%{$search}%")
                        ->orWhereHas('order', fn ($q) => $q->where('order_id', 'like', "%{$search}%"))
                        ->orWhereHas('customer', fn ($q) => $q->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%"));
                });
            }
        }

        $artworks = $query->get()->map(fn (Artwork $artwork) => $this->format($artwork));

        return response()->json(['data' => $artworks]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $order = $this->resolveOrderForUpload($request, $data['order_id'] ?? null);

        $data['user_id'] = $request->user()->id;
        $data['customer_id'] = $order
            ? (int) $order->customer_id
            : $this->resolveCustomerId($request, $data['customer_id'] ?? null);
        $data['order_id'] = $order?->id;
        $data['image'] = $this->resolveImage($request) ?? $data['image'] ?? null;

        // Admin/staff upload is pre-approved; customer upload awaits approval.
        $data['status'] = $request->user()->isStaffOrAdmin()
            ? Artwork::STATUS_APPROVED
            : Artwork::STATUS_AWAITING_APPROVAL;

        abort_unless($data['image'], 422, 'Artwork image is required.');

        $artwork = DB::transaction(function () use ($data) {
            $artwork = Artwork::query()->create($data)->load(['customer', 'order']);
            $this->syncOrderWithArtworkStatus($artwork, null, $artwork->status);

            return $artwork->fresh()->load(['customer', 'order']);
        });

        $this->notifyArtworkEvent($artwork, null, Artwork::normalizeStatus($artwork->status), (int) $request->user()->id);

        return response()->json([
            'message' => 'Artwork created successfully.',
            'data' => $this->format($artwork),
        ], 201);
    }

    public function storeForOrder(Request $request, Order $order): JsonResponse
    {
        $this->authorizeOrderArtwork($request, $order);
        abort_unless(
            $order->status === Order::STATUS_WAITING_FOR_ARTWORK,
            422,
            'Artwork can only be uploaded while the order is waiting for artwork.'
        );

        $request->merge([
            'orderId' => $order->id,
            'customerId' => $order->customer_id,
        ]);

        return $this->store($request);
    }

    public function show(Request $request, Artwork $artwork): JsonResponse
    {
        $this->authorizeAccess($request, $artwork);

        return response()->json(['data' => $this->format($artwork->load(['customer', 'order']))]);
    }

    public function update(Request $request, Artwork $artwork): JsonResponse
    {
        $this->authorizeAccess($request, $artwork);

        abort_if(
            $artwork->isApproved()
            && ! (
                $request->user()->isStaffOrAdmin()
                && Artwork::normalizeStatus((string) $request->input('status', '')) === Artwork::STATUS_REVISION_REQUESTED
            ),
            422,
            'Approved artwork cannot be changed. Request a revision if updates are needed.'
        );

        $data = $this->validated($request, true);
        $previousStatus = Artwork::normalizeStatus($artwork->status);
        $isStaff = $request->user()->isStaffOrAdmin();

        if ($request->boolean('remove_image')) {
            $data['image'] = null;
        }

        $image = $this->resolveImage($request);
        if ($image !== null) {
            $data['image'] = $image;
        }

        if (array_key_exists('customer_id', $data) || $request->has('customerId') || $request->has('customer_id')) {
            $data['customer_id'] = $this->resolveCustomerId(
                $request,
                $data['customer_id'] ?? $request->input('customerId') ?? $request->input('customer_id')
            );
        }

        // Allow linking an orphan artwork (uploaded without an order) to a waiting order.
        if (! $artwork->order_id && ! empty($data['order_id'])) {
            $order = $this->resolveOrderForUpload($request, $data['order_id']);
            $data['order_id'] = $order?->id;
            if ($order) {
                $data['customer_id'] = (int) $order->customer_id;
            }
        } elseif ($artwork->order_id) {
            unset($data['order_id']);
        }

        if (! $isStaff) {
            // Customers cannot freely change status.
            unset($data['status']);

            // Customer revision upload → revision-sent (customer-facing). Admins treat it as awaiting approval in UI.
            if ($image !== null && $previousStatus === Artwork::STATUS_REVISION_REQUESTED) {
                $data['status'] = Artwork::STATUS_REVISION_SENT;
            }
        } elseif (isset($data['status'])) {
            $data['status'] = Artwork::normalizeStatus($data['status']);
            abort_unless(
                in_array($data['status'], Artwork::STATUSES, true),
                422,
                'Invalid artwork status.'
            );

            // Revision Send is set only when a customer uploads a revised file.
            abort_if(
                $data['status'] === Artwork::STATUS_REVISION_SENT,
                422,
                'Revision Send is a customer-only status. Use Awaiting Approval instead.'
            );

            // Ensure the order's customer can see and act on a revision request.
            if (
                $data['status'] === Artwork::STATUS_REVISION_REQUESTED
                && empty($artwork->customer_id)
                && $artwork->order_id
            ) {
                $linkedOrder = $artwork->order ?: Order::query()->find($artwork->order_id);
                if ($linkedOrder) {
                    $data['customer_id'] = (int) $linkedOrder->customer_id;
                }
            }
        }

        $artwork = DB::transaction(function () use ($artwork, $data, $previousStatus) {
            $artwork->update($data);
            $artwork = $artwork->fresh()->load(['customer', 'order']);
            $newStatus = Artwork::normalizeStatus($artwork->status);
            $this->syncOrderWithArtworkStatus($artwork, $previousStatus, $newStatus);

            return $artwork->fresh()->load(['customer', 'order']);
        });

        $this->notifyArtworkEvent(
            $artwork,
            $previousStatus,
            Artwork::normalizeStatus($artwork->status),
            (int) $request->user()->id,
        );

        return response()->json([
            'message' => 'Artwork updated successfully.',
            'data' => $this->format($artwork),
        ]);
    }

    public function destroy(Request $request, Artwork $artwork): JsonResponse
    {
        $this->authorizeAccess($request, $artwork);

        abort_if(
            $artwork->isApproved(),
            422,
            'Approved artwork cannot be deleted.'
        );

        $artwork->delete();

        return response()->json(['message' => 'Artwork deleted successfully.']);
    }

    public function media(Artwork $artwork, int $index = 0): StreamedResponse
    {
        abort_unless(! empty($artwork->image), 404);

        $disk = Storage::disk('public');
        abort_unless($disk->exists($artwork->image), 404);

        return $disk->response(
            $artwork->image,
            basename($artwork->image),
            [
                'Content-Type' => $disk->mimeType($artwork->image),
                // Fingerprinted via ?v= on imageUrl — allow long cache per unique file version.
                'Cache-Control' => 'public, max-age=31536000, immutable',
            ]
        );
    }

    private function syncOrderWithArtworkStatus(Artwork $artwork, ?string $previousStatus, string $newStatus): void
    {
        if (! $artwork->order_id) {
            return;
        }

        $order = $artwork->order ?: Order::query()->find($artwork->order_id);
        if (! $order) {
            return;
        }

        $newStatus = Artwork::normalizeStatus($newStatus);
        $previousStatus = $previousStatus ? Artwork::normalizeStatus($previousStatus) : null;

        if ($newStatus === Artwork::STATUS_APPROVED && $order->status === Order::STATUS_WAITING_FOR_ARTWORK) {
            $order->update(['status' => Order::STATUS_IN_PRODUCTION]);

            $orderLabel = $order->order_id ?: '#'.$order->id;
            PortalNotifier::notifyCustomer(
                (int) $order->customer_id,
                'order.in-production',
                'order',
                'Order in production',
                "Your order {$orderLabel} moved to in production after artwork approval.",
                '/dashboard/orders/'.$order->id,
                $order,
            );
            PortalNotifier::notifyStaff(
                'order.in-production',
                'order',
                'Order in production',
                "{$orderLabel} moved to in production after artwork approval.",
                '/dashboard/orders/'.$order->id,
                $order,
            );

            return;
        }

        // Any revision request puts the order back into the artwork queue for the customer.
        if (
            $newStatus === Artwork::STATUS_REVISION_REQUESTED
            && $previousStatus !== Artwork::STATUS_REVISION_REQUESTED
        ) {
            if ($order->status !== Order::STATUS_WAITING_FOR_ARTWORK) {
                $order->update(['status' => Order::STATUS_WAITING_FOR_ARTWORK]);
            }

            if (! $artwork->customer_id && $order->customer_id) {
                $artwork->update(['customer_id' => (int) $order->customer_id]);
            }
        }
    }

    private function notifyArtworkEvent(Artwork $artwork, ?string $previousStatus, string $newStatus, int $actorId): void
    {
        $name = $artwork->description ?: ('Artwork #'.$artwork->id);
        $orderLabel = $artwork->order?->order_id ?: ($artwork->order_id ? '#'.$artwork->order_id : null);
        $suffix = $orderLabel ? " for order {$orderLabel}" : '';
        $href = '/dashboard/artwork/'.$artwork->id;
        $customerId = (int) ($artwork->customer_id ?: $artwork->order?->customer_id);

        if ($previousStatus === null && $newStatus === Artwork::STATUS_AWAITING_APPROVAL) {
            PortalNotifier::notifyStaff(
                'artwork.received',
                'artwork',
                'Artwork received',
                "{$name}{$suffix} was uploaded and awaits approval.",
                $href,
                $artwork,
                exceptUserId: $actorId,
            );

            return;
        }

        if ($previousStatus === null && $newStatus === Artwork::STATUS_APPROVED) {
            PortalNotifier::notifyCustomer(
                $customerId,
                'artwork.approved',
                'artwork',
                'Artwork approved',
                "{$name}{$suffix} was approved.",
                $href,
                $artwork,
            );
            PortalNotifier::notifyStaff(
                'artwork.approved',
                'artwork',
                'Artwork approved',
                "{$name}{$suffix} was uploaded and approved.",
                $href,
                $artwork,
                exceptUserId: $actorId,
            );

            return;
        }

        if ($previousStatus === $newStatus) {
            return;
        }

        if ($newStatus === Artwork::STATUS_REVISION_REQUESTED) {
            PortalNotifier::notifyCustomer(
                $customerId,
                'artwork.revision-requested',
                'artwork',
                'Revision requested',
                "A revision was requested for {$name}{$suffix}. Please upload an updated file.",
                $href,
                $artwork,
            );
            PortalNotifier::notifyStaff(
                'artwork.revision-requested',
                'artwork',
                'Revision requested',
                "Revision requested on {$name}{$suffix}.",
                $href,
                $artwork,
                exceptUserId: $actorId,
            );

            return;
        }

        if ($newStatus === Artwork::STATUS_REVISION_SENT) {
            PortalNotifier::notifyStaff(
                'artwork.revision-sent',
                'artwork',
                'Revision received',
                "A revised file was uploaded for {$name}{$suffix}.",
                $href,
                $artwork,
                exceptUserId: $actorId,
            );

            return;
        }

        if ($newStatus === Artwork::STATUS_APPROVED) {
            PortalNotifier::notifyCustomer(
                $customerId,
                'artwork.approved',
                'artwork',
                'Artwork approved',
                "{$name}{$suffix} was approved.",
                $href,
                $artwork,
            );
            PortalNotifier::notifyStaff(
                'artwork.approved',
                'artwork',
                'Artwork approved',
                "{$name}{$suffix} was approved.",
                $href,
                $artwork,
                exceptUserId: $actorId,
            );

            return;
        }

        if ($newStatus === Artwork::STATUS_AWAITING_APPROVAL) {
            PortalNotifier::notifyStaff(
                'artwork.received',
                'artwork',
                'Artwork awaiting approval',
                "{$name}{$suffix} is awaiting approval.",
                $href,
                $artwork,
                exceptUserId: $actorId,
            );
        }
    }

    private function validated(Request $request, bool $isUpdate = false): array
    {
        $validated = $request->validate([
            'description' => ['nullable', 'string'],
            'status' => [
                'nullable',
                'string',
                'in:awaiting-approval,revision-requested,revision-sent,approved,waiting,in-design,review,production',
            ],
            'image' => ['nullable'],
            'remove_image' => ['nullable', 'boolean'],
            'customerId' => ['nullable', 'integer', 'exists:users,id'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'orderId' => ['nullable', 'integer', 'exists:orders,id'],
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
        ]);

        $status = isset($validated['status'])
            ? Artwork::normalizeStatus($validated['status'])
            : ($isUpdate ? null : Artwork::STATUS_AWAITING_APPROVAL);

        return array_filter([
            'description' => $validated['description'] ?? null,
            'status' => $status,
            'customer_id' => $validated['customerId'] ?? $validated['customer_id'] ?? null,
            'order_id' => $validated['orderId'] ?? $validated['order_id'] ?? null,
        ], fn ($value) => $value !== null);
    }

    private function resolveOrderForUpload(Request $request, mixed $orderId): ?Order
    {
        if (! $orderId) {
            return null;
        }

        $order = Order::query()->findOrFail($orderId);
        $this->authorizeOrderArtwork($request, $order);
        abort_unless(
            $order->status === Order::STATUS_WAITING_FOR_ARTWORK,
            422,
            'Artwork can only be uploaded while the order is waiting for artwork.'
        );

        $existing = $order->artwork;
        if ($existing) {
            abort(
                422,
                $existing->isApproved()
                    ? 'This order already has approved artwork. It cannot be changed.'
                    : 'This order already has artwork. Update the existing artwork instead.'
            );
        }

        return $order;
    }

    private function authorizeOrderArtwork(Request $request, Order $order): void
    {
        if ($request->user()->isStaffOrAdmin()) {
            return;
        }

        abort_unless((int) $order->customer_id === (int) $request->user()->id, 403);
    }

    private function resolveCustomerId(Request $request, mixed $customerId): int
    {
        if (! $request->user()->isStaffOrAdmin()) {
            return (int) $request->user()->id;
        }

        abort_unless($customerId, 422, 'Customer is required.');

        return (int) $customerId;
    }

    private function resolveImage(Request $request): ?string
    {
        if ($request->hasFile('image')) {
            return $request->file('image')->store('artworks', 'public');
        }

        if ($request->hasFile('file')) {
            return $request->file('file')->store('artworks', 'public');
        }

        $content = $request->input('image');
        if (is_array($content) && ! empty($content['content'])) {
            return $this->storeBase64Image($content);
        }

        if (is_string($content) && str_starts_with($content, 'data:')) {
            return $this->storeBase64Image(['content' => $content, 'name' => 'artwork.png']);
        }

        return null;
    }

    private function storeBase64Image(array $file): ?string
    {
        $content = (string) ($file['content'] ?? '');
        if ($content === '') {
            return null;
        }

        $mime = $file['mime'] ?? null;
        if (preg_match('#^data:([^;]+);base64,#', $content, $matches)) {
            $mime = $mime ?: $matches[1];
            $content = substr($content, strpos($content, ',') + 1);
        }

        $binary = base64_decode($content, true);
        if ($binary === false) {
            return null;
        }

        $extension = match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            default => 'png',
        };

        $path = 'artworks/'.uniqid('art_', true).'.'.$extension;
        Storage::disk('public')->put($path, $binary);

        return $path;
    }

    private function authorizeAccess(Request $request, Artwork $artwork): void
    {
        if ($request->user()->isStaffOrAdmin()) {
            return;
        }

        $uid = (int) $request->user()->id;
        $ownsArtwork = (int) $artwork->customer_id === $uid || (int) $artwork->user_id === $uid;
        if (! $ownsArtwork && $artwork->order_id) {
            $order = $artwork->order ?: Order::query()->find($artwork->order_id);
            $ownsArtwork = $order && (int) $order->customer_id === $uid;
        }

        abort_unless($ownsArtwork, 403);
    }

    private function format(Artwork $artwork): array
    {
        $imageUrl = null;
        if ($artwork->image) {
            // Bust browser cache when the stored file path changes after a re-upload.
            $version = rawurlencode(basename((string) $artwork->image));
            $imageUrl = url('/api/artworks/'.$artwork->id.'/media/0').'?v='.$version;
        }

        return [
            'id' => (string) $artwork->id,
            'image' => $artwork->image,
            'imageUrl' => $imageUrl,
            'description' => $artwork->description ?? '',
            'status' => Artwork::normalizeStatus($artwork->status),
            'customerId' => $artwork->customer_id,
            'customer' => $artwork->customer?->name ?? '',
            'orderId' => $artwork->order_id ? (string) $artwork->order_id : null,
            'orderNumber' => $artwork->order?->order_id ?? '',
            'orderStatus' => $artwork->order?->status ?? null,
            'name' => $artwork->description ? mb_substr($artwork->description, 0, 40) : 'Artwork #'.$artwork->id,
            'projectName' => $artwork->description ? mb_substr($artwork->description, 0, 40) : 'Artwork #'.$artwork->id,
            'project' => '',
            'designer' => '',
            'date' => $artwork->updated_at?->format('M d, Y') ?? '',
            'files' => $imageUrl ? [['name' => basename((string) $artwork->image), 'url' => $imageUrl, 'path' => $artwork->image]] : [],
        ];
    }
}
