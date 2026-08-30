<?php

namespace Database\Factories;

use App\Models\Group;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Team>
 */
class TeamFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tournament_id' => Tournament::factory(),
            'group_id' => null,
            'name' => fake()->unique()->company(),
            'logo_url' => null,
        ];
    }

    /**
     * Przypisuje drużynę do grupy **i** przenosi ją do turnieju tej grupy.
     * Inaczej factory produkowałoby dokładnie ten niespójny stan, przed którym
     * broni walidacja.
     */
    public function inGroup(Group $group): static
    {
        return $this->state([
            'group_id' => $group->id,
            'tournament_id' => $group->tournament_id,
        ]);
    }
}
