<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('artworks')) {
            return;
        }

        if (! Schema::hasColumn('artworks', 'image')) {
            Schema::table('artworks', function (Blueprint $table) {
                $table->string('image')->nullable()->after('id');
            });
        }

        if (Schema::hasColumn('artworks', 'files')) {
            $rows = DB::table('artworks')->select('id', 'files')->get();
            foreach ($rows as $row) {
                $files = json_decode((string) $row->files, true);
                $path = null;
                if (is_array($files) && count($files) > 0) {
                    $first = $files[0];
                    $path = is_array($first) ? ($first['path'] ?? null) : null;
                }
                if ($path) {
                    DB::table('artworks')->where('id', $row->id)->update(['image' => $path]);
                }
            }
        }

        Schema::table('artworks', function (Blueprint $table) {
            foreach (['name', 'project', 'designer', 'specifications', 'files', 'date'] as $column) {
                if (Schema::hasColumn('artworks', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('artworks')) {
            return;
        }

        Schema::table('artworks', function (Blueprint $table) {
            if (! Schema::hasColumn('artworks', 'name')) {
                $table->string('name')->nullable();
            }
            if (! Schema::hasColumn('artworks', 'project')) {
                $table->string('project')->nullable();
            }
            if (! Schema::hasColumn('artworks', 'designer')) {
                $table->string('designer')->nullable();
            }
            if (! Schema::hasColumn('artworks', 'specifications')) {
                $table->text('specifications')->nullable();
            }
            if (! Schema::hasColumn('artworks', 'files')) {
                $table->json('files')->nullable();
            }
            if (! Schema::hasColumn('artworks', 'date')) {
                $table->string('date')->nullable();
            }
        });
    }
};
