<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            if (! Schema::hasColumn('artworks', 'order_id')) {
                $table->foreignId('order_id')->nullable()->after('customer_id')->constrained('orders')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('artworks', function (Blueprint $table) {
            if (Schema::hasColumn('artworks', 'order_id')) {
                $table->dropConstrainedForeignId('order_id');
            }
        });
    }
};
