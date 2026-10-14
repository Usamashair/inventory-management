<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Artwork;
use App\Models\DeliveryRequest;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\PortalNotification;
use App\Models\Quotation;
use App\Models\QuotationMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ActivityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['nullable', 'string', 'max:40'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:300'],
        ]);

        $limit = $validated['limit'] ?? 200;
        $category = $validated['category'] ?? null;
        $staff = $request->user()->isStaffOrAdmin();
        $userId = (int) $request->user()->id;

        $events = collect()
            ->merge($this->fromNotifications($staff, $userId))
            ->merge($this->fromQuotations($staff, $userId))
            ->merge($this->fromOrders($staff, $userId))
            ->merge($this->fromArtworks($staff, $userId))
            ->merge($this->fromInvoices($staff, $userId))
            ->merge($this->fromCallOffs($staff, $userId))
            ->merge($this->fromQuotationMessages($staff, $userId));

        if ($category && $category !== 'all') {
            $events = $events->filter(fn (array $event) => ($event['category'] ?? '') === $category)->values();
        }

        $events = $events
            ->sortByDesc(fn (array $event) => $event['sortAt'] ?? '')
            ->unique(fn (array $event) => $event['dedupeKey'] ?? $event['id'])
            ->values()
            ->take($limit)
            ->map(function (array $event) {
                unset($event['dedupeKey'], $event['sortAt']);

                return $event;
            })
            ->values();

        return response()->json([
            'data' => $events,
            'total' => $events->count(),
        ]);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function fromNotifications(bool $staff, int $userId): Collection
    {
        if (! class_exists(PortalNotification::class)) {
            return collect();
        }

        try {
            $query = PortalNotification::query()->latest();
            if (! $staff) {
                $query->where('user_id', $userId);
            }

            return $query->limit(300)->get()->map(function (PortalNotification $notification) {
                $created = $notification->created_at;

                return $this->event(
                    id: 'n-'.$notification->id,
                    dedupeKey: implode('|', [
                        $notification->type,
                        (string) $notification->notifiable_type,
                        (string) $notification->notifiable_id,
                        $created?->format('Y-m-d H:i') ?? '',
                    ]),
                    category: $notification->category,
                    type: $notification->type,
                    title: $notification->title,
                    detail: $notification->message,
                    href: $notification->href,
                    at: $created,
                );
            });
        } catch (\Throwable) {
            return collect();
        }
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function fromQuotations(bool $staff, int $userId): Collection
    {
        $query = Quotation::query()->with('customer')->latest();
        if (! $staff) {
            $query->where('customer_id', $userId);
        }

        return $query->limit(150)->get()->map(function (Quotation $quotation) {
            $status = (string) $quotation->status;
            $label = $quotation->quote_id ?: '#'.$quotation->id;
            $customer = $quotation->customer?->name;

            [$title, $detail] = match ($status) {
                'draft' => ['Quotation drafted', "{$label} was created as a draft."],
                'sent' => ['Quotation sent', "{$label} was sent for customer review."],
                'under-review' => ['Quotation under review', "{$label} is under review."],
                'approved' => ['Quotation approved', "{$label} was approved by the customer."],
                'rejected' => ['Quotation rejected', "{$label} was rejected by the customer."],
                'expired' => ['Quotation expired', "{$label} has expired."],
                default => ['Quotation updated', "{$label} status is {$status}."],
            };

            if ($customer) {
                $detail .= " · {$customer}";
            }
            if ($quotation->product) {
                $detail .= ' · '.$quotation->product;
            }

            return $this->event(
                id: 'q-'.$quotation->id.'-'.$status,
                dedupeKey: 'quotation|'.$quotation->id.'|'.$status,
                category: 'quotation',
                type: 'quotation.'.$status,
                title: $title,
                detail: $detail,
                href: '/dashboard/quotations/'.$quotation->id,
                at: $quotation->updated_at ?: $quotation->created_at,
                fallbackDate: $quotation->date,
            );
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function fromOrders(bool $staff, int $userId): Collection
    {
        $query = Order::query()->with('customer')->latest();
        if (! $staff) {
            $query->where('customer_id', $userId);
        }

        return $query->limit(150)->get()->map(function (Order $order) {
            $status = Order::normalizeStatus((string) $order->status);
            $label = $order->order_id ?: '#'.$order->id;
            $customer = $order->customer?->name;

            [$title, $detail] = match ($status) {
                Order::STATUS_WAITING_FOR_ARTWORK => ['Order awaiting artwork', "{$label} is waiting for artwork upload."],
                Order::STATUS_IN_PRODUCTION => ['Order in production', "{$label} is in production."],
                Order::STATUS_IN_TRANSIT => ['Order in transit', "{$label} is in transit."],
                Order::STATUS_DELIVERED => ['Order delivered', "{$label} was delivered."],
                default => ['Order updated', "{$label} status is {$status}."],
            };

            if ($customer) {
                $detail .= " · {$customer}";
            }
            if ($order->product) {
                $detail .= ' · '.$order->product;
            }

            return $this->event(
                id: 'o-'.$order->id.'-'.$status,
                dedupeKey: 'order|'.$order->id.'|'.$status,
                category: 'order',
                type: 'order.'.$status,
                title: $title,
                detail: $detail,
                href: '/dashboard/orders/'.$order->id,
                at: $order->updated_at ?: $order->created_at,
                fallbackDate: $order->delivery_date ?: $order->date,
            );
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function fromArtworks(bool $staff, int $userId): Collection
    {
        $query = Artwork::query()->with(['customer', 'order.customer'])->latest();
        if (! $staff) {
            $query->where(function ($builder) use ($userId) {
                $builder->where('customer_id', $userId)
                    ->orWhere('user_id', $userId)
                    ->orWhereHas('order', fn ($q) => $q->where('customer_id', $userId));
            });
        }

        return $query->limit(150)->get()->map(function (Artwork $artwork) {
            $status = Artwork::normalizeStatus((string) $artwork->status);
            $name = $artwork->description ?: ('Artwork #'.$artwork->id);
            $orderLabel = $artwork->order?->order_id;
            $customer = $artwork->customer?->name ?: $artwork->order?->customer?->name;

            [$title, $detail] = match ($status) {
                Artwork::STATUS_AWAITING_APPROVAL => ['Artwork received', "{$name} was uploaded and awaits approval."],
                Artwork::STATUS_REVISION_REQUESTED => ['Artwork revision requested', "Revision requested for {$name}."],
                Artwork::STATUS_REVISION_SENT => ['Artwork revision sent', "A revised file was uploaded for {$name}."],
                Artwork::STATUS_APPROVED => ['Artwork approved', "{$name} was approved."],
                default => ['Artwork updated', "{$name} status is {$status}."],
            };

            if ($orderLabel) {
                $detail .= " · {$orderLabel}";
            }
            if ($customer) {
                $detail .= " · {$customer}";
            }

            return $this->event(
                id: 'a-'.$artwork->id.'-'.$status,
                dedupeKey: 'artwork|'.$artwork->id.'|'.$status,
                category: 'artwork',
                type: 'artwork.'.$status,
                title: $title,
                detail: $detail,
                href: '/dashboard/artwork/'.$artwork->id,
                at: $artwork->updated_at ?: $artwork->created_at,
            );
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function fromInvoices(bool $staff, int $userId): Collection
    {
        $query = Invoice::query()->with(['customer', 'order'])->latest();
        if (! $staff) {
            $query->where(function ($builder) use ($userId) {
                $builder->where('customer_id', $userId)->orWhere('user_id', $userId);
            });
        }

        return $query->limit(150)->get()->map(function (Invoice $invoice) {
            $status = (string) $invoice->status;
            $label = $invoice->invoice_no ?: '#'.$invoice->id;
            $customer = $invoice->customer?->name;
            $orderLabel = $invoice->order?->order_id;

            [$title, $detail] = match ($status) {
                'pending' => ['Invoice created', "{$label} was issued and is pending payment."],
                'partially-paid' => ['Invoice partially paid', "{$label} is partially paid."],
                'paid' => ['Invoice paid', "{$label} was marked as paid."],
                'overdue' => ['Invoice overdue', "{$label} is overdue."],
                'draft' => ['Invoice drafted', "{$label} is in draft."],
                default => ['Invoice updated', "{$label} status is {$status}."],
            };

            if ($invoice->amount) {
                $detail .= ' · $'.$invoice->amount;
            }
            if ($orderLabel) {
                $detail .= " · {$orderLabel}";
            }
            if ($customer) {
                $detail .= " · {$customer}";
            }

            return $this->event(
                id: 'i-'.$invoice->id.'-'.$status,
                dedupeKey: 'invoice|'.$invoice->id.'|'.$status,
                category: 'invoice',
                type: 'invoice.'.$status,
                title: $title,
                detail: $detail,
                href: '/dashboard/invoices/'.$invoice->id,
                at: $invoice->updated_at ?: $invoice->created_at,
                fallbackDate: $invoice->issue_date,
            );
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function fromCallOffs(bool $staff, int $userId): Collection
    {
        $query = DeliveryRequest::query()->with(['customer', 'warehouse', 'items.product'])->latest();
        if (! $staff) {
            $query->where('customer_id', $userId);
        }

        return $query->limit(100)->get()->map(function (DeliveryRequest $request) {
            $status = (string) $request->status;
            $label = $request->request_id ?: '#'.$request->id;
            $customer = $request->customer?->name;
            $products = $request->items
                ->map(fn ($item) => ($item->product?->product ?: 'Product').' ('.$item->quantity.')')
                ->filter()
                ->implode(', ');

            [$title, $detail] = match ($status) {
                'pending' => ['Call-off requested', "{$label} was submitted and is pending fulfillment."],
                'fulfilled' => ['Call-off fulfilled', "{$label} was fulfilled."],
                'rejected' => ['Call-off rejected', "{$label} was rejected."],
                default => ['Call-off updated', "{$label} status is {$status}."],
            };

            if ($request->warehouse?->name) {
                $detail .= ' · '.$request->warehouse->name;
            }
            if ($products) {
                $detail .= ' · '.$products;
            }
            if ($customer) {
                $detail .= " · {$customer}";
            }

            return $this->event(
                id: 'dr-'.$request->id.'-'.$status,
                dedupeKey: 'call-off|'.$request->id.'|'.$status,
                category: 'call-off',
                type: 'calloff.'.$status,
                title: $title,
                detail: $detail,
                href: '/dashboard/call-offs',
                at: $request->fulfilled_at ?: $request->updated_at ?: $request->created_at,
            );
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function fromQuotationMessages(bool $staff, int $userId): Collection
    {
        $query = QuotationMessage::query()
            ->with(['user', 'quotation.customer'])
            ->latest()
            ->limit(100);

        if (! $staff) {
            $query->whereHas('quotation', fn ($q) => $q->where('customer_id', $userId));
        }

        return $query->get()->map(function (QuotationMessage $message) {
            $quote = $message->quotation;
            $quoteLabel = $quote?->quote_id ?: ($quote ? '#'.$quote->id : 'quotation');
            $sender = $message->user?->name ?: 'User';
            $preview = mb_strimwidth(trim((string) $message->body), 0, 120, '…');

            return $this->event(
                id: 'qm-'.$message->id,
                dedupeKey: 'quotation.message|'.$message->id,
                category: 'quotation',
                type: 'quotation.message',
                title: 'Quotation message',
                detail: "{$sender} on {$quoteLabel}: {$preview}",
                href: $quote ? '/dashboard/quotations/'.$quote->id : '/dashboard/quotations',
                at: $message->created_at,
            );
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function event(
        string $id,
        string $dedupeKey,
        string $category,
        string $type,
        string $title,
        string $detail,
        ?string $href,
        mixed $at = null,
        ?string $fallbackDate = null,
    ): array {
        $carbon = null;
        if ($at instanceof Carbon) {
            $carbon = $at;
        } elseif (is_string($at) && $at !== '') {
            try {
                $carbon = Carbon::parse($at);
            } catch (\Throwable) {
                $carbon = null;
            }
        }

        return [
            'id' => $id,
            'dedupeKey' => $dedupeKey,
            'category' => $category,
            'type' => $type,
            'title' => $title,
            'detail' => $detail,
            'href' => $href,
            'date' => $carbon?->format('M j, Y g:i A') ?: ($fallbackDate ?: '—'),
            'dateLabel' => $carbon?->diffForHumans() ?: ($fallbackDate ?: '—'),
            'sortAt' => $carbon?->toIso8601String() ?: ($fallbackDate ?: '1970-01-01'),
        ];
    }
}
