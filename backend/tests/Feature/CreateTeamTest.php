<?php

use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.
//
// Helper ląduje w globalnej przestrzeni nazw, wspólnej dla całego przebiegu
// Pesta, stąd nazwa, której nie użyje inny plik.

function postTeamTo(Tournament $tournament, array $body): TestResponse
{
    return actingAsOrganizer($tournament->user)
        ->postJson("/api/v1/tournaments/{$tournament->id}/teams", $body);
}

it('dodaje drużynę do turnieju z trasy, bez zawodników', function () {
    $tournament = Tournament::factory()->create();

    $response = postTeamTo($tournament, ['name' => 'Wilki Bemowo'])
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data.tournamentId', $tournament->id)
        ->assertJsonPath('data.name', 'Wilki Bemowo')
        ->assertJsonPath('data.logoUrl', null)
        ->assertJsonPath('data.groupId', null)
        ->assertJsonPath('data.playersCount', 0);

    expect(Team::findOrFail($response->json('data.id'))->tournament_id)->toBe($tournament->id);
});

// Porównanie bez względu na wielkość liter daje collation kolumny, nie kod,
// a spacje na brzegach obcina globalny `TrimStrings`, zanim ruszy walidacja.
// Oba mechanizmy siedzą poza Form Requestem, więc przypina je dopiero żądanie.
it('odrzuca nazwę zajętą w turnieju, także inną wielkością liter i ze spacjami na brzegach', function (string $name) {
    $tournament = Tournament::factory()->create();
    Team::factory()->for($tournament)->create(['name' => 'Wilki Bemowo']);

    postTeamTo($tournament, ['name' => $name])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.name', ['W tym turnieju jest już drużyna o tej nazwie.']);

    expect($tournament->teams()->count())->toBe(1);
})->with([
    'wielkie litery' => ['WILKI BEMOWO'],
    'spacje na początku' => ['  Wilki Bemowo'],
]);

// Decyzja #8: dwie drużyny o tej samej nazwie w dwóch turniejach to dwa
// niepowiązane byty. Oba turnieje mają tego samego organizera, więc test
// nie przejdzie przypadkiem przez zawężenie po organizerze.
it('przyjmuje nazwę zajętą w innym turnieju', function () {
    $tournament = Tournament::factory()->create();
    Team::factory()
        ->for(Tournament::factory()->for($tournament->user))
        ->create(['name' => 'Wilki Bemowo']);

    postTeamTo($tournament, ['name' => 'Wilki Bemowo'])->assertValidResponse(201);
});

it('przyjmuje nazwę drużyny usuniętej', function () {
    $tournament = Tournament::factory()->create();
    Team::factory()->for($tournament)->create(['name' => 'Wilki Bemowo'])->delete();

    postTeamTo($tournament, ['name' => 'Wilki Bemowo'])
        ->assertValidResponse(201)
        ->assertJsonPath('data.name', 'Wilki Bemowo');
});

// 128 to liczba z kontraktu, wpisana tu wprost, a nie wzięta ze stałej:
// test ma się zaczerwienić, gdy stała rozjedzie się z kontraktem.
it('odrzuca 129. drużynę pod kluczem teams', function () {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(128)->for($tournament)->create();

    postTeamTo($tournament, ['name' => 'Wilki Bemowo'])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.teams', ['Turniej ma już 128 drużyn, to górny limit.']);

    expect($tournament->teams()->count())->toBe(128);
});

it('nie wlicza do limitu drużyn usuniętych', function () {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(127)->for($tournament)->create();
    Team::factory()->for($tournament)->create()->delete();

    postTeamTo($tournament, ['name' => 'Wilki Bemowo'])->assertValidResponse(201);
});
