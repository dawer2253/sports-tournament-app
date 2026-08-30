<?php

namespace Database\Factories;

use App\Models\Sport;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tournament>
 */
class TournamentFactory extends Factory
{
    /**
     * Sport bierzemy z bazy, a nie z factory — sporty wstawia migracja i są
     * predefiniowane (decyzja #10). Punktacja jest kopiowana z domyślnej dla
     * sportu, dokładnie tak jak przy zakładaniu turnieju w panelu.
     */
    public function definition(): array
    {
        $sport = Sport::firstWhere('code', 'football');

        return [
            'user_id' => User::factory(),
            'sport_id' => $sport->id,
            'name' => 'Liga Osiedlowa '.fake()->year(),
            'slug' => fake()->unique()->slug(3),
            'logo_url' => null,
            'primary_color' => fake()->hexColor(),
            'points' => $sport->defaultPoints(),
            'tiebreakers' => ['points', 'head_to_head', 'score_diff', 'score_for'],
            'status' => 'draft',
        ];
    }

    public function basketball(): static
    {
        return $this->state(function () {
            $sport = Sport::firstWhere('code', 'basketball');

            return [
                'sport_id' => $sport->id,
                'points' => $sport->defaultPoints(),
            ];
        });
    }

    public function active(): static
    {
        return $this->state(['status' => 'active']);
    }
}
