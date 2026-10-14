<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $hashed = hash('sha256', $token);

        $apiToken = ApiToken::query()
            ->with('user')
            ->where('token', $hashed)
            ->first();

        $user = $apiToken?->user;

        // Backward compatibility for any token still only on users.api_token.
        if (! $user) {
            $user = User::query()->where('api_token', $hashed)->first();
            if ($user) {
                $apiToken = $user->apiTokens()->firstOrCreate(
                    ['token' => $hashed],
                    ['name' => 'legacy', 'last_used_at' => now()]
                );
            }
        }

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->currentAccessToken = $token;

        if ($apiToken) {
            $apiToken->forceFill(['last_used_at' => now()])->save();
        }

        $request->setUserResolver(fn () => $user);
        auth()->setUser($user);

        return $next($request);
    }
}
