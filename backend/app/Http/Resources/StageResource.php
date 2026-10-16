<?php

namespace App\Http\Resources;

use App\Models\Stage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Oczekuje wczytanych `groups`. Bez tego dociągnąłby je leniwie, osobnym
 * zapytaniem na każdą fazę.
 *
 * @mixin Stage
 */
class StageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'name' => $this->name,
            'order' => $this->order,
            'groups' => GroupResource::collection($this->groups),
        ];
    }
}
