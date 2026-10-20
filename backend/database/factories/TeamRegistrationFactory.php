<?php

namespace Database\Factories;

use App\Models\TeamRegistration;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TeamRegistration>
 */
class TeamRegistrationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tournament_id' => Tournament::factory(),
            'team_id' => null,
            'team_name' => fake()->unique()->company(),
            'status' => 'pending',
            'contact_name' => fake()->name(),
            'contact_email' => fake()->safeEmail(),
            'contact_phone' => null,
            'players' => [],
            'decided_at' => null,
        ];
    }

    /** Odrzucone tak, jak robi to `reject()`: bez danych osobowych. */
    public function rejected(): static
    {
        return $this->state([
            'status' => 'rejected',
            'decided_at' => now(),
            'contact_name' => null,
            'contact_email' => null,
            'contact_phone' => null,
            'players' => null,
        ]);
    }
}
