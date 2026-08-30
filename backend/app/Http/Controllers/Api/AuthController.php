<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\AuthPayloadResource;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create($request->safe()->only(['name', 'email', 'password']));

        return $this->issueToken($user)->response()->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Nieudane logowanie jest błędem walidacji (422), nie 401 — kontrakt nie
     * przewiduje przy `/login` innej odpowiedzi błędnej, a 401 zostaje dla
     * żądań do zasobów chronionych bez ważnego tokenu.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->validated('email'))->first();

        if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        return $this->issueToken($user)->response();
    }

    /**
     * Unieważnia wyłącznie token użyty w tym żądaniu. Wylogowanie na jednym
     * urządzeniu nie wyrzuca organizera z pozostałych.
     */
    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    private function issueToken(User $user): AuthPayloadResource
    {
        return new AuthPayloadResource($user, $user->createToken('api')->plainTextToken);
    }
}
