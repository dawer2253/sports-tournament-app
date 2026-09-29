<?php

use App\Models\Player;
use App\Models\Team;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`. Reguły nazwy
// są wspólne z `POST` (`TeamRequest`) i tam mają pełny komplet przypadków;
// tu zostaje to, czym `PATCH` się różni.

it('zmienia nazwę drużyny i oddaje ją z liczbą zawodników', function () {
    $team = Team::factory()->create(['name' => 'Wilki Bemowo']);
    Player::factory()->count(2)->for($team)->create();

    actingAsOrganizer($team->tournament->user)
        ->patchJson("/api/v1/teams/{$team->id}", ['name' => 'Wilki Bemowo II'])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.id', $team->id)
        ->assertJsonPath('data.name', 'Wilki Bemowo II')
        ->assertJsonPath('data.playersCount', 2);

    expect($team->fresh()->name)->toBe('Wilki Bemowo II');
});

// Bez `ignore($team)` drużyna kolidowałaby sama ze sobą. Zmiana samej
// wielkości liter też musi przejść, bo collation widzi w niej tę samą nazwę.
it('przyjmuje własną nazwę drużyny', function (string $name) {
    $team = Team::factory()->create(['name' => 'Wilki Bemowo']);

    actingAsOrganizer($team->tournament->user)
        ->patchJson("/api/v1/teams/{$team->id}", ['name' => $name])
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', $name);
})->with([
    'bez zmian' => ['Wilki Bemowo'],
    'inna wielkość liter' => ['WILKI BEMOWO'],
]);

it('odrzuca nazwę innej drużyny tego turnieju', function () {
    $team = Team::factory()->create(['name' => 'Wilki Bemowo']);
    Team::factory()->for($team->tournament)->create(['name' => 'Orły Bielany']);

    actingAsOrganizer($team->tournament->user)
        ->patchJson("/api/v1/teams/{$team->id}", ['name' => 'orły bielany'])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.name', ['W tym turnieju jest już drużyna o tej nazwie.']);

    expect($team->fresh()->name)->toBe('Wilki Bemowo');
});

// Kontrakt nie wymaga w `PATCH` żadnego pola, więc puste ciało niczego nie
// zmienia i nie jest błędem.
it('przyjmuje puste ciało bez zmian', function () {
    $team = Team::factory()->create(['name' => 'Wilki Bemowo']);

    actingAsOrganizer($team->tournament->user)
        ->patchJson("/api/v1/teams/{$team->id}", [])
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', 'Wilki Bemowo');
});

// `name` jest opcjonalne, ale wysłane nie może być puste. `TrimStrings`
// i `ConvertEmptyStringsToNull` robią z samych spacji `null`.
it('odrzuca pustą nazwę', function (string $name) {
    $team = Team::factory()->create(['name' => 'Wilki Bemowo']);

    actingAsOrganizer($team->tournament->user)
        ->patchJson("/api/v1/teams/{$team->id}", ['name' => $name])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('name');

    expect($team->fresh()->name)->toBe('Wilki Bemowo');
})->with([
    'pusty napis' => [''],
    'same spacje' => ['   '],
]);
