<?php

namespace App\Support;

use App\Models\MailSetting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

class MailConfig
{
    /** Apply portal SMTP settings to Laravel's mailer (when enabled). */
    public static function apply(): void
    {
        try {
            if (! Schema::hasTable('mail_settings')) {
                return;
            }
        } catch (\Throwable) {
            return;
        }

        $settings = MailSetting::query()->first();
        if (! $settings || ! $settings->enabled) {
            return;
        }

        $password = $settings->plainPassword();
        $encryption = $settings->encryption ?: null;
        $scheme = null;
        if ($encryption === 'ssl') {
            $scheme = 'smtps';
        }

        Config::set('mail.default', 'smtp');
        Config::set('mail.mailers.smtp', [
            'transport' => 'smtp',
            'scheme' => $scheme,
            'host' => $settings->host,
            'port' => (int) ($settings->port ?: 587),
            'username' => $settings->username,
            'password' => $password,
            'timeout' => null,
            'encryption' => $encryption,
            'local_domain' => parse_url((string) config('app.url', 'http://localhost'), PHP_URL_HOST),
        ]);

        if ($settings->from_address) {
            Config::set('mail.from.address', $settings->from_address);
            Config::set('mail.from.name', $settings->from_name ?: 'Rexapack');
        }

        // Force mail manager to rebuild with new config.
        app()->forgetInstance('mail.manager');
        Mail::clearResolvedInstances();
    }

    public static function settings(): MailSetting
    {
        return MailSetting::current();
    }

    public static function canSend(): bool
    {
        try {
            if (! Schema::hasTable('mail_settings')) {
                return false;
            }
        } catch (\Throwable) {
            return false;
        }

        return MailSetting::current()->isConfigured();
    }
}
