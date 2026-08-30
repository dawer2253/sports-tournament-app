<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            // Kontrakt wymaga ISO 8601 z offsetem, a nie domyślnego formatu
            // Laravela (`Y-m-d\TH:i:s.u\Z`).
            'createdAt' => $this->created_at->toIso8601String(),
        ];
    }
}
