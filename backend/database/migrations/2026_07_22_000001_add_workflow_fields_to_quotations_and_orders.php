<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            if (! Schema::hasColumn('quotations', 'customer_id')) {
                $table->foreignId('customer_id')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'quotation_id')) {
                $table->foreignId('quotation_id')->nullable()->after('user_id')->constrained('quotations')->nullOnDelete();
            }
            if (! Schema::hasColumn('orders', 'delivery_type')) {
                $table->string('delivery_type')->nullable()->after('delivery_date');
            }
            if (! Schema::hasColumn('orders', 'delivery_warehouse_id')) {
                $table->foreignId('delivery_warehouse_id')->nullable()->after('delivery_type')->constrained('warehouses')->nullOnDelete();
            }
            if (! Schema::hasColumn('orders', 'delivery_address')) {
                $table->text('delivery_address')->nullable()->after('delivery_warehouse_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'delivery_address')) {
                $table->dropColumn('delivery_address');
            }
            if (Schema::hasColumn('orders', 'delivery_warehouse_id')) {
                $table->dropConstrainedForeignId('delivery_warehouse_id');
            }
            if (Schema::hasColumn('orders', 'delivery_type')) {
                $table->dropColumn('delivery_type');
            }
            if (Schema::hasColumn('orders', 'quotation_id')) {
                $table->dropConstrainedForeignId('quotation_id');
            }
        });

        Schema::table('quotations', function (Blueprint $table) {
            if (Schema::hasColumn('quotations', 'customer_id')) {
                $table->dropConstrainedForeignId('customer_id');
            }
        });
    }
};
