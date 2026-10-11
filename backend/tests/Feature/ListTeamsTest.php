<?php

use App\Models\GameMatch;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`, razem z każdą
// inną trasą poddrzewa turnieju. Tu zostaje szczęśliwa ścieżka i izolacja listy.

// Kolejność wstawiania to `sokoły`, `Orły`, `Wilki`. Sortowanie po `id` dałoby
// `sokoły` na początku, a binarne (wielkie litery przed małymi) — na końcu.
// Tylko porównanie bez względu na wielkość liter daje kolejność z kontraktu.
it('oddaje drużyny po nazwie bez względu na wielkość liter, w kształcie z kontraktu', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $sokoly = Team::factory()->for($tournament)->create(['name' => 'sokoły']);
    $orly = Team::factory()->for($tournament)->create(['name' => 'Orły']);
    $wilki = Team::factory()->for($tournament)->create(['name' => 'Wilki']);

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/teams")
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.name', ['Orły', 'sokoły', 'Wilki'])
        ->assertJsonPath('data.*.id', [$orly->id, $sokoly->id, $wilki->id])
        ->assertJsonPath('data.0', [
            'id' => $orly->id,
            'tournamentId' => $tournament->id,
            'name' => 'Orły',
            'logoUrl' => null,
            'groupId' => null,
            'playersCount' => 0,
            'scheduledMatchesCount' => 0,
        ]);
});

// Oba turnieje należą do tego samego organizera, więc policy przepuści
// żądanie. Obce drużyny odsiewa wyłącznie to, że lista idzie przez relację
// turnieju z trasy.
it('nie oddaje drużyn innego turnieju ani usuniętych', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $own = Team::factory()->for($tournament)->create();
    Team::factory()->for($tournament)->create()->delete();
    Team::factory()->for(Tournament::factory()->for($organizer))->create();

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/teams")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$own->id]);
});

// Każda drużyna ma inną liczbę zawodników, więc liczba przypisana nie tej
// drużynie, co trzeba, też wyjdzie na jaw.
it('liczy zawodników każdej drużyny osobno, bez usuniętych', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $orly = Team::factory()->for($tournament)->create(['name' => 'Orły']);
    $wilki = Team::factory()->for($tournament)->create(['name' => 'Wilki']);
    Player::factory()->count(3)->for($orly)->create();
    Player::factory()->for($orly)->create()->delete();
    Player::factory()->for($wilki)->create();

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/teams")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.playersCount', [3, 1]);
});

// Orły grają dwa mecze `scheduled`, raz u siebie i raz na wyjeździe, a do
// tego jeden `live` i jeden `finished`, które liczyć się nie mają. Pozostałe
// drużyny mają po jednym `scheduled`, więc liczba policzona tylko po jednej
// stronie albo z meczami rozegranymi dałaby inną listę.
it('liczy mecze scheduled drużyny po obu stronach, bez live i finished', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $orly = Team::factory()->for($tournament)->create(['name' => 'Orły']);
    $sokoly = Team::factory()->for($tournament)->create(['name' => 'Sokoły']);
    $wilki = Team::factory()->for($tournament)->create(['name' => 'Wilki']);
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    $match = fn (int $number, Team $home, Team $away) => GameMatch::factory()
        ->for($round)
        ->state(['match_number' => $number, 'home_team_id' => $home->id, 'away_team_id' => $away->id]);
    $match(1, $orly, $sokoly)->create();
    $match(2, $wilki, $orly)->create();
    $match(3, $orly, $sokoly)->live()->create();
    $match(4, $wilki, $orly)->finished()->create();

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/teams")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.name', ['Orły', 'Sokoły', 'Wilki'])
        ->assertJsonPath('data.*.scheduledMatchesCount', [2, 1, 1]);
});
