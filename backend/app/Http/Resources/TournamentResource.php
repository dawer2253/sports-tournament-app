<?php

namespace App\Http\Resources;

use App\Models\Tournament;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
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
            // Bez `whenLoaded`: kontrakt wymaga `sport` zawsze, więc pominięcie
            // go przy niezaładowanej relacji dałoby odpowiedź niezgodną ze
            // specyfikacją zamiast dodatkowego zapytania.
            'sport' => new SportSummaryResource($this->sport),
            // Branding jest w kontrakcie zagnieżdżony, choć w bazie leży
            // płasko (`logo_url`, `primary_color`) — tak samo jak w zapisie
            // przez `PATCH /tournaments/{tournament}`, żeby formularz panelu
            // nie musiał go spłaszczać i rozwijać z powrotem.
            'branding' => [
                'logoUrl' => $this->logo_url,
                'primaryColor' => $this->primary_color,
            ],
            'points' => $this->points,
            'tiebreakers' => $this->tiebreakers,
            // Bez fallbacku na `teams()->count()`: kto oddaje ten zasób, ma
            // dołożyć `withCount('teams')`. Cichy fallback zamieniałby brak
            // `withCount` w N+1 zamiast pokazać go od razu.
            'teamsCount' => $this->teams_count,
            // Kontrakt wymaga ISO 8601 z offsetem, a nie domyślnego formatu
            // Laravela (`Y-m-d\TH:i:s.u\Z`).
            'createdAt' => $this->created_at->toIso8601String(),
            'updatedAt' => $this->updated_at->toIso8601String(),
        ];
    }
}
