<?php

namespace App\Leaderboards;

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Team;
use App\Models\Tournament;

/**
 * Klasyfikacja indywidualna turnieju według jednej statystyki sportu
 * (`StatLeaderboard` w kontrakcie), liczona przy odczycie według reguł z #190:
 *
 * - tylko mecze `finished`, ze wszystkich faz turnieju;
 * - wartość to suma `value` typów zdarzeń o danym `stat`, a `value` serwer
 *   bierze z konfiguracji sportu, bo w `match_events` jej nie ma;
 * - wszyscy z wartością > 0, bez limitu; zdarzenie bez zawodnika nie wchodzi;
 * - pozycja dzielona, ex aequo po id zawodnika.
 *
 * Zawodnik i drużyna usunięci miękko zostają z nazwą. Relacje
 * `MatchEvent::player()` i `team()` by ich nie oddały, więc agregacja idzie
 * po kolumnach, a modele wczytuje osobno z `withTrashed()`.
 */
final readonly class StatLeaderboard
{
    /**
     * @param  list<StatLeaderboardRow>  $rows
     */
    private function __construct(
        public string $stat,
        public string $label,
        public array $rows,
    ) {}

    /**
     * `$stat` musi należeć do `availableStats` sportu turnieju — sprawdza to
     * żądanie, zanim tu trafi.
     */
    public static function of(Tournament $tournament, string $stat): self
    {
        $sport = $tournament->sport;
        $values = $sport->statEventValues($stat);

        // Liczba zdarzeń każdego typu na zawodnika i drużynę zdarzenia;
        // mnożenie przez `value` typu robi się niżej, po stronie PHP.
        $counts = MatchEvent::query()
            ->join('matches', 'matches.id', '=', 'match_events.match_id')
            ->join('stages', 'stages.id', '=', 'matches.stage_id')
            ->where('stages.tournament_id', $tournament->id)
            ->whereIn('matches.status', GameMatch::RESULT_STATUSES)
            ->whereNotNull('match_events.player_id')
            ->whereIn('match_events.type', array_keys($values))
            ->groupBy('match_events.player_id', 'match_events.team_id', 'match_events.type')
            ->selectRaw('match_events.player_id, match_events.team_id, match_events.type, COUNT(*) AS events')
            ->toBase()
            ->get();

        $totals = [];
        $teamOf = [];

        foreach ($counts as $count) {
            $totals[$count->player_id] = ($totals[$count->player_id] ?? 0) + $count->events * $values[$count->type];
            // Drużyna zdarzenia to zawsze drużyna zawodnika (#188, reguła 7),
            // więc zawodnik ma jedną.
            $teamOf[$count->player_id] = $count->team_id;
        }

        $players = Player::withTrashed()->whereKey(array_keys($totals))->get()->keyBy('id');
        $teams = Team::withTrashed()->whereKey(array_unique($teamOf))->get()->keyBy('id');

        uksort($totals, fn (int $a, int $b): int => [$totals[$b], $a] <=> [$totals[$a], $b]);

        $rows = [];
        $position = 0;
        $previous = null;

        foreach (array_keys($totals) as $index => $playerId) {
            if ($totals[$playerId] !== $previous) {
                $position = $index + 1;
                $previous = $totals[$playerId];
            }

            $rows[] = new StatLeaderboardRow($position, $players[$playerId], $teams[$teamOf[$playerId]], $totals[$playerId]);
        }

        return new self($stat, $sport->statLabel($stat), $rows);
    }
}
