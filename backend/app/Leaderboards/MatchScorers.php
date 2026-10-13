<?php

namespace App\Leaderboards;

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Sport;
use App\Models\Team;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Strzelcy meczu (`PublicMatch.scorers`, #208), liczeni przy odczycie
 * z `match_events` i konfiguracji sportu:
 *
 * - wchodzą typy o `stat` równym pierwszemu wpisowi `availableStats` sportu
 *   (piłka `goals`, kosz `points`) oraz samobój;
 * - `value` to suma `value` typów zdarzeń zawodnika, samobój to osobny wiersz;
 * - `minutes` rosnąco, zdarzenie bez minuty liczy się tylko do `value`;
 * - zdarzenie bez zawodnika nie wchodzi, a mecz `scheduled` nie ma strzelców;
 * - wiersze po pierwszej minucie, bez minut na końcu, remis po id zawodnika.
 *
 * Zdarzenia całej listy meczów idą jednym zapytaniem: `eagerLoad()` daje
 * relacje do `with()`, a `of()` czyta już wczytane `events`. Zawodnik
 * i drużyna usunięci miękko zostają z nazwą, jak w `StatLeaderboard`.
 */
final class MatchScorers
{
    /**
     * Kod samobója. Jedyne miejsce w backendzie, które wie, że ten typ daje
     * zdobycz przeciwnikowi: konfiguracja sportu tego nie mówi (`stat: null`),
     * a panel trzyma osobną stałą `OWN_GOAL`. Zastąpić je ma pole typu
     * zdarzenia mówiące, której drużynie liczy się zdobycz — future work
     * w `docs/PLAN.md` §14.
     */
    private const OWN_GOAL = 'own_goal';

    /**
     * Relacje do `with()` listy meczów: tylko zdarzenia, które mogą dać
     * wiersz, razem z zawodnikiem i drużyną.
     *
     * @return array<string, \Closure>
     */
    public static function eagerLoad(Sport $sport): array
    {
        return [
            'events' => fn (HasMany $query) => $query
                ->whereNotNull('player_id')
                ->whereIn('type', array_keys(self::eventValues($sport))),
            'events.player' => fn (BelongsTo $query) => $query->withTrashed(),
            'events.team' => fn (BelongsTo $query) => $query->withTrashed(),
        ];
    }

    /**
     * Wiersze strzelców meczu z wczytanych `events` (`eagerLoad()`).
     *
     * @return list<array{team: array{id: int, name: string, logoUrl: ?string}, player: array{id: int, name: string}, value: int, minutes: list<int>, ownGoal: bool}>
     */
    public static function of(GameMatch $match, Sport $sport): array
    {
        if (! in_array($match->status, GameMatch::STARTED_STATUSES, true)) {
            return [];
        }

        $values = self::eventValues($sport);
        $rows = [];

        /** @var MatchEvent $event */
        foreach ($match->events as $event) {
            if ($event->player === null || ! isset($values[$event->type])) {
                continue;
            }

            $ownGoal = $event->type === self::OWN_GOAL;
            $key = $event->player_id.($ownGoal ? ':own' : '');

            $rows[$key] ??= [
                'team' => self::teamSummary($event->team),
                'player' => ['id' => $event->player->id, 'name' => $event->player->name],
                'value' => 0,
                'minutes' => [],
                'ownGoal' => $ownGoal,
            ];
            $rows[$key]['value'] += $values[$event->type];

            if ($event->minute !== null) {
                $rows[$key]['minutes'][] = $event->minute;
            }
        }

        foreach ($rows as &$row) {
            sort($row['minutes']);
        }
        unset($row);

        usort($rows, fn (array $a, array $b): int => self::sortKey($a) <=> self::sortKey($b));

        return $rows;
    }

    /**
     * Typy zdarzeń liczone do strzelców, jako `kod => value`: typy
     * statystyki-zdobyczy sportu i samobój, gdy sport go zna.
     *
     * @return array<string, int>
     */
    private static function eventValues(Sport $sport): array
    {
        $values = $sport->statEventValues($sport->availableStats()[0]);
        $ownGoal = $sport->eventType(self::OWN_GOAL);

        if ($ownGoal !== null) {
            $values[self::OWN_GOAL] = $ownGoal['value'];
        }

        return $values;
    }

    /**
     * Wiersz bez minut idzie za wszystkimi z minutą, remis rozstrzyga id
     * zawodnika, a samobój tego samego zawodnika w tej samej minucie stoi
     * po zwykłym wierszu — żeby kolejka była stała.
     *
     * @param  array{player: array{id: int}, minutes: list<int>, ownGoal: bool}  $row
     * @return array{bool, int, int, bool}
     */
    private static function sortKey(array $row): array
    {
        return [$row['minutes'] === [], $row['minutes'][0] ?? 0, $row['player']['id'], $row['ownGoal']];
    }

    /**
     * @return array{id: int, name: string, logoUrl: ?string}
     */
    private static function teamSummary(Team $team): array
    {
        return ['id' => $team->id, 'name' => $team->name, 'logoUrl' => $team->logoUrl()];
    }
}
