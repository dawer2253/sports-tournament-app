<?php

namespace App\Matches;

use App\Http\Resources\MatchEventResource;
use App\Leaderboards\MatchScorers;
use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Sport;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Relacja meczu na stronie meczu (`PublicMatchDetail`, #210): zdarzenia
 * z częścią meczu i wynikiem po zdarzeniu oraz wyniki części. Liczy ją
 * serwer, bo strona publiczna nie zna konfiguracji sportu ani ustawień
 * turnieju.
 *
 * - Wynik zmieniają typy liczone do strzelców (`MatchScorers::scoringValues()`):
 *   statystyka-zdobycz sportu i samobój, który podnosi wynik przeciwnika.
 * - Gdy suma zdobyczy ze zdarzeń nie równa się wynikowi meczu, wszystkie
 *   wyniki relacji są `null` (#188, reguła 11: zgodności API nie pilnuje),
 *   żeby bieżący wynik nie kończył się na innym niż wynik w nagłówku.
 * - Mecz `scheduled` nie ma relacji.
 *
 * Zdarzenia wczytuje `eagerLoad()` jednym zapytaniem, razem z zawodnikami
 * i drużynami; z tych samych `events` liczą się strzelcy.
 */
final class MatchRelation
{
    /**
     * Relacje do `with()`: wszystkie zdarzenia w kolejności osi meczu, z
     * zawodnikiem i drużyną także usuniętymi miękko.
     *
     * @return array<string, \Closure>
     */
    public static function eagerLoad(): array
    {
        return [
            'events' => fn (HasMany $query) => $query->inTimelineOrder(),
            'events.player' => fn (BelongsTo $query) => $query->withTrashed(),
            'events.team' => fn (BelongsTo $query) => $query->withTrashed(),
        ];
    }

    /**
     * `events` i `periods` strony meczu z wczytanych `events` (`eagerLoad()`).
     *
     * @return array{events: list<array<string, mixed>>, periods: list<array{number: int, label: string, homeScore: ?int, awayScore: ?int}>}
     */
    public static function of(GameMatch $match, Sport $sport, MatchPeriods $periods): array
    {
        if (! in_array($match->status, GameMatch::STARTED_STATUSES, true)) {
            return ['events' => [], 'periods' => []];
        }

        $values = MatchScorers::scoringValues($sport);
        $home = 0;
        $away = 0;
        $rows = [];
        $periodScores = [];

        /** @var MatchEvent $event */
        foreach ($match->events as $event) {
            $period = $periods->periodOf($event->minute);
            $gain = self::gain($event, $match, $values);

            if ($period !== null) {
                $periodScores[$period] ??= [0, 0];
                $periodScores[$period][0] += $gain[0];
                $periodScores[$period][1] += $gain[1];
            }

            $scoreAfter = null;
            if ($gain !== [0, 0]) {
                $home += $gain[0];
                $away += $gain[1];
                $scoreAfter = ['home' => $home, 'away' => $away];
            }

            $rows[] = [
                ...(new MatchEventResource($event, $sport))->resolve(),
                'period' => $period,
                'scoreAfter' => $scoreAfter,
            ];
        }

        $consistent = $home === $match->home_score && $away === $match->away_score;

        if (! $consistent) {
            $rows = array_map(fn (array $row): array => array_replace($row, ['scoreAfter' => null]), $rows);
        }

        ksort($periodScores);

        return [
            'events' => $rows,
            'periods' => array_map(fn (int $number, array $score): array => [
                'number' => $number,
                'label' => $periods->label($number),
                'homeScore' => $consistent ? $score[0] : null,
                'awayScore' => $consistent ? $score[1] : null,
            ], array_keys($periodScores), $periodScores),
        ];
    }

    /**
     * Zdobycz zdarzenia jako `[gospodarz, gość]`. Samobój podnosi wynik
     * przeciwnika drużyny zdarzenia; typ spoza zdobyczy daje `[0, 0]`.
     *
     * @param  array<string, int>  $values
     * @return array{int, int}
     */
    private static function gain(MatchEvent $event, GameMatch $match, array $values): array
    {
        $value = $values[$event->type] ?? 0;

        if ($value === 0) {
            return [0, 0];
        }

        $forHome = ($event->team_id === $match->home_team_id) !== MatchScorers::isOwnGoal($event->type);

        return $forHome ? [$value, 0] : [0, $value];
    }
}
