<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (! Schema::hasColumn('invoices', 'order_id')) {
                $table->foreignId('order_id')->nullable()->after('user_id')->constrained('orders')->nullOnDelete();
                $table->unique('order_id');
            }
            if (! Schema::hasColumn('invoices', 'customer_id')) {
                $table->foreignId('customer_id')->nullable()->after('order_id')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('invoices', 'quotation_id')) {
                $table->foreignId('quotation_id')->nullable()->after('customer_id')->constrained('quotations')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (Schema::hasColumn('invoices', 'order_id')) {
                $table->dropUnique(['order_id']);
                $table->dropConstrainedForeignId('order_id');
            }
            if (Schema::hasColumn('invoices', 'customer_id')) {
                $table->dropConstrainedForeignId('customer_id');
            }
            if (Schema::hasColumn('invoices', 'quotation_id')) {
                $table->dropConstrainedForeignId('quotation_id');
            }
        });
    }
};
