<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quotation;
use App\Models\QuotationMessage;
use App\Support\PortalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuotationMessageController extends Controller
{
    public function index(Request $request, Quotation $quotation): JsonResponse
    {
        $this->authorizeAccess($request, $quotation);

        $messages = $quotation->messages()
            ->with('user')
            ->orderBy('created_at')
            ->get()
            ->map(fn (QuotationMessage $message) => $this->format($message));

        return response()->json(['data' => $messages]);
    }

    public function store(Request $request, Quotation $quotation): JsonResponse
    {
        $this->authorizeAccess($request, $quotation);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = $quotation->messages()->create([
            'user_id' => $request->user()->id,
            'body' => trim($validated['body']),
        ]);

        $message = $message->load('user');
        $quoteLabel = $quotation->quote_id ?: '#'.$quotation->id;
        $sender = $request->user();
        $preview = mb_strimwidth(trim($validated['body']), 0, 120, '…');

        if ($sender->isStaffOrAdmin()) {
            PortalNotifier::notifyCustomer(
                (int) $quotation->customer_id,
                'quotation.message',
                'quotation',
                'New quotation message',
                "{$sender->name} commented on {$quoteLabel}: {$preview}",
                '/dashboard/quotations/'.$quotation->id,
                $quotation,
            );
        } else {
            PortalNotifier::notifyStaff(
                'quotation.message',
                'quotation',
                'New quotation message',
                "{$sender->name} commented on {$quoteLabel}: {$preview}",
                '/dashboard/quotations/'.$quotation->id,
                $quotation,
            );
        }

        return response()->json([
            'message' => 'Message sent.',
            'data' => $this->format($message),
        ], 201);
    }

    private function authorizeAccess(Request $request, Quotation $quotation): void
    {
        if ($request->user()->isStaffOrAdmin()) {
            return;
        }

        abort_unless((int) $quotation->customer_id === (int) $request->user()->id, 403);
    }

    private function format(QuotationMessage $message): array
    {
        $user = $message->user;

        return [
            'id' => (string) $message->id,
            'body' => $message->body,
            'createdAt' => $message->created_at?->toIso8601String(),
            'createdAtLabel' => $message->created_at?->format('M d, Y g:i A') ?? '',
            'userId' => $message->user_id,
            'userName' => $user?->name ?? 'User',
            'userRole' => $user?->role ?? 'customer',
            'isStaff' => $user ? in_array($user->role, ['admin', 'staff'], true) : false,
        ];
    }
}
