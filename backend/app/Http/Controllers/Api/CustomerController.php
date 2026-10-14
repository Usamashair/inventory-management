<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        $customers = User::query()
            ->where('role', 'customer')
            ->latest()
            ->get()
            ->map(fn (User $user) => $this->format($user));

        return response()->json(['data' => $customers]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);

        $data = $this->validated($request);

        $customer = User::query()->create([
            ...$data,
            'role' => 'customer',
        ]);

        return response()->json([
            'message' => 'Customer created successfully.',
            'data' => $this->format($customer),
        ], 201);
    }

    public function show(Request $request, User $customer): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        abort_unless($customer->role === 'customer', 404);

        return response()->json(['data' => $this->format($customer)]);
    }

    public function update(Request $request, User $customer): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        abort_unless($customer->role === 'customer', 404);

        $data = $this->validated($request, $customer->id);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $customer->update($data);

        return response()->json([
            'message' => 'Customer updated successfully.',
            'data' => $this->format($customer->fresh()),
        ]);
    }

    public function destroy(Request $request, User $customer): JsonResponse
    {
        abort_unless($request->user()->isStaffOrAdmin(), 403);
        abort_unless($customer->role === 'customer', 404);
        abort_if(
            (int) $request->user()->id === (int) $customer->id,
            422,
            'You cannot delete your own account.'
        );

        $customer->delete();

        return response()->json(['message' => 'Customer deleted successfully.']);
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
            'address' => ['nullable', 'string', 'max:255'],
            'password' => [$ignoreId ? 'nullable' : 'required', 'string', 'min:6'],
            'city' => ['nullable', 'string', 'max:255'],
            'postCode' => ['nullable', 'string', 'max:50'],
            'post_code' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
        ]);

        return [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'address' => $validated['address'] ?? null,
            'password' => $validated['password'] ?? null,
            'city' => $validated['city'] ?? null,
            'post_code' => $validated['postCode'] ?? $validated['post_code'] ?? null,
            'phone' => $validated['phone'] ?? null,
        ];
    }

    private function format(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'address' => $user->address ?? '',
            'password' => '••••••••',
            'city' => $user->city ?? '',
            'postCode' => $user->post_code ?? '',
            'phone' => $user->phone ?? '',
            'role' => $user->role,
        ];
    }
}
