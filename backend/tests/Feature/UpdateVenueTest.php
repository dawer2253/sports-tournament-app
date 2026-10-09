<?php

use App\Models\Venue;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`. Reguły nazwy
// są wspólne z `POST` (`VenueRequest`) i tam mają pełny komplet przypadków;
// tu zostaje to, czym `PATCH` się różni.

/**
 * Ląduje w globalnej przestrzeni nazw, wspólnej dla całego przebiegu Pesta,
 * stąd nazwa, której nie użyje inny plik.
 */
function patchVenue(Venue $venue, array $body): TestResponse
{
    return actingAsOrganizer($venue->tournament->user)
        ->patchJson("/api/v1/venues/{$venue->id}", $body);
}

it('zmienia nazwę i adres obiektu', function () {
    $venue = Venue::factory()->create(['name' => 'Hala Ursus']);

    patchVenue($venue, [
        'name' => 'Hala Ursus II',
        'address' => 'ul. Sosnkowskiego 3, Warszawa',
    ])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data', [
            'id' => $venue->id,
            'tournamentId' => $venue->tournament_id,
            'name' => 'Hala Ursus II',
            'address' => 'ul. Sosnkowskiego 3, Warszawa',
        ]);

    expect($venue->fresh()->name)->toBe('Hala Ursus II');
});

// Bez `ignore($venue)` obiekt kolidowałby sam ze sobą. Zmiana samej
// wielkości liter też musi przejść, bo collation widzi w niej tę samą nazwę.
it('przyjmuje własną nazwę obiektu', function (string $name) {
    $venue = Venue::factory()->create(['name' => 'Hala Ursus']);

    patchVenue($venue, ['name' => $name])
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', $name);
})->with([
    'bez zmian' => ['Hala Ursus'],
    'inna wielkość liter' => ['HALA URSUS'],
]);

it('odrzuca nazwę innego obiektu tego turnieju', function () {
    $venue = Venue::factory()->create(['name' => 'Hala Ursus']);
    Venue::factory()->for($venue->tournament)->create(['name' => 'Boisko Bemowo']);

    patchVenue($venue, ['name' => 'boisko bemowo'])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.name', ['W tym turnieju jest już obiekt o tej nazwie.']);

    expect($venue->fresh()->name)->toBe('Hala Ursus');
});

// Kontrakt nie wymaga w `PATCH` żadnego pola, więc pominięte pole zostaje
// takie, jakie było — także adres, którego nie wolno tu po cichu wyzerować.
it('nie rusza pól pominiętych w ciele', function () {
    $venue = Venue::factory()->create([
        'name' => 'Hala Ursus',
        'address' => 'ul. Sosnkowskiego 3, Warszawa',
    ]);

    patchVenue($venue, [])
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', 'Hala Ursus')
        ->assertJsonPath('data.address', 'ul. Sosnkowskiego 3, Warszawa');
});

it('czyści adres wysłany jako null albo pusty napis', function (?string $address) {
    $venue = Venue::factory()->create(['address' => 'ul. Sosnkowskiego 3, Warszawa']);

    patchVenue($venue, ['address' => $address])
        ->assertValidResponse(200)
        ->assertJsonPath('data.address', null);

    expect($venue->fresh()->address)->toBeNull();
})->with([
    'null' => [null],
    'pusty napis' => [''],
]);

// `name` jest opcjonalne, ale wysłane nie może być puste. `TrimStrings`
// i `ConvertEmptyStringsToNull` robią z samych spacji `null`.
it('odrzuca pustą nazwę', function (?string $name) {
    $venue = Venue::factory()->create(['name' => 'Hala Ursus']);

    patchVenue($venue, ['name' => $name])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('name');

    expect($venue->fresh()->name)->toBe('Hala Ursus');
})->with([
    'null' => [null],
    'pusty napis' => [''],
    'same spacje' => ['   '],
]);
