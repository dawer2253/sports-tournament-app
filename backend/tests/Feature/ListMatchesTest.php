<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use App\Models\Venue;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;
use Symfony\Component\Yaml\Yaml;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401 i 403 tej trasy pilnuje `SubtreeAuthorizationTest`. Tu zostaje
// szczęśliwa ścieżka, kolejność, filtry, stronicowanie i izolacja listy.

/** Kolejka fazy o danym `order`, z nazwą jak spod generatora. */
function roundOf(Stage $stage, int $order): Round
{
    return Round::factory()->for($stage)->create(['name' => "Kolejka {$order}", 'order' => $order]);
}

function listMatches(Tournament $tournament, array $query = []): TestResponse
{
    $suffix = $query === [] ? '' : '?'.http_build_query($query);

    return actingAsOrganizer($tournament->user)->getJson("/api/v1/tournaments/{$tournament->id}/matches{$suffix}");
}

it('oddaje mecz w kształcie z kontraktu', function () {
    $tournament = Tournament::factory()->create();
    $stage = Stage::factory()->for($tournament)->create();
    $home = Team::factory()->for($tournament)->create(['name' => 'Wilki Bemowo']);
    $away = Team::factory()->for($tournament)->create(['name' => 'Sokoły Ursus']);
    $venue = Venue::factory()->for($tournament)->create(['name' => 'Boisko Bemowo']);
    $match = GameMatch::factory()->for(roundOf($stage, 1))->finished(2, 1)->create([
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        'venue_id' => $venue->id,
        'kickoff_at' => '2026-09-06 10:00:00',
    ]);

    listMatches($tournament)
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertExactJson([
            'data' => [[
                'id' => $match->id,
                'stageId' => $stage->id,
                'groupId' => null,
                'round' => ['id' => $match->round_id, 'name' => 'Kolejka 1', 'order' => 1],
                'matchNumber' => 1,
                'homeTeam' => ['id' => $home->id, 'name' => 'Wilki Bemowo', 'logoUrl' => null],
                'awayTeam' => ['id' => $away->id, 'name' => 'Sokoły Ursus', 'logoUrl' => null],
                'homeScore' => 2,
                'awayScore' => 1,
                'homePenalties' => null,
                'awayPenalties' => null,
                'status' => 'finished',
                'kickoffAt' => '2026-09-06T10:00:00+00:00',
                'venue' => ['id' => $venue->id, 'name' => 'Boisko Bemowo'],
                'winnerToMatchId' => null,
                'loserToMatchId' => null,
                'advancesToSlot' => null,
            ]],
            'meta' => ['currentPage' => 1, 'lastPage' => 1, 'perPage' => 50, 'total' => 1],
        ]);
});

it('oddaje mecz bez terminu i bez obiektu z nullami', function () {
    $tournament = Tournament::factory()->create();
    GameMatch::factory()->for(roundOf(Stage::factory()->for($tournament)->create(), 1))
        ->create(['kickoff_at' => null, 'venue_id' => null]);

    listMatches($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.kickoffAt', null)
        ->assertJsonPath('data.0.venue', null)
        ->assertJsonPath('data.0.homeScore', null);
});

// Kolejki i mecze powstają w kolejności innej niż docelowa, a numery mają
// dziurę po usuniętej drużynie (#161), więc wynik nie może wyjść z `id`.
it('układa mecze po fazie, kolejce i matchNumber, także przy dziurach w numeracji', function () {
    $tournament = Tournament::factory()->create();
    $second = Stage::factory()->knockout()->for($tournament)->create(['order' => 2]);
    $first = Stage::factory()->for($tournament)->create(['order' => 1]);
    $roundTwo = roundOf($first, 2);
    $roundOne = roundOf($first, 1);
    $cup = roundOf($second, 1);

    $make = fn (Round $round, int $number): int => GameMatch::factory()->for($round)->create(['match_number' => $number])->id;
    $cupMatch = $make($cup, 1);
    $r2m4 = $make($roundTwo, 4);
    $r1m3 = $make($roundOne, 3);
    $r2m1 = $make($roundTwo, 1);
    $r1m1 = $make($roundOne, 1);

    listMatches($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$r1m1, $r1m3, $r2m1, $r2m4, $cupMatch])
        ->assertJsonPath('data.*.matchNumber', [1, 3, 1, 4, 1]);
});

it('zawęża listę do fazy z stageId', function () {
    $tournament = Tournament::factory()->create();
    $league = Stage::factory()->for($tournament)->create(['order' => 1]);
    $cup = Stage::factory()->knockout()->for($tournament)->create(['order' => 2]);
    $own = GameMatch::factory()->for(roundOf($league, 1))->create();
    GameMatch::factory()->for(roundOf($cup, 1))->create();

    listMatches($tournament, ['stageId' => $league->id])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$own->id])
        ->assertJsonPath('meta.total', 1);
});

// Faza cudzego turnieju w `stageId` nie może otworzyć jego meczów: lista
// idzie przez relację turnieju z trasy, a ten turniej takiej fazy nie ma.
it('oddaje pustą listę dla fazy innego turnieju w stageId', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    GameMatch::factory()->for(roundOf(Stage::factory()->for($tournament)->create(), 1))->create();
    $foreignStage = Stage::factory()->create();
    GameMatch::factory()->for(roundOf($foreignStage, 1))->create();

    listMatches($tournament, ['stageId' => $foreignStage->id])
        ->assertValidResponse(200)
        ->assertJsonPath('data', [])
        ->assertJsonPath('meta.total', 0);
});

// Oba turnieje należą do tego samego organizera, więc policy przepuści
// żądanie. Obce mecze odsiewa wyłącznie relacja turnieju z trasy.
it('nie oddaje meczów innego turnieju tego samego organizera', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $own = GameMatch::factory()->for(roundOf(Stage::factory()->for($tournament)->create(), 1))->create();
    $other = Tournament::factory()->for($organizer)->create();
    GameMatch::factory()->for(roundOf(Stage::factory()->for($other)->create(), 1))->create();

    listMatches($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$own->id]);
});

it('zawęża listę do kolejki z roundId i do stanu ze status', function () {
    $tournament = Tournament::factory()->create();
    $stage = Stage::factory()->for($tournament)->create();
    $roundOne = roundOf($stage, 1);
    $roundTwo = roundOf($stage, 2);
    $finished = GameMatch::factory()->for($roundOne)->finished()->create();
    $scheduled = GameMatch::factory()->for($roundOne)->create(['match_number' => 2]);
    $later = GameMatch::factory()->for($roundTwo)->create();

    listMatches($tournament, ['roundId' => $roundOne->id])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$finished->id, $scheduled->id]);

    listMatches($tournament, ['status' => 'scheduled'])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$scheduled->id, $later->id]);
});

// Filtr działa przed `paginate()`, więc `meta` opisuje zbiór zawężony.
it('stronicuje po filtrze', function () {
    $tournament = Tournament::factory()->create();
    $stage = Stage::factory()->for($tournament)->create();
    $round = roundOf($stage, 1);
    $ids = collect(range(1, 5))->map(fn (int $number): int => GameMatch::factory()->for($round)->create(['match_number' => $number])->id);
    GameMatch::factory()->for(roundOf(Stage::factory()->knockout()->for($tournament)->create(['order' => 2]), 1))->create();

    listMatches($tournament, ['stageId' => $stage->id, 'perPage' => 2, 'page' => 3])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$ids[4]])
        ->assertJsonPath('meta', ['currentPage' => 3, 'lastPage' => 3, 'perPage' => 2, 'total' => 5]);
});

// Kontrakt nie przewiduje `422` dla `perPage`: za duże jest dociągane do
// granicy, nieczytelne daje rozmiar domyślny — jak na liście turniejów.
it('dociąga perPage do granic zamiast odrzucać', function (mixed $perPage, int $expected) {
    $tournament = Tournament::factory()->create();

    listMatches($tournament, ['perPage' => $perPage])
        ->assertValidResponse(200)
        ->assertJsonPath('meta.perPage', $expected);
})->with([
    'ponad limit' => [500, 200],
    'zero' => [0, 50],
    'tekst' => ['dużo', 50],
]);

it('odrzuca z 422 filtr o złym typie albo nieznany stan', function (array $query, string $field) {
    $tournament = Tournament::factory()->create();

    listMatches($tournament, $query)
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor($field);
})->with([
    'nieznany stan' => [['status' => 'bogus'], 'status'],
    'stan jako lista' => [['status' => 'scheduled,live'], 'status'],
    'stageId tekstem' => [['stageId' => 'abc'], 'stageId'],
    'roundId ułamkiem' => [['roundId' => '1.5'], 'roundId'],
]);

it('mówi przy nieznanym stanie dokładnie to, co pokazuje przykład w kontrakcie', function () {
    listMatches(Tournament::factory()->create(), ['status' => 'bogus'])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.status', ['Nieznany stan meczu: bogus. Dozwolone: scheduled, live, finished.']);
});

it('trzyma stany meczu zgodne z enumem MatchStatus w kontrakcie', function () {
    $contract = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');

    expect($contract['components']['schemas']['MatchStatus']['enum'])->toBe(GameMatch::STATUSES);
});

// Zapytanie jest MySQL-only, jak bliźniacze w `ListTournamentsTest` (ADR 0005).
it('trzyma stany meczu zgodne z enumem kolumny w bazie', function () {
    $column = DB::selectOne(
        'SELECT COLUMN_TYPE AS column_type
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?',
        ['matches', 'status'],
    );

    preg_match_all("/'([^']+)'/", $column->column_type, $matches);

    expect($matches[1])->toBe(GameMatch::STATUSES);
});
