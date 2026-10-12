<?php

namespace App\Http\Resources;

use App\Models\Sport;
use App\Models\Stage;
use App\Models\Tournament;
use App\Standings\StandingRow;
use App\Standings\StandingsCalculator;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

/**
 * Jedna tabela: faza `league` albo grupa (`StandingTable` w kontrakcie).
 * Tabela nie jest modelem, więc zasób dostaje fazę, sport, kryteria
 * i policzone wiersze wprost.
 */
class StandingTableResource extends JsonResource
{
    /**
     * @param  list<string>  $tiebreakers  kody, według których policzono `$rows`
     * @param  list<StandingRow>  $rows
     */
    public function __construct(
        private readonly Stage $stage,
        private readonly Sport $sport,
        private readonly array $tiebreakers,
        private readonly array $rows,
    ) {
        parent::__construct($stage);
    }

    /**
     * Tabele turnieju liczone przy odczycie, po jednej na fazę `league`,
     * w kolejności faz. Wspólne dla panelu i strony publicznej. Faza
     * `knockout` nie ma tabeli, a tabele grup dołoży faza grupowa (S5),
     * wołając kalkulator osobno dla każdej grupy.
     *
     * `$tiebreakers` podmienia listę kryteriów tylko na czas tego odczytu
     * (podgląd w panelu), więc turniej zostaje nietknięty. Ta sama lista
     * trafia do odpowiedzi, żeby zdanie pod tabelą zgadzało się z wierszami.
     * W fazie `league` grają wszystkie żywe drużyny turnieju; usuniętych
     * miękko relacja nie zwraca.
     *
     * @param  list<string>|null  $tiebreakers  `null` to `Tournament.tiebreakers`
     * @return Collection<int, self>
     */
    public static function forTournament(Tournament $tournament, ?array $tiebreakers = null): Collection
    {
        $tiebreakers ??= $tournament->tiebreakers;
        $calculator = new StandingsCalculator($tournament->points, $tiebreakers);
        $sport = $tournament->sport;
        $teams = $tournament->teams()->get();

        return $tournament->stages()
            ->where('type', 'league')
            ->with('matches')
            ->orderBy('order')
            ->get()
            ->map(fn (Stage $stage): self => new self(
                $stage,
                $sport,
                $tiebreakers,
                $calculator->calculate($teams, $stage->matches),
            ));
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
            'scoreLabel' => $this->sport->scoreLabel(),
            'allowsDraw' => $this->sport->allowsDraw(),
            'tiebreakers' => array_map(fn (string $code): array => [
                'code' => $code,
                'label' => $this->sport->tiebreakerLabel($code),
            ], $this->tiebreakers),
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
