<?php

namespace App\Http\Resources;

use App\Leaderboards\StatLeaderboard;
use App\Leaderboards\StatLeaderboardRow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Policzona klasyfikacja (`StatLeaderboard` z `App\Leaderboards`) w kształcie
 * kontraktu. Liczy `StatLeaderboard::of()`; zasób tylko serializuje.
 *
 * @property StatLeaderboard $resource
 */
class StatLeaderboardResource extends JsonResource
{
    public function __construct(StatLeaderboard $leaderboard)
    {
        parent::__construct($leaderboard);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'stat' => $this->resource->stat,
            'label' => $this->resource->label,
            'rows' => array_map(fn (StatLeaderboardRow $row): array => [
                'position' => $row->position,
                'player' => ['id' => $row->player->id, 'name' => $row->player->name],
                'team' => [
                    'id' => $row->team->id,
                    'name' => $row->team->name,
                    'logoUrl' => $row->team->logoUrl(),
                ],
                'value' => $row->value,
            ], $this->resource->rows),
        ];
    }
}
