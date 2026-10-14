<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('products') && ! Schema::hasColumn('products', 'price')) {
            Schema::table('products', function (Blueprint $table) {
                $table->decimal('price', 12, 2)->default(0.00)->after('product');
            });
        }

        if (Schema::hasTable('orders')) {
            if (! Schema::hasColumn('orders', 'total')) {
                Schema::table('orders', function (Blueprint $table) {
                    $table->decimal('total', 12, 2)->default(0.00)->after('product');
                });
            }

            if (Schema::hasTable('order_items') && Schema::hasColumn('orders', 'product_id')) {
                $orders = DB::table('orders')->whereNotNull('product_id')->get();
                foreach ($orders as $order) {
                    $qty = (float) preg_replace('/[^0-9.]/', '', (string) ($order->quantity ?? '0'));
                    $price = 0.0;
                    if (! empty($order->value) && $qty > 0) {
                        $value = (float) preg_replace('/[^0-9.]/', '', (string) $order->value);
                        $price = $value / $qty;
                    }

                    DB::table('order_items')->insert([
                        'order_id' => $order->id,
                        'product_id' => $order->product_id,
                        'qty' => $order->quantity,
                        'price' => round($price, 2),
                        'sub_total' => round($qty * $price, 2),
                        'warehouse_id' => $order->warehouse_id ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    DB::table('orders')->where('id', $order->id)->update([
                        'total' => round($qty * $price, 2),
                    ]);
                }
            }

            Schema::table('orders', function (Blueprint $table) {
                if (Schema::hasColumn('orders', 'product_id')) {
                    $table->dropConstrainedForeignId('product_id');
                }
                if (Schema::hasColumn('orders', 'quantity')) {
                    $table->dropColumn('quantity');
                }
                if (Schema::hasColumn('orders', 'warehouse_id')) {
                    $table->dropConstrainedForeignId('warehouse_id');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders')) {
            Schema::table('orders', function (Blueprint $table) {
                if (! Schema::hasColumn('orders', 'product_id')) {
                    $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
                }
                if (! Schema::hasColumn('orders', 'quantity')) {
                    $table->string('quantity')->nullable();
                }
                if (! Schema::hasColumn('orders', 'warehouse_id')) {
                    $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->nullOnDelete();
                }
                if (Schema::hasColumn('orders', 'total')) {
                    $table->dropColumn('total');
                }
            });
        }

        if (Schema::hasTable('products') && Schema::hasColumn('products', 'price')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('price');
            });
        }
    }
};
