<?php

namespace App\Standings;

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;

/**
 * Tabele turnieju liczone przy odczycie: po jednej na fazę `league` i na
 * każdą grupę fazy `group`, w kolejności faz, a w fazie grupowej w kolejności
 * grup. Wspólne dla panelu i strony publicznej. Faza `knockout` nie ma tabeli.
 */
final class TournamentStandings
{
    /**
     * `$tiebreakers` podmienia listę kryteriów tylko na czas tego odczytu
     * (podgląd w panelu), więc turniej zostaje nietknięty. Ta sama lista
     * trafia do każdej tabeli. W fazie `league` grają wszystkie żywe drużyny
     * turnieju, a w grupie — żywe drużyny z jej `group_id` i wyłącznie mecze
     * tej grupy (niezmiennik 6 z #249). Usuniętych miękko relacja nie zwraca,
     * więc grupa bez żywych drużyn ma tabelę bez wierszy.
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
            ->whereIn('type', ['league', 'group'])
            ->with(['matches', 'groups' => fn ($query) => $query->orderBy('order')])
            ->orderBy('order')
            ->get()
            ->flatMap(fn (Stage $stage): array => $stage->type === 'league'
                ? [new StandingTable($stage, null, $sport, $tiebreakers, $calculator->calculate($teams, $stage->matches))]
                : $stage->groups->map(fn (Group $group): StandingTable => new StandingTable(
                    $stage,
                    $group,
                    $sport,
                    $tiebreakers,
                    $calculator->calculate(
                        $teams->filter(fn (Team $team): bool => $team->group_id === $group->id),
                        $stage->matches->filter(fn (GameMatch $match): bool => $match->group_id === $group->id),
                    ),
                ))->all())
            ->values()
            ->all();
    }
}
