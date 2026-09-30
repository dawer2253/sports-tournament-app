<?php

use App\Models\Player;
use App\Models\Team;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

// Zawodnik usunięty i zawodnik innej drużyny tego samego turnieju stoją obok,
// więc liczba 2 wychodzi tylko z własnych, żywych zawodników.
it('oddaje drużynę z liczbą jej żywych zawodników', function () {
    $team = Team::factory()->create(['name' => 'Wilki Bemowo']);
    Player::factory()->count(2)->for($team)->create();
    Player::factory()->for($team)->create()->delete();
    Player::factory()->for(Team::factory()->for($team->tournament))->create();

    actingAsOrganizer($team->tournament->user)
        ->getJson("/api/v1/teams/{$team->id}")
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertExactJson(['data' => [
            'id' => $team->id,
            'tournamentId' => $team->tournament_id,
            'name' => 'Wilki Bemowo',
            'logoUrl' => null,
            'groupId' => null,
            'playersCount' => 2,
        ]]);
});
