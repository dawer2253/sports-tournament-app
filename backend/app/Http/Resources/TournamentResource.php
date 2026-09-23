<?php

namespace App\Http\Resources;

use App\Models\Tournament;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Wymaga załadowanego `sport` i policzonego `teams_count` — resource nie
 * dociąga ich sam, żeby lista turniejów nie robiła zapytania na wiersz.
 *
 * @mixin Tournament
 */
class TournamentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'status' => $this->status,
            'sport' => [
                'id' => $this->sport->id,
                'code' => $this->sport->code,
                'name' => $this->sport->name,
            ],
            'branding' => [
                'logoUrl' => $this->logo_url,
                'primaryColor' => $this->primary_color,
            ],
            'points' => $this->points,
            'tiebreakers' => $this->tiebreakers,
            'teamsCount' => $this->teams_count,
            'createdAt' => $this->created_at->toIso8601String(),
            'updatedAt' => $this->updated_at->toIso8601String(),
        ];
    }
}
