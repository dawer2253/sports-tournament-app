<?php

namespace Database\Factories;

use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Venue>
 */
class VenueFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tournament_id' => Tournament::factory(),
            'name' => 'Boisko '.fake()->streetName(),
            'address' => fake()->address(),
        ];
    }
}
