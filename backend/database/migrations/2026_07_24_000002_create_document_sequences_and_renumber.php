<?php

use App\Support\DocumentNumber;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_sequences', function (Blueprint $table) {
            $table->string('prefix', 16)->primary();
            $table->unsignedInteger('next_number')->default(DocumentNumber::START);
            $table->timestamps();
        });

        $this->renumber('quotations', 'quote_id', 'QT', 'created_at');
        $this->renumber('orders', 'order_id', 'ORD', 'created_at');
        $this->renumber('invoices', 'invoice_no', 'INV', 'created_at');
    }

    public function down(): void
    {
        Schema::dropIfExists('document_sequences');
    }

    private function renumber(string $table, string $column, string $prefix, string $orderColumn): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
            return;
        }

        $rows = DB::table($table)->orderBy($orderColumn)->orderBy('id')->get(['id', $column]);

        // Avoid unique collisions while rewriting.
        foreach ($rows as $row) {
            DB::table($table)->where('id', $row->id)->update([
                $column => '#'.$prefix.'-TMP-'.$row->id,
            ]);
        }

        $number = DocumentNumber::START;
        foreach ($rows as $row) {
            DB::table($table)->where('id', $row->id)->update([
                $column => '#'.$prefix.'-'.$number,
            ]);
            $number++;
        }

        DB::table('document_sequences')->updateOrInsert(
            ['prefix' => $prefix],
            [
                'next_number' => $number,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
};
