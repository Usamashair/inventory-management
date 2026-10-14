<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // product_id on orders is handled by later restructure migration.
        // Keep this migration only for quotations on older installs.
        if (Schema::hasTable('quotations') && ! Schema::hasColumn('quotations', 'product_id')) {
            Schema::table('quotations', function (Blueprint $table) {
                $table->foreignId('product_id')
                    ->nullable()
                    ->after('date')
                    ->constrained('products')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('quotations') && Schema::hasColumn('quotations', 'product_id')) {
            Schema::table('quotations', function (Blueprint $table) {
                $table->dropConstrainedForeignId('product_id');
            });
        }
    }
};
