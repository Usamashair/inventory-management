<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'admin@admin.com'],
            [
                'name' => 'Administrator',
                'password' => '12345678',
                'role' => 'admin',
                'address' => null,
                'city' => null,
                'post_code' => null,
                'phone' => null,
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'staff@staff.com'],
            [
                'name' => 'Staff Member',
                'password' => '12345678',
                'role' => 'staff',
                'address' => null,
                'city' => null,
                'post_code' => null,
                'phone' => null,
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'customer@gamil.com'],
            [
                'name' => 'Customer',
                'password' => '12345678',
                'role' => 'customer',
                'address' => '18 Harbor Street',
                'city' => 'Rotterdam',
                'post_code' => '3011 AA',
                'phone' => '+31 10 200 1234',
            ]
        );
    }
}
