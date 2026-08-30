<?php

namespace Database\Factories;

use App\Models\Round;
use App\Models\Stage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Round>
 *
 * `order` domyślnie 1 — para `(stage_id, order)` jest unikalna, więc kolejne
 * kolejki tej samej fazy potrzebują jawnego `order`.
 */
class RoundFactory extends Factory
{
    public function definition(): array
    {
        return [
            'stage_id' => Stage::factory(),
            'name' => 'Kolejka 1',
            'order' => 1,
        ];
    }
}
