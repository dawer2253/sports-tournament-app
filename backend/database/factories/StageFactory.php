<?php

namespace Database\Factories;

use App\Models\Stage;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Stage>
 *
 * `order` domyślnie 1, bo para `(tournament_id, order)` jest unikalna —
 * tworząc drugą fazę w tym samym turnieju, podaj `order` jawnie.
 */
class StageFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tournament_id' => Tournament::factory(),
            'type' => 'league',
            'name' => 'Faza ligowa',
            'order' => 1,
        ];
    }

    public function group(): static
    {
        return $this->state(['type' => 'group', 'name' => 'Faza grupowa']);
    }

    public function knockout(): static
    {
        return $this->state(['type' => 'knockout', 'name' => 'Faza pucharowa']);
    }
}
