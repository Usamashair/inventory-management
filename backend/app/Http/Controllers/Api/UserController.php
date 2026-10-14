<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Only administrators can manage staff.');

        $users = User::query()
            ->whereIn('role', ['admin', 'staff'])
            ->latest()
            ->get()
            ->map(fn (User $user) => $this->format($user));

        return response()->json(['data' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Only administrators can manage staff.');

        $data = $this->validated($request);

        $user = User::query()->create($data);

        return response()->json([
            'message' => 'User created successfully.',
            'data' => $this->format($user),
        ], 201);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Only administrators can manage staff.');
        abort_unless(in_array($user->role, ['admin', 'staff'], true), 404);

        return response()->json(['data' => $this->format($user)]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Only administrators can manage staff.');
        abort_unless(in_array($user->role, ['admin', 'staff'], true), 404);

        $data = $this->validated($request, $user->id);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        // Prevent an admin from locking themselves out of admin access.
        if (
            (int) $request->user()->id === (int) $user->id
            && isset($data['role'])
            && $data['role'] !== 'admin'
        ) {
            abort(422, 'You cannot change your own role away from admin.');
        }

        $user->update($data);

        return response()->json([
            'message' => 'User updated successfully.',
            'data' => $this->format($user->fresh()),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isAdmin(), 403, 'Only administrators can delete admin or staff accounts.');
        abort_unless(in_array($user->role, ['admin', 'staff'], true), 404);
        abort_if(
            (int) $request->user()->id === (int) $user->id,
            422,
            'You cannot delete your own account.'
        );

        $user->delete();

        return response()->json(['message' => 'User deleted successfully.']);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($ignoreId),
            ],
            'password' => [$ignoreId ? 'nullable' : 'required', 'string', 'min:6'],
            'role' => ['required', 'string', Rule::in(['admin', 'staff'])],
            'phone' => ['nullable', 'string', 'max:50'],
        ]);

        return [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'] ?? null,
            'role' => $validated['role'],
            'phone' => $validated['phone'] ?? null,
        ];
    }

    private function format(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'password' => '••••••••',
            'role' => $user->role,
            'phone' => $user->phone ?? '',
            'createdAt' => $user->created_at?->format('M d, Y') ?? '',
        ];
    }
}
