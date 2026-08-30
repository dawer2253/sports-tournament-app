<?php

namespace Database\Factories;

use App\Models\Player;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Player>
 */
class PlayerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => fake()->name(),
            'number' => fake()->numberBetween(1, 99),
            'position' => fake()->randomElement(['bramkarz', 'obrońca', 'pomocnik', 'napastnik']),
        ];
    }
}
