<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DocumentNumber
{
    public const START = 1110;

    /**
     * Next unique display id, e.g. #ORD-1110, #QT-1111, #INV-1112.
     * Safe for concurrent creates via lock on document_sequences.
     */
    public static function next(string $prefix): string
    {
        $prefix = strtoupper(ltrim($prefix, '#'));

        return DB::transaction(function () use ($prefix) {
            if (! Schema::hasTable('document_sequences')) {
                return self::fallbackNext($prefix);
            }

            $row = DB::table('document_sequences')
                ->where('prefix', $prefix)
                ->lockForUpdate()
                ->first();

            if (! $row) {
                $number = max(self::START, self::maxExisting($prefix) + 1);
                DB::table('document_sequences')->insert([
                    'prefix' => $prefix,
                    'next_number' => $number + 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                $number = max(self::START, (int) $row->next_number);
                DB::table('document_sequences')
                    ->where('prefix', $prefix)
                    ->update([
                        'next_number' => $number + 1,
                        'updated_at' => now(),
                    ]);
            }

            return '#'.$prefix.'-'.$number;
        });
    }

    public static function maxExisting(string $prefix): int
    {
        $prefix = strtoupper(ltrim($prefix, '#'));
        $map = [
            'QT' => ['quotations', 'quote_id'],
            'ORD' => ['orders', 'order_id'],
            'INV' => ['invoices', 'invoice_no'],
        ];

        if (! isset($map[$prefix])) {
            return self::START - 1;
        }

        [$table, $column] = $map[$prefix];
        if (! Schema::hasTable($table)) {
            return self::START - 1;
        }

        $max = self::START - 1;
        $pattern = '#'.$prefix.'-';
        $values = DB::table($table)->where($column, 'like', $pattern.'%')->pluck($column);

        foreach ($values as $value) {
            if (preg_match('/^#'.preg_quote($prefix, '/').'-(\d+)$/', (string) $value, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return $max;
    }

    private static function fallbackNext(string $prefix): string
    {
        $number = max(self::START, self::maxExisting($prefix) + 1);

        return '#'.$prefix.'-'.$number;
    }
}
