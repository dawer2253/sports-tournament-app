<?php

use App\Models\Player;
use App\Models\Team;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.
//
// Helper ląduje w globalnej przestrzeni nazw, wspólnej dla całego przebiegu
// Pesta, stąd nazwa, której nie użyje inny plik.

function postPlayerTo(Team $team, array $body): TestResponse
{
    return actingAsOrganizer($team->tournament->user)
        ->postJson("/api/v1/teams/{$team->id}/players", $body);
}

it('dodaje zawodnika do drużyny z trasy', function () {
    $team = Team::factory()->create();

    $response = postPlayerTo($team, ['name' => 'Marek Nowak', 'number' => 9, 'position' => 'napastnik'])
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data.teamId', $team->id)
        ->assertJsonPath('data.name', 'Marek Nowak')
        ->assertJsonPath('data.number', 9)
        ->assertJsonPath('data.position', 'napastnik');

    expect(Player::findOrFail($response->json('data.id')))
        ->team_id->toBe($team->id)
        ->number->toBe(9);
});

it('dodaje zawodnika z samym imieniem i nazwiskiem', function () {
    $team = Team::factory()->create();

    postPlayerTo($team, ['name' => 'Marek Nowak'])
        ->assertValidResponse(201)
        ->assertJsonPath('data.number', null)
        ->assertJsonPath('data.position', null);
});

it('odrzuca numer zajęty w drużynie pod kluczem number', function () {
    $team = Team::factory()->create();
    Player::factory()->for($team)->create(['number' => 9]);

    postPlayerTo($team, ['name' => 'Marek Nowak', 'number' => 9])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.number', ['Ten numer ma już inny zawodnik tej drużyny.']);

    expect($team->players()->count())->toBe(1);
});

// Obie drużyny są w tym samym turnieju, więc unikalność musi iść po drużynie,
// a nie po turnieju.
it('przyjmuje numer zajęty w innej drużynie', function () {
    $team = Team::factory()->create();
    Player::factory()->for(Team::factory()->for($team->tournament))->create(['number' => 9]);

    postPlayerTo($team, ['name' => 'Marek Nowak', 'number' => 9])->assertValidResponse(201);
});

it('przyjmuje drugiego zawodnika bez numeru', function (array $body) {
    $team = Team::factory()->create();
    Player::factory()->for($team)->create(['number' => null]);

    postPlayerTo($team, ['name' => 'Marek Nowak', ...$body])
        ->assertValidResponse(201)
        ->assertJsonPath('data.number', null);
})->with([
    'jawny null' => [['number' => null]],
    'pominięty' => [[]],
]);

it('przyjmuje numer zawodnika usuniętego', function () {
    $team = Team::factory()->create();
    Player::factory()->for($team)->create(['number' => 9])->delete();

    postPlayerTo($team, ['name' => 'Marek Nowak', 'number' => 9])
        ->assertValidResponse(201)
        ->assertJsonPath('data.number', 9);
});

// Decyzja #80: imię i nazwisko nie identyfikuje zawodnika.
it('przyjmuje drugiego zawodnika o tym samym imieniu i nazwisku', function () {
    $team = Team::factory()->create();
    Player::factory()->for($team)->create(['name' => 'Marek Nowak']);

    postPlayerTo($team, ['name' => 'Marek Nowak'])->assertValidResponse(201);

    expect($team->players()->where('name', 'Marek Nowak')->count())->toBe(2);
});

// Kolumna miała 40 znaków, więc to zapisanie przechodzi dopiero po migracji
// poszerzającej ją do długości z kontraktu.
it('zapisuje pozycję o długości 60 znaków', function () {
    $team = Team::factory()->create();
    $position = str_repeat('ś', 60);

    $response = postPlayerTo($team, ['name' => 'Marek Nowak', 'position' => $position])
        ->assertValidResponse(201)
        ->assertJsonPath('data.position', $position);

    expect(Player::findOrFail($response->json('data.id'))->position)->toBe($position);
});

// Granice z kontraktu, każda o jeden za daleko. Komunikaty sprawdzają też
// nazwy pól z `lang/pl/validation.php`.
it('odrzuca wartości spoza kontraktu', function (array $body, string $field, string $message) {
    $team = Team::factory()->create();

    postPlayerTo($team, ['name' => 'Marek Nowak', ...$body])
        ->assertValidResponse(422)
        ->assertJsonPath("errors.{$field}", [$message]);

    expect($team->players()->count())->toBe(0);
})->with([
    'puste imię i nazwisko' => [['name' => ''], 'name', 'Pole imię i nazwisko jest wymagane.'],
    'imię i nazwisko 121 znaków' => [['name' => str_repeat('a', 121)], 'name', 'Pole imię i nazwisko nie może mieć więcej niż 120 znaków.'],
    'numer ujemny' => [['number' => -1], 'number', 'Pole numer musi mieścić się w przedziale od 0 do 999.'],
    'numer 1000' => [['number' => 1000], 'number', 'Pole numer musi mieścić się w przedziale od 0 do 999.'],
    'numer ułamkowy' => [['number' => 9.5], 'number', 'Pole numer musi być liczbą całkowitą.'],
    // Zwykłe `integer` przepuszcza oba i odpowiedź oddałaby je bez zmiany typu.
    'numer jako napis' => [['number' => '9'], 'number', 'Pole numer musi być liczbą całkowitą.'],
    'numer jako wartość logiczna' => [['number' => true], 'number', 'Pole numer musi być liczbą całkowitą.'],
    'pozycja 61 znaków' => [['position' => str_repeat('a', 61)], 'position', 'Pole pozycja nie może mieć więcej niż 60 znaków.'],
]);

// 50 to liczba z kontraktu, wpisana tu wprost, a nie wzięta ze stałej:
// test ma się zaczerwienić, gdy stała rozjedzie się z kontraktem.
it('odrzuca 51. zawodnika pod kluczem players', function () {
    $team = Team::factory()->create();
    Player::factory()->count(50)->for($team)->create();

    postPlayerTo($team, ['name' => 'Marek Nowak'])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.players', ['Drużyna ma już 50 zawodników, to górny limit.']);

    expect($team->players()->count())->toBe(50);
});

it('nie wlicza do limitu zawodników usuniętych', function () {
    $team = Team::factory()->create();
    Player::factory()->count(49)->for($team)->create();
    Player::factory()->for($team)->create()->delete();

    postPlayerTo($team, ['name' => 'Marek Nowak'])->assertValidResponse(201);
});
