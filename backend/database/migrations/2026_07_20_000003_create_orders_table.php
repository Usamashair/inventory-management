<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_id')->unique();
            $table->string('date')->nullable();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->string('product')->nullable();
            $table->decimal('total', 12, 2)->default(0.00);
            $table->string('value')->nullable();
            $table->string('status')->default('pending');
            $table->string('delivery_date')->nullable();
            $table->string('warehouse_location')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
