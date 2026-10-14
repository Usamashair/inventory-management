<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders') && ! Schema::hasColumn('orders', 'customer_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->foreignId('customer_id')
                    ->nullable()
                    ->after('date')
                    ->constrained('users')
                    ->nullOnDelete();
            });

            $fallbackCustomerId = DB::table('users')->where('role', 'customer')->value('id')
                ?? DB::table('users')->value('id');

            if ($fallbackCustomerId) {
                DB::table('orders')->whereNull('customer_id')->update([
                    'customer_id' => $fallbackCustomerId,
                ]);
            }
        }

        if (Schema::hasTable('artworks') && ! Schema::hasColumn('artworks', 'customer_id')) {
            Schema::table('artworks', function (Blueprint $table) {
                $table->foreignId('customer_id')
                    ->nullable()
                    ->after('status')
                    ->constrained('users')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'customer_id')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropConstrainedForeignId('customer_id');
            });
        }

        if (Schema::hasTable('artworks') && Schema::hasColumn('artworks', 'customer_id')) {
            Schema::table('artworks', function (Blueprint $table) {
                $table->dropConstrainedForeignId('customer_id');
            });
        }
    }
};
