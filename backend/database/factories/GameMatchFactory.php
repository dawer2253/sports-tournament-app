<?php

namespace Database\Factories;

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameMatch>
 */
class GameMatchFactory extends Factory
{
    /**
     * `stage_id` jest wyprowadzane z kolejki, nie losowane: to zdenormalizowana
     * kopia, która ma być zgodna z `round.stage_id`, a nie drugim źródłem prawdy.
     *
     * Drużyny domyślnie z tego samego turnieju co faza — mecz drużyn z dwóch
     * różnych turniejów nie istnieje, więc factory nie powinno go umieć zrobić.
     */
    public function definition(): array
    {
        $round = Round::factory();

        return [
            'round_id' => $round,
            'stage_id' => fn (array $attributes) => Round::findOrFail($attributes['round_id'])->stage_id,
            'group_id' => null,
            'match_number' => 1,
            'home_team_id' => fn (array $attributes) => Team::factory()->state([
                'tournament_id' => Round::findOrFail($attributes['round_id'])->stage->tournament_id,
            ]),
            'away_team_id' => fn (array $attributes) => Team::factory()->state([
                'tournament_id' => Round::findOrFail($attributes['round_id'])->stage->tournament_id,
            ]),
            'home_score' => null,
            'away_score' => null,
            'home_penalties' => null,
            'away_penalties' => null,
            'status' => 'scheduled',
            'kickoff_at' => fake()->dateTimeBetween('+1 week', '+2 months'),
            'venue_id' => null,
            'winner_to_match_id' => null,
            'loser_to_match_id' => null,
            'advances_to_slot' => null,
        ];
    }

    /** Mecz rozegrany — dopiero taki wchodzi do tabeli i do statystyk. */
    public function finished(int $home = 2, int $away = 1): static
    {
        return $this->state([
            'status' => 'finished',
            'home_score' => $home,
            'away_score' => $away,
        ]);
    }
}
