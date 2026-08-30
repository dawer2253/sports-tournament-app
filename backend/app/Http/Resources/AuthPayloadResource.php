<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Odpowiedź `/register` i `/login`: token plus dane konta (schemat
 * `AuthPayload` w kontrakcie).
 */
class AuthPayloadResource extends JsonResource
{
    public function __construct(User $user, private readonly string $token)
    {
        parent::__construct($user);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'token' => $this->token,
            'user' => new UserResource($this->resource),
        ];
    }
}
