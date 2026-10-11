<?php

namespace App\Http\Resources;

use App\Models\Stage;
use App\Standings\StandingRow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Jedna tabela: faza `league` albo grupa (`StandingTable` w kontrakcie).
 * Tabela nie jest modelem, więc zasób dostaje fazę, etykietę i policzone
 * wiersze wprost.
 */
class StandingTableResource extends JsonResource
{
    /**
     * @param  list<StandingRow>  $rows
     */
    public function __construct(private readonly Stage $stage, private readonly string $scoreLabel, private readonly array $rows)
    {
        parent::__construct($stage);
    }

    /**
     * Grupy dojdą z fazą grupową (S5); dziś tabela ma wyłącznie faza `league`.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'stageId' => $this->stage->id,
            'stageName' => $this->stage->name,
            'groupId' => null,
            'groupName' => null,
            'scoreLabel' => $this->scoreLabel,
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
            ], $this->rows),
        ];
    }
}
