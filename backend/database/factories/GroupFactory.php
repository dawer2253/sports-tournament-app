<?php

namespace Database\Factories;

use App\Models\Group;
use App\Models\Stage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Group>
 */
class GroupFactory extends Factory
{
    /**
     * `tournament_id` wynika z fazy i jest tu wyprowadzane, a nie losowane —
     * grupa w cudzym turnieju to dokładnie ten błąd, którego pilnujemy.
     *
     * `order` domyślnie 1, bo para `(stage_id, order)` jest unikalna — kolejne
     * grupy tej samej fazy potrzebują jawnego `order`.
     */
    public function definition(): array
    {
        return [
            'stage_id' => Stage::factory()->group(),
            'tournament_id' => fn (array $attributes) => Stage::findOrFail($attributes['stage_id'])->tournament_id,
            'name' => 'Grupa '.fake()->randomElement(['A', 'B', 'C', 'D']),
            'order' => 1,
            'qualifiers' => 2,
        ];
    }
}
