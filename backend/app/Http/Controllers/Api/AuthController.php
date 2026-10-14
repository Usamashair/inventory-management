<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->where('email', $credentials['email'])
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The email address or password is incorrect.'],
            ]);
        }

        $token = $user->createApiToken(
            mb_substr((string) $request->userAgent(), 0, 255) ?: null
        );

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $this->formatUser($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->formatUser($request->user()),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'postCode' => ['nullable', 'string', 'max:50'],
            'post_code' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'currentPassword' => ['nullable', 'string'],
            'current_password' => ['nullable', 'string'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $changingPassword = ! empty($validated['password']);
        if ($changingPassword) {
            $current = $validated['currentPassword'] ?? $validated['current_password'] ?? null;
            if (! $current || ! Hash::check($current, $user->password)) {
                throw ValidationException::withMessages([
                    'currentPassword' => ['Current password is incorrect.'],
                ]);
            }
            $user->password = $validated['password'];
        }

        if (array_key_exists('name', $validated)) {
            $user->name = $validated['name'];
        }
        if (array_key_exists('email', $validated)) {
            $user->email = $validated['email'];
        }
        if (array_key_exists('address', $validated)) {
            $user->address = $validated['address'];
        }
        if (array_key_exists('city', $validated)) {
            $user->city = $validated['city'];
        }
        if (array_key_exists('postCode', $validated) || array_key_exists('post_code', $validated)) {
            $user->post_code = $validated['postCode'] ?? $validated['post_code'];
        }
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }

        $user->save();

        return response()->json([
            'message' => $changingPassword ? 'Profile and password updated.' : 'Profile updated.',
            'user' => $this->formatUser($user->fresh()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        // Revoke only this device/session — other logins stay active.
        $request->user()->clearApiToken($request->bearerToken());

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'address' => $user->address,
            'city' => $user->city,
            'postCode' => $user->post_code,
            'phone' => $user->phone,
        ];
    }
}
