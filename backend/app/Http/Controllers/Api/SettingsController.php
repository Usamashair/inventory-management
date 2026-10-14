<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailSetting;
use App\Support\MailConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    public function mail(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        return response()->json([
            'data' => $this->format(MailSetting::current()),
        ]);
    }

    public function updateMail(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        $validated = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'host' => ['nullable', 'string', 'max:255'],
            'port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'encryption' => ['nullable', 'string', Rule::in(['tls', 'ssl', 'none', ''])],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:500'],
            'fromAddress' => ['nullable', 'email', 'max:255'],
            'from_address' => ['nullable', 'email', 'max:255'],
            'fromName' => ['nullable', 'string', 'max:255'],
            'from_name' => ['nullable', 'string', 'max:255'],
        ]);

        $settings = MailSetting::current();
        $encryption = $validated['encryption'] ?? $settings->encryption;
        if ($encryption === 'none' || $encryption === '') {
            $encryption = null;
        }

        $payload = [
            'enabled' => array_key_exists('enabled', $validated)
                ? (bool) $validated['enabled']
                : $settings->enabled,
            'host' => array_key_exists('host', $validated) ? $validated['host'] : $settings->host,
            'port' => array_key_exists('port', $validated) ? (int) $validated['port'] : $settings->port,
            'encryption' => array_key_exists('encryption', $validated) ? $encryption : $settings->encryption,
            'username' => array_key_exists('username', $validated) ? $validated['username'] : $settings->username,
            'from_address' => $validated['fromAddress']
                ?? $validated['from_address']
                ?? $settings->from_address,
            'from_name' => $validated['fromName']
                ?? $validated['from_name']
                ?? $settings->from_name,
        ];

        if (! empty($validated['password'])) {
            $payload['password'] = $validated['password'];
        }

        $settings->fill($payload);
        $settings->save();

        MailConfig::apply();

        return response()->json([
            'message' => 'SMTP settings saved.',
            'data' => $this->format($settings->fresh()),
        ]);
    }

    public function testMail(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        $validated = $request->validate([
            'to' => ['required', 'email'],
        ]);

        $settings = MailSetting::current();
        abort_unless($settings->isConfigured(), 422, 'Enable SMTP and fill host, port, username, password, and from address first.');

        MailConfig::apply();

        try {
            Mail::raw(
                "This is a Rexapack portal test email.\n\nIf you received this, your SMTP settings are working.",
                function ($message) use ($validated, $settings) {
                    $message->to($validated['to'])
                        ->subject('Rexapack SMTP test');
                    if ($settings->from_address) {
                        $message->from(
                            $settings->from_address,
                            $settings->from_name ?: 'Rexapack'
                        );
                    }
                }
            );
        } catch (\Throwable $error) {
            return response()->json([
                'message' => 'Failed to send test email: '.$error->getMessage(),
            ], 422);
        }

        return response()->json([
            'message' => 'Test email sent to '.$validated['to'].'.',
        ]);
    }

    private function format(MailSetting $settings): array
    {
        return [
            'enabled' => (bool) $settings->enabled,
            'host' => $settings->host ?? '',
            'port' => (int) ($settings->port ?: 587),
            'encryption' => $settings->encryption ?: 'none',
            'username' => $settings->username ?? '',
            'hasPassword' => $settings->hasPassword(),
            'fromAddress' => $settings->from_address ?? '',
            'fromName' => $settings->from_name ?? '',
            'isConfigured' => $settings->isConfigured(),
        ];
    }
}
