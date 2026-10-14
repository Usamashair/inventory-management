<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->string('name')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        // Keep existing single-token sessions alive after deploy.
        if (Schema::hasColumn('users', 'api_token')) {
            $rows = DB::table('users')
                ->whereNotNull('api_token')
                ->where('api_token', '!=', '')
                ->get(['id', 'api_token']);

            $now = now();
            foreach ($rows as $row) {
                DB::table('api_tokens')->insert([
                    'user_id' => $row->id,
                    'token' => $row->api_token,
                    'name' => 'legacy',
                    'last_used_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('api_tokens');
    }
};
