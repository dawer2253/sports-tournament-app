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

it('usuwa drużynę miękko i oddaje 204', function () {
    $team = Team::factory()->create();

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidRequest()
        ->assertValidResponse(204);

    expect(Team::withTrashed()->findOrFail($team->id)->trashed())->toBeTrue();
});

// Zawodników nie da się dziś odczytać przez API (trasy przychodzą z CRUD-em
// zawodników), więc ich stan czyta model. Zawodnik innej drużyny tego samego
// turnieju pilnuje, że kaskada idzie przez relację usuwanej drużyny.
it('usuwa miękko zawodników drużyny i tylko ich', function () {
    $team = Team::factory()->create();
    $players = Player::factory()->count(2)->for($team)->create();
    $otherPlayer = Player::factory()->for(Team::factory()->for($team->tournament))->create();

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(204);

    foreach ($players as $player) {
        expect(Player::withTrashed()->findOrFail($player->id)->deleted_at)->not->toBeNull();
    }
    expect($otherPlayer->fresh()->deleted_at)->toBeNull();
});

// Guard ma ruszyć przed kaskadą: gdyby było odwrotnie, odrzucone usunięcie
// zostawiłoby żywą drużynę bez zawodników.
it('nie usuwa ani drużyny, ani jej zawodników, gdy drużyna ma rozegrany mecz', function () {
    $team = Team::factory()->create(['name' => 'Wilki Bemowo']);
    $player = Player::factory()->for($team)->create();
    GameMatch::factory()
        ->for(Round::factory()->for(Stage::factory()->for($team->tournament)))
        ->finished()
        ->create(['home_team_id' => $team->id]);

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: drużyna „Wilki Bemowo” ma powiązane rozegrane mecze.']);

    expect($team->fresh()->deleted_at)->toBeNull()
        ->and($player->fresh()->deleted_at)->toBeNull();
});

// Baza nie wiąże zawodnika zdarzenia z drużyną meczu (`team_id` i `player_id`
// w `match_events` to osobne klucze), więc zawodnik może mieć rozegrany mecz,
// którego jego drużyna nie ma. Wtedy odmawia guard zawodnika w środku kaskady
// i transakcja musi cofnąć usunięcie samej drużyny.
it('cofa usunięcie drużyny, gdy guard zawodnika odrzuca kaskadę', function () {
    $team = Team::factory()->create();
    $player = Player::factory()->for($team)->create(['name' => 'Marek Nowak']);
    $match = GameMatch::factory()
        ->for(Round::factory()->for(Stage::factory()->for($team->tournament)))
        ->finished()
        ->create();
    MatchEvent::factory()->for($match, 'match')->create([
        'team_id' => $match->home_team_id,
        'player_id' => $player->id,
    ]);

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: zawodnik „Marek Nowak” ma powiązane rozegrane mecze.']);

    expect($team->fresh()->deleted_at)->toBeNull()
        ->and($player->fresh()->deleted_at)->toBeNull();
});

it('zmniejsza liczbę drużyn w szczegółach turnieju', function () {
    $team = Team::factory()->create();
    Team::factory()->for($team->tournament)->create();
    $organizer = $team->tournament->user;

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$team->tournament_id}")
        ->assertJsonPath('data.teamsCount', 2);

    actingAsOrganizer($organizer)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(204);

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$team->tournament_id}")
        ->assertValidResponse(200)
        ->assertJsonPath('data.teamsCount', 1);
});
