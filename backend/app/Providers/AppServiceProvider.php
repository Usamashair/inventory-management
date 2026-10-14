<?php

namespace App\Providers;

use App\Support\MailConfig;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        try {
            MailConfig::apply();
        } catch (\Throwable) {
            // DB may be unavailable during install / migrate.
        }
    }
}
