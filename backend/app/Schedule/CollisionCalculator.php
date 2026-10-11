<?php

namespace App\Schedule;

use App\Models\GameMatch;
use App\Models\Tournament;

/**
 * Kolizje terminu w obrębie turnieju (#158), liczone przy każdym odczycie —
 * w bazie nic z tego nie zostaje.
 *
 * Kolizję tworzą dwa mecze tego samego turnieju (także z różnych faz), których
 * okna `[kickoffAt, kickoffAt + matchDuration)` się nakładają. Nakładanie,
 * a nie styk: mecz kończący się o 12:00 i zaczynający o 12:00 nie kolidują.
 *
 * Przebieg jest posortowany po `kickoff_at`, a nie porównanie każdego z każdym:
 * dla meczu bierzemy tylko tych sąsiadów, którzy zaczynają się przed jego
 * końcem, więc przy równych odstępach to przejście liniowe. Mecz bez
 * `kickoff_at` nie koliduje nigdy, a mecz bez obiektu nie ma kolizji `venue`.
 * Mecze `finished` liczą się tak samo jak pozostałe.
 */
class CollisionCalculator
{
    /**
     * Kolizje pogrupowane po `id` meczu. Mecze bez kolizji nie mają tu wpisu.
     *
     * @return array<int, list<array{type: string, matchId: int}>>
     */
    public function forTournament(Tournament $tournament): array
    {
        $durationSeconds = $tournament->match_duration * 60;

        /** @var list<array{start: int, end: int, match: GameMatch}> $windows */
        $windows = $tournament->matches()
            ->whereNotNull('kickoff_at')
            ->get()
            ->map(fn (GameMatch $match): array => [
                'start' => $match->kickoff_at->getTimestamp(),
                'end' => $match->kickoff_at->getTimestamp() + $durationSeconds,
                'match' => $match,
            ])
            ->sortBy('start')
            ->values()
            ->all();

        $collisions = [];
        $count = count($windows);

        for ($i = 0; $i < $count; $i++) {
            for ($j = $i + 1; $j < $count && $windows[$j]['start'] < $windows[$i]['end']; $j++) {
                $this->record($collisions, $windows[$i]['match'], $windows[$j]['match']);
            }
        }

        return $collisions;
    }

    /**
     * Jedna para może dać dwie kolizje (i drużyna, i obiekt), a wpis dostają
     * obie strony: kolizja jest symetryczna.
     *
     * @param  array<int, list<array{type: string, matchId: int}>>  $collisions
     */
    private function record(array &$collisions, GameMatch $a, GameMatch $b): void
    {
        if ($this->shareTeam($a, $b)) {
            $this->add($collisions, $a->id, 'team', $b->id);
            $this->add($collisions, $b->id, 'team', $a->id);
        }

        if ($a->venue_id !== null && $a->venue_id === $b->venue_id) {
            $this->add($collisions, $a->id, 'venue', $b->id);
            $this->add($collisions, $b->id, 'venue', $a->id);
        }
    }

    /**
     * @param  array<int, list<array{type: string, matchId: int}>>  $collisions
     */
    private function add(array &$collisions, int $matchId, string $type, int $otherId): void
    {
        $collisions[$matchId][] = ['type' => $type, 'matchId' => $otherId];
    }

    /** Slot drabinki bez rozstrzygniętej drużyny nie ma z kim kolidować. */
    private function shareTeam(GameMatch $a, GameMatch $b): bool
    {
        $teams = array_filter([$a->home_team_id, $a->away_team_id], fn (?int $id): bool => $id !== null);

        return in_array($b->home_team_id, $teams, strict: true)
            || in_array($b->away_team_id, $teams, strict: true);
    }
}
