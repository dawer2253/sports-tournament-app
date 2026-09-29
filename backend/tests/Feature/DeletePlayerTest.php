<?php

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

it('usuwa zawodnika miękko i oddaje 204', function () {
    $player = Player::factory()->create();

    actingAsOrganizer($player->team->tournament->user)
        ->deleteJson("/api/v1/players/{$player->id}")
        ->assertValidRequest()
        ->assertValidResponse(204);

    expect(Player::withTrashed()->findOrFail($player->id)->trashed())->toBeTrue();
});

it('nie usuwa zawodnika ze zdarzeniem w rozegranym meczu', function () {
    $team = Team::factory()->create();
    $player = Player::factory()->for($team)->create(['name' => 'Marek Nowak']);
    $match = GameMatch::factory()
        ->for(Round::factory()->for(Stage::factory()->for($team->tournament)))
        ->finished()
        ->create(['home_team_id' => $team->id]);
    MatchEvent::factory()->for($match, 'match')->create([
        'team_id' => $team->id,
        'player_id' => $player->id,
    ]);

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/players/{$player->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: zawodnik „Marek Nowak” ma powiązane rozegrane mecze.']);

    expect($player->fresh()->deleted_at)->toBeNull();
});

// Bez wymogu żywej drużyny w wiązaniu `PlayerPolicy` dostałaby `null`
// z `$player->team` i oddała 500.
it('oddaje 404 dla zawodnika drużyny usuniętej', function () {
    $team = Team::factory()->create();
    $player = Player::factory()->for($team)->create();
    softDeleteTeamLeavingPlayers($team);

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/players/{$player->id}")
        ->assertValidResponse(404)
        ->assertExactJson(['message' => contractErrorMessage('NotFound')]);

    expect($player->fresh()->deleted_at)->toBeNull();
});
