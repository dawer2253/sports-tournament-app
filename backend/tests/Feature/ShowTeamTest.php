<?php

use App\Models\GameMatch;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
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
            'scheduledMatchesCount' => 0,
        ]]);
});

// Szczegóły liczą mecze innym zapytaniem niż lista (`loadCount` zamiast
// `withCount`), więc licznik sprawdzamy także tutaj.
it('oddaje drużynę z liczbą jej meczów scheduled', function () {
    $team = Team::factory()->create();
    $round = Round::factory()->for(Stage::factory()->for($team->tournament))->create();
    GameMatch::factory()->for($round)->create(['away_team_id' => $team->id]);
    GameMatch::factory()->for($round)->live()->create(['match_number' => 2, 'home_team_id' => $team->id]);

    actingAsOrganizer($team->tournament->user)
        ->getJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(200)
        ->assertJsonPath('data.scheduledMatchesCount', 1);
});
