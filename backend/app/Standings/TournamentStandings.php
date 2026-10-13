<?php

namespace App\Standings;

use App\Models\Stage;
use App\Models\Tournament;

/**
 * Tabele turnieju liczone przy odczycie, po jednej na fazę `league`,
 * w kolejności faz. Wspólne dla panelu i strony publicznej. Faza `knockout`
 * nie ma tabeli, a tabele grup dołoży faza grupowa (S5), wołając kalkulator
 * osobno dla każdej grupy.
 */
final class TournamentStandings
{
    /**
     * `$tiebreakers` podmienia listę kryteriów tylko na czas tego odczytu
     * (podgląd w panelu), więc turniej zostaje nietknięty. Ta sama lista
     * trafia do każdej tabeli. W fazie `league` grają wszystkie żywe drużyny
     * turnieju; usuniętych miękko relacja nie zwraca.
     *
     * @param  list<string>|null  $tiebreakers  `null` to `Tournament.tiebreakers`
     * @return list<StandingTable>
     */
    public static function of(Tournament $tournament, ?array $tiebreakers = null): array
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
            ->map(fn (Stage $stage): StandingTable => new StandingTable(
                $stage,
                $sport,
                $tiebreakers,
                $calculator->calculate($teams, $stage->matches),
            ))
            ->all();
    }
}
