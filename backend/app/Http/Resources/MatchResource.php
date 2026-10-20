<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsDates;
use App\Models\GameMatch;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Oczekuje wczytanych `round`, `homeTeam`, `awayTeam` i `venue`, z tego
 * samego powodu co `StageResource`: lista meczów nie może robić zapytania na
 * wiersz.
 *
 * `kickoffAt` idzie przez `formatDate()`, jak każda data w odpowiedzi
 * (ADR-0008).
 *
 * @mixin GameMatch
 */
class MatchResource extends JsonResource
{
    use FormatsDates;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stageId' => $this->stage_id,
            'groupId' => $this->group_id,
            'round' => [
                'id' => $this->round->id,
                'name' => $this->round->name,
                'order' => $this->round->order,
            ],
            'matchNumber' => $this->match_number,
            'homeTeam' => $this->homeTeam?->summary(),
            'awayTeam' => $this->awayTeam?->summary(),
            'homeScore' => $this->home_score,
            'awayScore' => $this->away_score,
            'homePenalties' => $this->home_penalties,
            'awayPenalties' => $this->away_penalties,
            // Lista w sporcie z setami, `null` w pozostałych (#301): mecz
            // dostaje ją przy powstaniu z generatora terminarza albo drabinki.
            // MySQL układa klucze JSON-a po swojemu, więc kolejność `home`,
            // `away` składamy tu.
            'sets' => $this->sets === null ? null : array_map(
                fn (array $set): array => ['home' => $set['home'], 'away' => $set['away']],
                $this->sets,
            ),
            'status' => $this->status,
            'kickoffAt' => $this->formatDate($this->kickoff_at),
            'venue' => $this->venue === null ? null : ['id' => $this->venue->id, 'name' => $this->venue->name],
            'winnerToMatchId' => $this->winner_to_match_id,
            'loserToMatchId' => $this->loser_to_match_id,
            'advancesToSlot' => $this->advances_to_slot,
            ...$this->clock(),
        ];
    }

    /**
     * Zegar meczu (#297) tylko przy `live`. Po zakończeniu baza pamięta
     * ostatnią część na wypadek powrotu do `live`, ale API jej nie pokazuje.
     *
     * @return array{livePeriod: ?int, periodStartedAt: ?string, onBreak: bool}
     */
    private function clock(): array
    {
        $live = $this->status === 'live';

        return [
            'livePeriod' => $live ? $this->live_period : null,
            'periodStartedAt' => $live ? $this->formatDate($this->period_started_at) : null,
            'onBreak' => $live && $this->on_break,
        ];
    }
}
