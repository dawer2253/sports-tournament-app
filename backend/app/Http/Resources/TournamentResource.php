<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsDates;
use App\Matches\MatchPeriods;
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
    use FormatsDates;

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
                'allowsDraw' => $this->sport->allowsDraw(),
            ],
            'branding' => [
                'logoUrl' => $this->logoUrl(),
                'primaryColor' => $this->primary_color,
            ],
            'points' => $this->points,
            'tiebreakers' => $this->tiebreakers,
            'matchDuration' => $this->match_duration,
            'periods' => MatchPeriods::of($this->resource)->toArray(),
            'setFormat' => $this->setFormat(),
            'teamsCount' => $this->teams_count,
            'createdAt' => $this->formatDate($this->created_at),
            'updatedAt' => $this->formatDate($this->updated_at),
        ];
    }

    /**
     * Format seta w kolejności pól z kontraktu: MySQL układa klucze JSON-a
     * po swojemu (#301).
     *
     * @return array{setsToWin: int, setPoints: int, decidingSetPoints: int, minLead: int}|null
     */
    private function setFormat(): ?array
    {
        $format = $this->set_format;

        return $format === null ? null : [
            'setsToWin' => $format['setsToWin'],
            'setPoints' => $format['setPoints'],
            'decidingSetPoints' => $format['decidingSetPoints'],
            'minLead' => $format['minLead'],
        ];
    }
}
