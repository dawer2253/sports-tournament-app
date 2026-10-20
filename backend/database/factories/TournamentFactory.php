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
     * predefiniowane (decyzja #10). Punktacja, kolejność tiebreaków, długość
     * i podział meczu są kopiowane z domyślnych dla sportu, dokładnie tak jak
     * przy zakładaniu turnieju w panelu.
     */
    public function definition(): array
    {
        $sport = Sport::firstWhere('code', 'football');

        return [
            'user_id' => User::factory(),
            'sport_id' => $sport->id,
            'name' => 'Liga Osiedlowa '.fake()->year(),
            'slug' => fake()->unique()->slug(3),
            'logo_path' => null,
            'primary_color' => fake()->hexColor(),
            'points' => $sport->defaultPoints(),
            'tiebreakers' => $sport->defaultTiebreakers(),
            'match_duration' => $sport->defaultMatchDuration(),
            'period_count' => $sport->defaultPeriods()['count'],
            'period_minutes' => $sport->defaultPeriods()['minutes'],
            'status' => 'draft',
            'registration_open' => false,
            'registration_deadline' => null,
        ];
    }

    /** Turniej opublikowany z otwartymi zapisami (#300), bez terminu. */
    public function openForRegistration(): static
    {
        return $this->state(['status' => 'active', 'registration_open' => true]);
    }

    public function basketball(): static
    {
        return $this->state(function () {
            $sport = Sport::firstWhere('code', 'basketball');

            return [
                'sport_id' => $sport->id,
                'points' => $sport->defaultPoints(),
                'tiebreakers' => $sport->defaultTiebreakers(),
                'match_duration' => $sport->defaultMatchDuration(),
                'period_count' => $sport->defaultPeriods()['count'],
                'period_minutes' => $sport->defaultPeriods()['minutes'],
            ];
        });
    }
}
