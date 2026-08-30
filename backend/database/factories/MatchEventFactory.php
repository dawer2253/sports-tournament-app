<?php

namespace Database\Factories;

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MatchEvent>
 */
class MatchEventFactory extends Factory
{
    /**
     * Zdarzenie zawsze wisi na drużynie, która w tym meczu gra, i na zawodniku
     * z tej właśnie drużyny — inaczej klasyfikacja strzelców pokazywałaby
     * bramki dla drużyny, która ich nie zdobyła.
     */
    public function definition(): array
    {
        $match = GameMatch::factory();

        return [
            'match_id' => $match,
            'team_id' => fn (array $attributes) => GameMatch::findOrFail($attributes['match_id'])->home_team_id,
            'player_id' => fn (array $attributes) => Player::factory()->state([
                'team_id' => GameMatch::findOrFail($attributes['match_id'])->home_team_id,
            ]),
            'type' => 'goal',
            'minute' => fake()->numberBetween(1, 90),
            'meta' => null,
        ];
    }

    /** Zdarzenie bez zawodnika — np. kartka dla ławki. */
    public function withoutPlayer(): static
    {
        return $this->state(['player_id' => null]);
    }
}
