<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Support\PortalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Invoice::query()->with(['customer', 'order.items.product', 'order.items.warehouse'])->latest();

        if (! $request->user()->isStaffOrAdmin()) {
            $query->where(function ($builder) use ($request) {
                $builder->where('customer_id', $request->user()->id)
                    ->orWhere('user_id', $request->user()->id);
            });
        }

        $invoices = $query->get()->map(fn (Invoice $invoice) => $this->format($invoice));

        return response()->json(['data' => $invoices]);
    }

    public function store(Request $request): JsonResponse
    {
        abort(422, 'Invoices are created automatically when an order is delivered.');
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizeAccess($request, $invoice);

        return response()->json([
            'data' => $this->format(
                $invoice->load(['customer', 'order.items.product', 'order.items.warehouse'])
            ),
        ]);
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        abort(422, 'Invoices cannot be edited.');
    }

    public function markPaid(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        $this->authorizeAccess($request, $invoice);
        abort_if($invoice->status === 'paid', 422, 'Invoice is already marked as paid.');

        $amount = (string) ($invoice->amount ?: '0');
        $invoice->update([
            'status' => 'paid',
            'paid' => $amount,
        ]);
        $invoice = $invoice->fresh()->load(['customer', 'order.items.product', 'order.items.warehouse']);

        $label = $invoice->invoice_no ?: '#'.$invoice->id;
        PortalNotifier::notifyCustomer(
            (int) $invoice->customer_id,
            'invoice.paid',
            'invoice',
            'Invoice paid',
            "{$label} has been marked as paid.",
            '/dashboard/invoices/'.$invoice->id,
            $invoice,
        );
        PortalNotifier::notifyStaff(
            'invoice.paid',
            'invoice',
            'Invoice paid',
            "{$label} was marked as paid.",
            '/dashboard/invoices/'.$invoice->id,
            $invoice,
            exceptUserId: (int) $request->user()->id,
        );

        return response()->json([
            'message' => 'Invoice marked as paid.',
            'data' => $this->format($invoice),
        ]);
    }

    public function downloaded(Request $request, Invoice $invoice): JsonResponse
    {
        $this->authorizeAccess($request, $invoice);

        $label = $invoice->invoice_no ?: '#'.$invoice->id;
        $actor = $request->user();
        $href = '/dashboard/invoices/'.$invoice->id;

        if ($actor->isStaffOrAdmin()) {
            PortalNotifier::notifyCustomer(
                (int) $invoice->customer_id,
                'invoice.downloaded',
                'invoice',
                'Invoice downloaded',
                "{$label} was downloaded by Rexapack staff.",
                $href,
                $invoice,
            );
            PortalNotifier::notifyStaff(
                'invoice.downloaded',
                'invoice',
                'Invoice downloaded',
                "{$label} was downloaded by {$actor->name}.",
                $href,
                $invoice,
                exceptUserId: (int) $actor->id,
            );
        } else {
            PortalNotifier::notifyStaff(
                'invoice.downloaded',
                'invoice',
                'Invoice downloaded',
                "{$label} was downloaded by ".($actor->name ?: 'customer').'.',
                $href,
                $invoice,
            );
        }

        return response()->json(['message' => 'Download recorded.']);
    }

    public function destroy(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        $this->authorizeAccess($request, $invoice);
        $invoice->delete();

        return response()->json(['message' => 'Invoice deleted successfully.']);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $validated = $request->validate([
            'invoiceNo' => [
                $ignoreId ? 'sometimes' : 'nullable',
                'string',
                'max:255',
                Rule::unique('invoices', 'invoice_no')->ignore($ignoreId),
            ],
            'invoice_no' => ['nullable', 'string', 'max:255'],
            'issueDate' => ['nullable', 'string', 'max:100'],
            'issue_date' => ['nullable', 'string', 'max:100'],
            'dueDate' => ['nullable', 'string', 'max:100'],
            'due_date' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'amount' => ['nullable', 'string', 'max:255'],
            'paid' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'in:draft,pending,partially-paid,paid,overdue'],
            'items' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
            'orderId' => ['nullable', 'integer', 'exists:orders,id'],
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
            'customerId' => ['nullable', 'integer', 'exists:users,id'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'quotationId' => ['nullable', 'integer', 'exists:quotations,id'],
            'quotation_id' => ['nullable', 'integer', 'exists:quotations,id'],
        ]);

        return array_filter([
            'invoice_no' => $validated['invoiceNo'] ?? $validated['invoice_no'] ?? null,
            'issue_date' => $validated['issueDate'] ?? $validated['issue_date'] ?? null,
            'due_date' => $validated['dueDate'] ?? $validated['due_date'] ?? null,
            'description' => $validated['description'] ?? null,
            'amount' => $validated['amount'] ?? null,
            'paid' => $validated['paid'] ?? ($ignoreId ? null : '0'),
            'status' => $validated['status'] ?? ($ignoreId ? null : 'draft'),
            'items' => $validated['items'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'order_id' => $validated['orderId'] ?? $validated['order_id'] ?? null,
            'customer_id' => $validated['customerId'] ?? $validated['customer_id'] ?? null,
            'quotation_id' => $validated['quotationId'] ?? $validated['quotation_id'] ?? null,
        ], fn ($value) => $value !== null);
    }

    private function authorizeAccess(Request $request, Invoice $invoice): void
    {
        if ($request->user()->isStaffOrAdmin()) {
            return;
        }

        abort_unless(
            (int) $invoice->customer_id === (int) $request->user()->id
            || (int) $invoice->user_id === (int) $request->user()->id,
            403
        );
    }

    private function format(Invoice $invoice): array
    {
        $order = $invoice->relationLoaded('order') ? $invoice->order : $invoice->order()->with(['items.product', 'items.warehouse'])->first();
        $customer = $invoice->relationLoaded('customer') ? $invoice->customer : $invoice->customer()->first();

        $lineItems = [];
        if ($order && $order->relationLoaded('items') && $order->items->isNotEmpty()) {
            $lineItems = $order->items->map(function ($item) {
                return [
                    'id' => (string) $item->id,
                    'description' => $item->product?->product
                        ?: ($item->product?->sku ? 'SKU '.$item->product->sku : 'Order item'),
                    'sku' => $item->product?->sku ?? '',
                    'quantity' => $item->qty ?? '0',
                    'unitPrice' => number_format((float) $item->price, 2, '.', ''),
                    'total' => number_format((float) $item->sub_total, 2, '.', ''),
                    'warehouse' => $item->warehouse?->name ?? '',
                ];
            })->values()->all();
        } elseif (! empty($invoice->description) || ! empty($invoice->amount)) {
            $lineItems = [[
                'id' => 'summary',
                'description' => $invoice->description ?: ('Invoice '.$invoice->invoice_no),
                'sku' => '',
                'quantity' => (string) ($invoice->items ?: 1),
                'unitPrice' => number_format((float) preg_replace('/[^0-9.]/', '', (string) ($invoice->amount ?? '0')), 2, '.', ''),
                'total' => number_format((float) preg_replace('/[^0-9.]/', '', (string) ($invoice->amount ?? '0')), 2, '.', ''),
                'warehouse' => '',
            ]];
        }

        $amount = number_format((float) preg_replace('/[^0-9.]/', '', (string) ($invoice->amount ?? '0')), 2, '.', '');
        $paid = number_format((float) preg_replace('/[^0-9.]/', '', (string) ($invoice->paid ?? '0')), 2, '.', '');
        $balance = number_format(max(0, (float) $amount - (float) $paid), 2, '.', '');

        return [
            'id' => (string) $invoice->id,
            'invoiceNo' => $invoice->invoice_no,
            'date' => $invoice->issue_date ?? '',
            'issueDate' => $invoice->issue_date ?? '',
            'dueDate' => $invoice->due_date ?? '',
            'description' => $invoice->description ?? '',
            'amount' => $amount,
            'paid' => $paid,
            'balance' => $balance,
            'status' => $invoice->status,
            'items' => count($lineItems) ?: (int) ($invoice->items ?? 0),
            'lineItems' => $lineItems,
            'notes' => $invoice->notes ?? '',
            'orderId' => $invoice->order_id ? (string) $invoice->order_id : null,
            'orderNumber' => $order?->order_id ?? '',
            'customerId' => $invoice->customer_id,
            'customer' => $customer?->name ?? '',
            'customerEmail' => $customer?->email ?? '',
            'customerPhone' => $customer?->phone ?? '',
            'customerAddress' => trim(collect([
                $customer?->address,
                $customer?->city,
                $customer?->post_code,
            ])->filter()->implode(', ')),
            'quotationId' => $invoice->quotation_id,
        ];
    }
}
