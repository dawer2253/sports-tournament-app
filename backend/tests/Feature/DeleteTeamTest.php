<?php

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
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

// Stan zawodników czyta model, bo lista zawodników usuniętej drużyny to już
// 404. Zawodnik innej drużyny tego samego turnieju pilnuje, że kaskada idzie
// przez relację usuwanej drużyny.
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
// zostawiłoby żywą drużynę bez zawodników i bez meczów `scheduled`.
it('nie usuwa drużyny, jej zawodników ani meczów, gdy drużyna ma mecz rozegrany albo trwający', function (string $status) {
    $team = Team::factory()->create(['name' => 'Wilki Bemowo']);
    $player = Player::factory()->for($team)->create();
    $round = Round::factory()->for(Stage::factory()->for($team->tournament))->create();
    GameMatch::factory()->for($round)->started($status)->create(['home_team_id' => $team->id]);
    $scheduled = GameMatch::factory()->for($round)->create(['match_number' => 2, 'away_team_id' => $team->id]);

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: drużyna „Wilki Bemowo” ma rozegrane lub trwające mecze.']);

    expect($team->fresh()->deleted_at)->toBeNull()
        ->and($player->fresh()->deleted_at)->toBeNull()
        ->and($scheduled->fresh())->not->toBeNull();
})->with(['live', 'finished']);

// Baza nie wiąże zawodnika zdarzenia z drużyną meczu (`team_id` i `player_id`
// w `match_events` to osobne klucze), więc zawodnik może mieć rozegrany mecz,
// którego jego drużyna nie ma. Wtedy odmawia guard zawodnika w środku kaskady
// i transakcja musi cofnąć usunięcie samej drużyny razem z jej meczami.
it('cofa usunięcie drużyny i jej meczów, gdy guard zawodnika odrzuca kaskadę', function () {
    $team = Team::factory()->create();
    $player = Player::factory()->for($team)->create(['name' => 'Marek Nowak']);
    $round = Round::factory()->for(Stage::factory()->for($team->tournament))->create();
    $match = GameMatch::factory()->for($round)->finished()->create();
    MatchEvent::factory()->for($match, 'match')->create([
        'team_id' => $match->home_team_id,
        'player_id' => $player->id,
    ]);
    $scheduled = GameMatch::factory()->for($round)->create(['match_number' => 2, 'home_team_id' => $team->id]);

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: zawodnik „Marek Nowak” ma rozegrane lub trwające mecze.']);

    expect($team->fresh()->deleted_at)->toBeNull()
        ->and($player->fresh()->deleted_at)->toBeNull()
        ->and($scheduled->fresh())->not->toBeNull();
});

/**
 * Migawka terminarza: każdy mecz z kolumnami, których usunięcie drużyny nie
 * ma prawa ruszyć. Klucz to `id`, więc porównanie łapie też zniknięcie
 * albo pojawienie się meczu.
 *
 * Funkcja ląduje w globalnej przestrzeni nazw Pesta, stąd nazwa, której nie
 * użyje inny plik.
 *
 * @return array<int, array<string, mixed>>
 */
function teamDeletionScheduleSnapshot(): array
{
    return GameMatch::query()
        ->orderBy('id')
        ->get(['id', 'round_id', 'match_number', 'home_team_id', 'away_team_id', 'status', 'kickoff_at', 'venue_id'])
        ->keyBy('id')
        ->map(fn (GameMatch $match) => $match->only([
            'round_id', 'match_number', 'home_team_id', 'away_team_id', 'status', 'kickoff_at', 'venue_id',
        ]))
        ->all();
}

// Liga czterech drużyn. Usuwana drużyna gra w każdej kolejce, jako gospodarz
// i jako gość, więc po usunięciu kolejki 1 i 2 zostają z dziurą na pierwszym
// numerze, a kolejka 3, w której jest tylko jej mecz, pustoszeje. Reszta
// meczów ma zostać co do kolumny: bez przenumerowania, bez przesunięcia
// terminu i bez zmiany obiektu.
it('kasuje mecze scheduled drużyny po obu stronach, a resztę terminarza zostawia bez zmian', function () {
    $team = Team::factory()->create();
    $tournament = $team->tournament;
    [$sokoly, $orly, $lwy] = Team::factory()->count(3)->for($tournament)->create();
    $venue = Venue::factory()->for($tournament)->create();
    $stage = Stage::factory()->for($tournament)->create();
    [$first, $second, $third] = Round::factory()->count(3)->for($stage)
        ->sequence(['order' => 1], ['order' => 2], ['order' => 3])
        ->create();
    $match = fn (Round $round, int $number, Team $home, Team $away) => GameMatch::factory()
        ->for($round)
        ->create([
            'match_number' => $number,
            'home_team_id' => $home->id,
            'away_team_id' => $away->id,
            'venue_id' => $venue->id,
        ]);
    $teamMatches = [
        $match($first, 1, $team, $sokoly),
        $match($second, 1, $lwy, $team),
        $match($third, 1, $team, $orly),
    ];
    $match($first, 2, $orly, $lwy);
    $match($second, 2, $sokoly, $orly);
    $before = teamDeletionScheduleSnapshot();

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(204);

    foreach ($teamMatches as $deleted) {
        unset($before[$deleted->id]);
    }
    expect(teamDeletionScheduleSnapshot())->toEqual($before)
        ->and(GameMatch::where('home_team_id', $team->id)->orWhere('away_team_id', $team->id)->exists())->toBeFalse()
        ->and($stage->rounds()->count())->toBe(3);
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

/**
 * Puchar czterech drużyn z drabinką z generatora. Zwraca fazę; drużyny idą
 * po `id`, więc pierwsza jest seedem 1.
 */
function cupWithBracket(int $teams = 4): Stage
{
    $tournament = Tournament::factory()->create(['name' => 'Puchar Bemowa']);
    $ids = Team::factory()->count($teams)->for($tournament)->create()->pluck('id')->all();
    $stage = Stage::factory()->knockout()->for($tournament)->create();

    actingAsOrganizer($tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/bracket", ['teamIds' => $ids, 'thirdPlaceMatch' => false])
        ->assertStatus(201);

    return $stage;
}

// Niezmiennik 9 z #215: drabinki nie da się załatać jak kolejki, więc przed
// startem znika cała, a nie same mecze drużyny.
it('w pucharze przed startem kasuje całą drabinkę fazy razem z drużyną', function () {
    $stage = cupWithBracket();
    $team = $stage->tournament->teams()->orderBy('id')->firstOrFail();

    actingAsOrganizer($stage->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(204);

    expect($team->fresh()->trashed())->toBeTrue()
        ->and($stage->rounds()->exists())->toBeFalse()
        ->and($stage->matches()->exists())->toBeFalse();
});

// Drużyna z wolnym losem nie gra w pierwszej rundzie, a i tak stoi w drabince.
it('w pucharze po starcie odmawia także drużynie, która jeszcze nie grała, i niczego nie zmienia', function () {
    $stage = cupWithBracket(3);
    $bye = $stage->tournament->teams()->orderBy('id')->firstOrFail();
    $bye->update(['name' => 'Wilki Bemowo']);
    $stage->matches()->whereHas('round', fn ($query) => $query->where('order', 1))->firstOrFail()
        ->update(['status' => 'live', 'home_score' => 1, 'away_score' => 0]);
    $before = teamDeletionScheduleSnapshot();

    actingAsOrganizer($stage->tournament->user)
        ->deleteJson("/api/v1/teams/{$bye->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['id' => ['Nie można usunąć: drużyna „Wilki Bemowo” gra w drabince, która już się rozpoczęła. Wycofanie drużyny wpisz jako walkower.']]);

    expect($bye->fresh()->trashed())->toBeFalse()
        ->and(teamDeletionScheduleSnapshot())->toEqual($before);
});

// Drużyna dodana po wygenerowaniu nie stoi w drabince (#215, „Panel”), więc
// jej usunięcie drabinki nie dotyczy — także po starcie.
it('w pucharze usuwa drużynę spoza drabinki bez ruszania drabinki', function (bool $started) {
    $stage = cupWithBracket();
    if ($started) {
        $stage->matches()->whereHas('round', fn ($query) => $query->where('order', 1))->firstOrFail()
            ->update(['status' => 'finished', 'home_score' => 1, 'away_score' => 0]);
    }
    $late = Team::factory()->for($stage->tournament)->create();
    $before = teamDeletionScheduleSnapshot();

    actingAsOrganizer($stage->tournament->user)
        ->deleteJson("/api/v1/teams/{$late->id}")
        ->assertValidResponse(204);

    expect(teamDeletionScheduleSnapshot())->toEqual($before);
})->with(['przed startem' => false, 'po starcie' => true]);
