<?php

namespace App\Http\Resources;

use App\Standings\StandingRow;
use App\Standings\StandingTable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Policzona tabela (`StandingTable` z `App\Standings`) w kształcie
 * kontraktu. Liczy `TournamentStandings`; zasób tylko serializuje.
 *
 * @property StandingTable $resource
 */
class StandingTableResource extends JsonResource
{
    public function __construct(StandingTable $table)
    {
        parent::__construct($table);
    }

    /**
     * Tabela grupy niesie jej `id` i nazwę, tabela ligi — `null` w obu polach.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $table = $this->resource;

        return [
            'stageId' => $table->stage->id,
            'stageName' => $table->stage->name,
            'groupId' => $table->group?->id,
            'groupName' => $table->group?->name,
            'scoreLabel' => $table->sport->scoreLabel(),
            'allowsDraw' => $table->sport->allowsDraw(),
            'tiebreakers' => array_map(fn (string $code): array => [
                'code' => $code,
                'label' => $table->sport->tiebreakerLabel($code),
            ], $table->tiebreakers),
            'rows' => array_map(fn (StandingRow $row): array => [
                'position' => $row->position,
                'team' => [
                    'id' => $row->team->id,
                    'name' => $row->team->name,
                    'logoUrl' => $row->team->logoUrl(),
                ],
                'played' => $row->played,
                'won' => $row->won,
                'drawn' => $row->drawn,
                'lost' => $row->lost,
                'scoreFor' => $row->scoreFor,
                'scoreAgainst' => $row->scoreAgainst,
                'scoreDifference' => $row->scoreDifference(),
                'points' => $row->points,
                'form' => $row->form(),
            ], $table->rows),
        ];
    }
}
