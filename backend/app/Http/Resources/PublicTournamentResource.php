<?php

namespace App\Http\Resources;

use App\Models\Tournament;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Turniej strony publicznej (`PublicTournament`): bez `id`, punktacji
 * i kryteriów, za to z fazami i statystykami klasyfikacji. Te ostatnie
 * w bazie nie istnieją, składa je `availableStats` i `statLabels` sportu.
 * Wymaga wczytanych `sport` i `stages.groups`.
 *
 * @mixin Tournament
 */
class PublicTournamentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'name' => $this->name,
            'slug' => $this->slug,
            'status' => $this->status,
            'sport' => [
                'id' => $this->sport->id,
                'code' => $this->sport->code,
                'name' => $this->sport->name,
                'allowsDraw' => $this->sport->allowsDraw(),
            ],
            'branding' => [
                'logoUrl' => $this->logoUrl(),
                'primaryColor' => $this->primary_color,
            ],
            'stages' => StageResource::collection($this->stages->sortBy('order')->values()),
            'stats' => array_map(fn (string $stat): array => [
                'code' => $stat,
                'label' => $this->sport->statLabel($stat),
            ], $this->sport->availableStats()),
        ];
    }
}
