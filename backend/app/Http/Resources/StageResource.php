<?php

namespace App\Http\Resources;

use App\Models\Stage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Wymaga wczytanych `groups` — resource nie dociąga ich sam, żeby lista faz
 * nie robiła zapytania na wiersz.
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
            'groups' => $this->groups->map(fn ($group) => [
                'id' => $group->id,
                'name' => $group->name,
            ])->all(),
        ];
    }
}
