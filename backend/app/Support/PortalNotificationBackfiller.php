<?php

namespace App\Support;

use App\Models\Artwork;
use App\Models\DeliveryRequest;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\PortalNotification;
use App\Models\Quotation;
use App\Models\QuotationMessage;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

class PortalNotificationBackfiller
{
    /**
     * Seed the user's inbox from existing portal records when it is empty.
     * Safe to call repeatedly — only runs when the user has zero notifications.
     */
    public static function ensureFor(User $user): void
    {
        if (! Schema::hasTable('portal_notifications')) {
            return;
        }

        if (PortalNotification::query()->where('user_id', $user->id)->exists()) {
            return;
        }

        $staff = $user->isStaffOrAdmin();
        $userId = (int) $user->id;
        $rows = [];

        foreach (self::fromQuotations($staff, $userId) as $row) {
            $rows[] = $row;
        }
        foreach (self::fromOrders($staff, $userId) as $row) {
            $rows[] = $row;
        }
        foreach (self::fromArtworks($staff, $userId) as $row) {
            $rows[] = $row;
        }
        foreach (self::fromInvoices($staff, $userId) as $row) {
            $rows[] = $row;
        }
        foreach (self::fromCallOffs($staff, $userId) as $row) {
            $rows[] = $row;
        }
        foreach (self::fromMessages($staff, $userId) as $row) {
            $rows[] = $row;
        }

        usort($rows, function (array $a, array $b) {
            return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
        });

        $rows = array_slice($rows, 0, 120);
        $cutoff = now()->subDays(7);

        foreach ($rows as $row) {
            $createdAt = Carbon::parse($row['created_at'] ?? now());
            $notification = new PortalNotification([
                'user_id' => $userId,
                'type' => $row['type'],
                'category' => $row['category'],
                'title' => $row['title'],
                'message' => $row['message'],
                'href' => $row['href'],
                'notifiable_type' => $row['notifiable_type'] ?? null,
                'notifiable_id' => $row['notifiable_id'] ?? null,
                'meta' => ['backfilled' => true],
                'read_at' => $createdAt->lt($cutoff) ? $createdAt : null,
            ]);
            $notification->created_at = $createdAt;
            $notification->updated_at = $createdAt;
            $notification->save();
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function fromQuotations(bool $staff, int $userId): array
    {
        $query = Quotation::query()->with('customer')->latest();
        if (! $staff) {
            $query->where('customer_id', $userId);
        }

        return $query->limit(80)->get()->map(function (Quotation $quotation) {
            $status = (string) $quotation->status;
            $label = $quotation->quote_id ?: '#'.$quotation->id;
            $customer = $quotation->customer?->name;

            [$title, $message] = match ($status) {
                'draft' => ['Quotation drafted', "{$label} was created as a draft."],
                'sent' => ['Quotation sent', "{$label} was sent for customer review."],
                'under-review' => ['Quotation under review', "{$label} is under review."],
                'approved' => ['Quotation approved', "{$label} was approved by the customer."],
                'rejected' => ['Quotation rejected', "{$label} was rejected by the customer."],
                'expired' => ['Quotation expired', "{$label} has expired."],
                default => ['Quotation updated', "{$label} status is {$status}."],
            };

            if ($customer) {
                $message .= " · {$customer}";
            }

            return [
                'type' => 'quotation.'.$status,
                'category' => 'quotation',
                'title' => $title,
                'message' => $message,
                'href' => '/dashboard/quotations/'.$quotation->id,
                'notifiable_type' => Quotation::class,
                'notifiable_id' => $quotation->id,
                'created_at' => ($quotation->updated_at ?: $quotation->created_at)?->toDateTimeString() ?? now()->toDateTimeString(),
            ];
        })->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function fromOrders(bool $staff, int $userId): array
    {
        $query = Order::query()->with('customer')->latest();
        if (! $staff) {
            $query->where('customer_id', $userId);
        }

        return $query->limit(80)->get()->map(function (Order $order) {
            $status = Order::normalizeStatus((string) $order->status);
            $label = $order->order_id ?: '#'.$order->id;
            $customer = $order->customer?->name;

            [$title, $message] = match ($status) {
                Order::STATUS_WAITING_FOR_ARTWORK => ['Order awaiting artwork', "{$label} is waiting for artwork upload."],
                Order::STATUS_IN_PRODUCTION => ['Order in production', "{$label} is in production."],
                Order::STATUS_IN_TRANSIT => ['Order in transit', "{$label} is in transit."],
                Order::STATUS_DELIVERED => ['Order delivered', "{$label} was delivered."],
                default => ['Order updated', "{$label} status is {$status}."],
            };

            if ($customer) {
                $message .= " · {$customer}";
            }

            return [
                'type' => 'order.'.$status,
                'category' => 'order',
                'title' => $title,
                'message' => $message,
                'href' => '/dashboard/orders/'.$order->id,
                'notifiable_type' => Order::class,
                'notifiable_id' => $order->id,
                'created_at' => ($order->updated_at ?: $order->created_at)?->toDateTimeString() ?? now()->toDateTimeString(),
            ];
        })->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function fromArtworks(bool $staff, int $userId): array
    {
        $query = Artwork::query()->with(['customer', 'order.customer'])->latest();
        if (! $staff) {
            $query->where(function ($builder) use ($userId) {
                $builder->where('customer_id', $userId)
                    ->orWhere('user_id', $userId)
                    ->orWhereHas('order', fn ($q) => $q->where('customer_id', $userId));
            });
        }

        return $query->limit(80)->get()->map(function (Artwork $artwork) {
            $status = Artwork::normalizeStatus((string) $artwork->status);
            $name = $artwork->description ?: ('Artwork #'.$artwork->id);
            $customer = $artwork->customer?->name ?: $artwork->order?->customer?->name;

            [$title, $message] = match ($status) {
                Artwork::STATUS_AWAITING_APPROVAL => ['Artwork received', "{$name} was uploaded and awaits approval."],
                Artwork::STATUS_REVISION_REQUESTED => ['Artwork revision requested', "Revision requested for {$name}."],
                Artwork::STATUS_REVISION_SENT => ['Artwork revision sent', "A revised file was uploaded for {$name}."],
                Artwork::STATUS_APPROVED => ['Artwork approved', "{$name} was approved."],
                default => ['Artwork updated', "{$name} status is {$status}."],
            };

            if ($customer) {
                $message .= " · {$customer}";
            }

            return [
                'type' => 'artwork.'.$status,
                'category' => 'artwork',
                'title' => $title,
                'message' => $message,
                'href' => '/dashboard/artwork/'.$artwork->id,
                'notifiable_type' => Artwork::class,
                'notifiable_id' => $artwork->id,
                'created_at' => ($artwork->updated_at ?: $artwork->created_at)?->toDateTimeString() ?? now()->toDateTimeString(),
            ];
        })->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function fromInvoices(bool $staff, int $userId): array
    {
        $query = Invoice::query()->with(['customer', 'order'])->latest();
        if (! $staff) {
            $query->where(function ($builder) use ($userId) {
                $builder->where('customer_id', $userId)->orWhere('user_id', $userId);
            });
        }

        return $query->limit(80)->get()->map(function (Invoice $invoice) {
            $status = (string) $invoice->status;
            $label = $invoice->invoice_no ?: '#'.$invoice->id;
            $customer = $invoice->customer?->name;

            [$title, $message] = match ($status) {
                'pending' => ['Invoice created', "{$label} was issued and is pending payment."],
                'partially-paid' => ['Invoice partially paid', "{$label} is partially paid."],
                'paid' => ['Invoice paid', "{$label} was marked as paid."],
                'overdue' => ['Invoice overdue', "{$label} is overdue."],
                'draft' => ['Invoice drafted', "{$label} is in draft."],
                default => ['Invoice updated', "{$label} status is {$status}."],
            };

            if ($invoice->amount) {
                $message .= ' · $'.$invoice->amount;
            }
            if ($customer) {
                $message .= " · {$customer}";
            }

            return [
                'type' => 'invoice.'.$status,
                'category' => 'invoice',
                'title' => $title,
                'message' => $message,
                'href' => '/dashboard/invoices/'.$invoice->id,
                'notifiable_type' => Invoice::class,
                'notifiable_id' => $invoice->id,
                'created_at' => ($invoice->updated_at ?: $invoice->created_at)?->toDateTimeString() ?? now()->toDateTimeString(),
            ];
        })->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function fromCallOffs(bool $staff, int $userId): array
    {
        $query = DeliveryRequest::query()->with(['customer', 'warehouse'])->latest();
        if (! $staff) {
            $query->where('customer_id', $userId);
        }

        return $query->limit(60)->get()->map(function (DeliveryRequest $request) {
            $status = (string) $request->status;
            $label = $request->request_id ?: '#'.$request->id;
            $customer = $request->customer?->name;
            $warehouse = $request->warehouse?->name;

            [$title, $message] = match ($status) {
                'pending' => ['Call-off requested', "{$label} was submitted and awaits fulfilment."],
                'approved' => ['Call-off approved', "{$label} was approved."],
                'fulfilled' => ['Call-off fulfilled', "{$label} was fulfilled."],
                'rejected' => ['Call-off rejected', "{$label} was rejected."],
                default => ['Call-off updated', "{$label} status is {$status}."],
            };

            if ($warehouse) {
                $message .= " · {$warehouse}";
            }
            if ($customer) {
                $message .= " · {$customer}";
            }

            return [
                'type' => 'call-off.'.$status,
                'category' => 'call-off',
                'title' => $title,
                'message' => $message,
                'href' => '/dashboard/call-offs',
                'notifiable_type' => DeliveryRequest::class,
                'notifiable_id' => $request->id,
                'created_at' => ($request->updated_at ?: $request->created_at)?->toDateTimeString() ?? now()->toDateTimeString(),
            ];
        })->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function fromMessages(bool $staff, int $userId): array
    {
        $query = QuotationMessage::query()->with(['quotation.customer', 'user'])->latest();
        if (! $staff) {
            $query->whereHas('quotation', fn ($q) => $q->where('customer_id', $userId));
        }

        return $query->limit(60)->get()->map(function (QuotationMessage $message) {
            $quote = $message->quotation;
            $label = $quote?->quote_id ?: '#'.($quote?->id ?? $message->quotation_id);
            $author = $message->user?->name ?: 'Someone';
            $preview = mb_strimwidth(trim((string) $message->body), 0, 120, '…');

            return [
                'type' => 'quotation.message',
                'category' => 'quotation',
                'title' => "New message on {$label}",
                'message' => "{$author}: {$preview}",
                'href' => '/dashboard/quotations/'.($quote?->id ?? $message->quotation_id),
                'notifiable_type' => QuotationMessage::class,
                'notifiable_id' => $message->id,
                'created_at' => ($message->created_at)?->toDateTimeString() ?? now()->toDateTimeString(),
            ];
        })->all();
    }
}
