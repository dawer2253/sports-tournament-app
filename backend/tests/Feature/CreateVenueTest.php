<?php

use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.
//
// Helper ląduje w globalnej przestrzeni nazw, wspólnej dla całego przebiegu
// Pesta, stąd nazwa, której nie użyje inny plik.

function postVenueTo(Tournament $tournament, array $body): TestResponse
{
    return actingAsOrganizer($tournament->user)
        ->postJson("/api/v1/tournaments/{$tournament->id}/venues", $body);
}

it('dodaje obiekt do turnieju z trasy', function () {
    $tournament = Tournament::factory()->create();

    $response = postVenueTo($tournament, [
        'name' => 'Hala Ursus',
        'address' => 'ul. Sosnkowskiego 3, Warszawa',
    ])
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data.tournamentId', $tournament->id)
        ->assertJsonPath('data.name', 'Hala Ursus')
        ->assertJsonPath('data.address', 'ul. Sosnkowskiego 3, Warszawa');

    expect(Venue::findOrFail($response->json('data.id'))->tournament_id)->toBe($tournament->id);
});

// Pusty napis zamienia na `null` globalny `ConvertEmptyStringsToNull`, więc
// w bazie nie ląduje adres, którego nie ma.
it('przyjmuje obiekt bez adresu', function (array $body) {
    $tournament = Tournament::factory()->create();

    postVenueTo($tournament, ['name' => 'Hala Ursus', ...$body])
        ->assertValidResponse(201)
        ->assertJsonPath('data.address', null);

    expect($tournament->venues()->sole()->address)->toBeNull();
})->with([
    'pole pominięte' => [[]],
    'null' => [['address' => null]],
    'pusty napis' => [['address' => '']],
]);

it('odrzuca nazwę pustą albo dłuższą niż 120 znaków', function (?string $name) {
    $tournament = Tournament::factory()->create();

    postVenueTo($tournament, ['name' => $name])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('name');

    expect($tournament->venues()->count())->toBe(0);
})->with([
    'brak' => [null],
    'same spacje' => ['   '],
    '121 znaków' => [str_repeat('a', 121)],
]);

// Komunikat przypina polską nazwę pola z `lang/pl/validation.php`.
it('odrzuca adres dłuższy niż 255 znaków', function () {
    $tournament = Tournament::factory()->create();

    postVenueTo($tournament, ['name' => 'Hala Ursus', 'address' => str_repeat('a', 256)])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.address', ['Pole adres nie może mieć więcej niż 255 znaków.']);
});

// Porównanie bez względu na wielkość liter daje collation kolumny, nie kod,
// a spacje na brzegach obcina globalny `TrimStrings`, zanim ruszy walidacja.
// Oba mechanizmy siedzą poza Form Requestem, więc przypina je dopiero żądanie.
it('odrzuca nazwę zajętą w turnieju, także inną wielkością liter i ze spacjami na brzegach', function (string $name) {
    $tournament = Tournament::factory()->create();
    Venue::factory()->for($tournament)->create(['name' => 'Hala Ursus']);

    postVenueTo($tournament, ['name' => $name])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.name', ['W tym turnieju jest już obiekt o tej nazwie.']);

    expect($tournament->venues()->count())->toBe(1);
})->with([
    'wielkie litery' => ['HALA URSUS'],
    'spacje na początku' => ['  Hala Ursus'],
]);

// Oba turnieje mają tego samego organizera, więc test nie przejdzie
// przypadkiem przez zawężenie po organizerze.
it('przyjmuje nazwę zajętą w innym turnieju', function () {
    $tournament = Tournament::factory()->create();
    Venue::factory()
        ->for(Tournament::factory()->for($tournament->user))
        ->create(['name' => 'Hala Ursus']);

    postVenueTo($tournament, ['name' => 'Hala Ursus'])->assertValidResponse(201);
});

it('przyjmuje nazwę obiektu usuniętego', function () {
    $tournament = Tournament::factory()->create();
    Venue::factory()->for($tournament)->create(['name' => 'Hala Ursus'])->delete();

    postVenueTo($tournament, ['name' => 'Hala Ursus'])
        ->assertValidResponse(201)
        ->assertJsonPath('data.name', 'Hala Ursus');
});

// 32 to liczba z kontraktu, wpisana tu wprost, a nie wzięta ze stałej:
// test ma się zaczerwienić, gdy stała rozjedzie się z kontraktem.
it('odrzuca 33. obiekt pod kluczem venues', function () {
    $tournament = Tournament::factory()->create();
    Venue::factory()->count(32)->for($tournament)->create();

    postVenueTo($tournament, ['name' => 'Hala Ursus'])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.venues', ['Turniej ma już 32 obiekty, to górny limit.']);

    expect($tournament->venues()->count())->toBe(32);
});

it('nie wlicza do limitu obiektów usuniętych', function () {
    $tournament = Tournament::factory()->create();
    Venue::factory()->count(31)->for($tournament)->create();
    Venue::factory()->for($tournament)->create()->delete();

    postVenueTo($tournament, ['name' => 'Hala Ursus'])->assertValidResponse(201);
});
