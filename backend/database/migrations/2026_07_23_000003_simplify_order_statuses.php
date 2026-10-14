<?php

use App\Models\Order;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        DB::table('orders')->where('status', 'pending')->update(['status' => Order::STATUS_WAITING_FOR_ARTWORK]);
        DB::table('orders')->whereIn('status', ['ready', 'shipped'])->update(['status' => Order::STATUS_IN_TRANSIT]);
        DB::table('orders')->where('status', 'completed')->update(['status' => Order::STATUS_DELIVERED]);
    }

    public function down(): void
    {
        // Irreversible data remap.
    }
};
