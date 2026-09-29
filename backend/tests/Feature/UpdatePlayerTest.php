<?php

use App\Models\Player;
use App\Models\Team;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`. Reguły pól są
// wspólne z `POST` (`PlayerRequest`) i tam mają pełny komplet przypadków;
// tu zostaje to, czym `PATCH` się różni.

it('zmienia zawodnika i oddaje go po zmianie', function () {
    $player = Player::factory()->create(['name' => 'Marek Nowak', 'number' => 9, 'position' => 'napastnik']);

    actingAsOrganizer($player->team->tournament->user)
        ->patchJson("/api/v1/players/{$player->id}", ['name' => 'Marek Nowacki', 'number' => 10, 'position' => 'pomocnik'])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertExactJson(['data' => [
            'id' => $player->id,
            'teamId' => $player->team_id,
            'name' => 'Marek Nowacki',
            'number' => 10,
            'position' => 'pomocnik',
        ]]);

    expect($player->fresh())
        ->name->toBe('Marek Nowacki')
        ->number->toBe(10)
        ->position->toBe('pomocnik');
});

// Bez `ignore($player)` zawodnik kolidowałby sam ze sobą.
it('przyjmuje własny, niezmieniony numer', function () {
    $player = Player::factory()->create(['number' => 9]);

    actingAsOrganizer($player->team->tournament->user)
        ->patchJson("/api/v1/players/{$player->id}", ['number' => 9, 'name' => 'Marek Nowak'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.number', 9);
});

it('odrzuca numer innego zawodnika tej drużyny', function () {
    $player = Player::factory()->create(['number' => 9]);
    Player::factory()->for($player->team)->create(['number' => 7]);

    actingAsOrganizer($player->team->tournament->user)
        ->patchJson("/api/v1/players/{$player->id}", ['number' => 7])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.number', ['Ten numer ma już inny zawodnik tej drużyny.']);

    expect($player->fresh()->number)->toBe(9);
});

// `ignore($player)` i `whereNull('deleted_at')` działają w jednej regule,
// więc `PATCH` ma swój przypadek obok tego przy `POST`.
it('przyjmuje numer zawodnika usuniętego', function () {
    $player = Player::factory()->create(['number' => 9]);
    Player::factory()->for($player->team)->create(['number' => 7])->delete();

    actingAsOrganizer($player->team->tournament->user)
        ->patchJson("/api/v1/players/{$player->id}", ['number' => 7])
        ->assertValidResponse(200)
        ->assertJsonPath('data.number', 7);

    expect($player->fresh()->number)->toBe(7);
});

it('czyści numer i pozycję nullem', function () {
    $player = Player::factory()->create(['number' => 9, 'position' => 'napastnik']);

    actingAsOrganizer($player->team->tournament->user)
        ->patchJson("/api/v1/players/{$player->id}", ['number' => null, 'position' => null])
        ->assertValidResponse(200)
        ->assertJsonPath('data.number', null)
        ->assertJsonPath('data.position', null);

    expect($player->fresh())->number->toBeNull()->position->toBeNull();
});

// Kontrakt nie wymaga w `PATCH` żadnego pola, więc puste ciało niczego nie
// zmienia i nie jest błędem — w szczególności nie czyści numeru ani pozycji.
it('przyjmuje puste ciało bez zmian', function () {
    $player = Player::factory()->create(['name' => 'Marek Nowak', 'number' => 9, 'position' => 'napastnik']);

    actingAsOrganizer($player->team->tournament->user)
        ->patchJson("/api/v1/players/{$player->id}", [])
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', 'Marek Nowak')
        ->assertJsonPath('data.number', 9)
        ->assertJsonPath('data.position', 'napastnik');
});

it('odrzuca pustą nazwę', function () {
    $player = Player::factory()->create(['name' => 'Marek Nowak']);

    actingAsOrganizer($player->team->tournament->user)
        ->patchJson("/api/v1/players/{$player->id}", ['name' => '   '])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('name');

    expect($player->fresh()->name)->toBe('Marek Nowak');
});

// Bez wymogu żywej drużyny w wiązaniu `PlayerPolicy` dostałaby `null`
// z `$player->team` i oddała 500.
it('oddaje 404 dla zawodnika drużyny usuniętej', function () {
    $team = Team::factory()->create();
    $player = Player::factory()->for($team)->create(['name' => 'Marek Nowak']);
    softDeleteTeamLeavingPlayers($team);

    actingAsOrganizer($team->tournament->user)
        ->patchJson("/api/v1/players/{$player->id}", ['name' => 'Marek Nowacki'])
        ->assertValidResponse(404)
        ->assertExactJson(['message' => contractErrorMessage('NotFound')]);

    expect($player->fresh()->name)->toBe('Marek Nowak');
});
