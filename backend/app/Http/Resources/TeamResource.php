<?php

namespace App\Http\Resources;

use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Wymaga policzonego `players_count` — resource nie liczy zawodników sam,
 * żeby lista drużyn nie robiła zapytania na wiersz.
 *
 * `groupId` jest w v0.1 zawsze `null` (opis `PATCH /teams/{team}`
 * w kontrakcie), ale idzie z kolumny, a nie jako stała: przypisanie do grupy
 * wejdzie razem z grupami.
 *
 * @mixin Team
 */
class TeamResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tournamentId' => $this->tournament_id,
            'name' => $this->name,
            'logoUrl' => $this->logoUrl(),
            'groupId' => $this->group_id,
            'playersCount' => $this->players_count,
        ];
    }
}
