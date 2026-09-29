<?php

use App\Models\Player;
use App\Models\Team;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`. Tu zostaje
// szczęśliwa ścieżka i izolacja listy.

// Kolejność wstawiania jest inna niż oczekiwana, więc sortowanie po `id` nie
// przejdzie. `0` sprawdza, że zero nie jest brane za brak numeru, `10` za `9`,
// że numer sortuje się jak liczba, a dwóch „Adamów Lisów" bez numeru, że remis
// po `name` rozstrzyga `id`. Samo `ORDER BY number` w MySQL-u postawiłoby
// zawodników bez numeru na początku.
it('oddaje zawodników po numerze, bez numeru na końcu, potem po nazwisku i id', function () {
    $team = Team::factory()->create();
    $create = fn (?int $number, string $name): Player => Player::factory()
        ->for($team)
        ->create(['number' => $number, 'name' => $name, 'position' => null]);

    $zenon = $create(null, 'Zenon Wójcik');
    $marek = $create(9, 'Marek Nowak');
    $adam = $create(null, 'Adam Lis');
    $piotr = $create(1, 'Piotr Kowal');
    $adamToo = $create(null, 'Adam Lis');
    $bartek = $create(10, 'Bartek Zając');
    $olek = $create(0, 'Olek Sowa');

    actingAsOrganizer($team->tournament->user)
        ->getJson("/api/v1/teams/{$team->id}/players")
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [
            $olek->id, $piotr->id, $marek->id, $bartek->id, $adam->id, $adamToo->id, $zenon->id,
        ])
        ->assertJsonPath('data.*.number', [0, 1, 9, 10, null, null, null]);
});

it('oddaje zawodnika w kształcie z kontraktu', function () {
    $team = Team::factory()->create();
    $player = Player::factory()->for($team)->create([
        'name' => 'Marek Nowak',
        'number' => 9,
        'position' => 'napastnik',
    ]);

    actingAsOrganizer($team->tournament->user)
        ->getJson("/api/v1/teams/{$team->id}/players")
        ->assertValidResponse(200)
        ->assertExactJson(['data' => [[
            'id' => $player->id,
            'teamId' => $team->id,
            'name' => 'Marek Nowak',
            'number' => 9,
            'position' => 'napastnik',
        ]]]);
});

// Obie drużyny należą do tego samego turnieju, więc policy przepuści żądanie.
// Obcych zawodników odsiewa wyłącznie to, że lista idzie przez relację
// drużyny z trasy.
it('nie oddaje zawodników innej drużyny ani usuniętych', function () {
    $team = Team::factory()->create();
    $own = Player::factory()->for($team)->create();
    Player::factory()->for($team)->create()->delete();
    Player::factory()->for(Team::factory()->for($team->tournament))->create();

    actingAsOrganizer($team->tournament->user)
        ->getJson("/api/v1/teams/{$team->id}/players")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$own->id]);
});
