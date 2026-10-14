<?php

use App\Matches\Advancement;
use App\Models\GameMatch;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Schedule\BracketGenerator;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Mecze fazy na stronie publicznej (#234)
|--------------------------------------------------------------------------
|
| `GET /public/t/{slug}/matches?stageId=` oddaje komplet meczów jednej fazy
| w każdym stanie, z krawędziami drabinki, bo z niego widok buduje odwrotny
| indeks krawędzi (ADR-0004). Funkcje lądują w globalnej przestrzeni nazw
| Pesta, stąd prefiks `stageMatches`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/**
 * Opublikowany puchar czterech drużyn z meczem o 3. miejsce i półfinałem 1
 * rozstrzygniętym karnymi, więc zwycięzca stoi już w finale, przegrany
 * w meczu o 3. miejsce, a ich drugie sloty czekają.
 *
 * @return array{tournament: Tournament, stage: Stage, sf1: GameMatch, sf2: GameMatch, final: GameMatch, third: GameMatch}
 */
function stageMatchesCup(string $status = 'active'): array
{
    $tournament = Tournament::factory()->create(['status' => $status]);
    $teams = array_map(
        fn (string $name): int => Team::factory()->for($tournament)->create(['name' => $name])->id,
        ['Wilki', 'Orły', 'Sokoły', 'Rysie'],
    );
    $stage = Stage::factory()->knockout()->for($tournament)->create();
    app(BracketGenerator::class)->generate($stage, $teams, true);

    $byPosition = fn (int $order, int $number): GameMatch => $stage->matches()
        ->whereHas('round', fn ($query) => $query->where('order', $order))
        ->where('match_number', $number)
        ->firstOrFail();

    // Awans bez HTTP: test zakłada czasem dwa puchary, a drugi token w tym
    // samym teście trafiłby na strażnika zapamiętanego przy pierwszym.
    $sf1 = app(Advancement::class)->save($byPosition(1, 1), [
        'status' => 'finished',
        'home_score' => 1,
        'away_score' => 1,
        'home_penalties' => 3,
        'away_penalties' => 4,
    ], 'homeScore');

    return [
        'tournament' => $tournament,
        'stage' => $stage,
        'sf1' => $sf1,
        'sf2' => $byPosition(1, 2),
        'final' => $byPosition(2, 1),
        'third' => $byPosition(2, 2),
    ];
}

function stageMatchesGet(Tournament $tournament, string $query, array $headers = []): TestResponse
{
    return test()->getJson("/api/v1/public/t/{$tournament->slug}/matches{$query}", $headers);
}

it('oddaje mecze tylko tej fazy, z krawędziami, karnymi i meczem bez obu drużyn', function () {
    $cup = stageMatchesCup();
    $otherStage = Stage::factory()->for($cup['tournament'])->create(['order' => 2]);
    GameMatch::factory()->for($otherStage->rounds()->create(['name' => 'Kolejka 1', 'order' => 1]))->create();

    $response = stageMatchesGet($cup['tournament'], "?stageId={$cup['stage']->id}")
        ->assertValidRequest()
        ->assertValidResponse(200);

    $byId = collect($response->json('data'))->keyBy('id');

    expect($byId->keys()->sort()->values()->all())
        ->toBe(collect([$cup['sf1'], $cup['sf2'], $cup['final'], $cup['third']])->pluck('id')->sort()->values()->all())
        ->and($byId[$cup['sf1']->id])->toMatchArray([
            'status' => 'finished',
            'homeScore' => 1,
            'awayScore' => 1,
            'homePenalties' => 3,
            'awayPenalties' => 4,
            'winnerToMatchId' => $cup['final']->id,
            'loserToMatchId' => $cup['third']->id,
            'advancesToSlot' => 'home',
        ])
        ->and($byId[$cup['final']->id]['homeTeam']['name'])->toBe('Rysie')
        ->and($byId[$cup['final']->id]['awayTeam'])->toBeNull()
        ->and($byId[$cup['third']->id]['homeTeam']['name'])->toBe('Wilki')
        ->and($byId[$cup['third']->id]['round']['name'])->toBe('Finał')
        ->and($byId[$cup['third']->id])->not->toHaveKey('scorers');
});

it('idzie rosnąco po terminie, a mecz bez terminu stoi na końcu', function () {
    $cup = stageMatchesCup();
    $cup['sf1']->update(['kickoff_at' => '2026-10-11 10:00:00']);
    $cup['sf2']->update(['kickoff_at' => '2026-10-11 12:00:00']);
    $cup['third']->update(['kickoff_at' => '2026-10-18 10:00:00']);

    stageMatchesGet($cup['tournament'], "?stageId={$cup['stage']->id}")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$cup['sf1']->id, $cup['sf2']->id, $cup['third']->id, $cup['final']->id]);
});

it('faza innego turnieju daje puste data, a nie cudze mecze', function () {
    $cup = stageMatchesCup();
    $other = stageMatchesCup();

    stageMatchesGet($cup['tournament'], "?stageId={$other['stage']->id}")
        ->assertValidResponse(200)
        ->assertJsonPath('data', []);
});

it('brak stageId albo zły typ daje 422 pod stageId', function (string $query, string $message) {
    $cup = stageMatchesCup();

    stageMatchesGet($cup['tournament'], $query)
        ->assertValidResponse(422)
        ->assertOnlyJsonValidationErrors(['stageId'])
        ->assertJsonPath('errors.stageId.0', $message);
})->with([
    'brak' => ['', 'Podaj id fazy.'],
    'pusty' => ['?stageId=', 'Podaj id fazy.'],
    'nie liczba' => ['?stageId=abc', 'Id fazy musi być liczbą całkowitą.'],
]);

it('szkic i nieznany slug dają 404 przed 422', function () {
    $draft = stageMatchesCup('draft');

    stageMatchesGet($draft['tournament'], "?stageId={$draft['stage']->id}")->assertNotFound()->assertValidResponse(404);
    test()->getJson('/api/v1/public/t/nie-ma-takiego-turnieju/matches')->assertNotFound()->assertValidResponse(404);
});

it('niesie walidator HTTP, a zgodny If-None-Match daje 304', function () {
    $cup = stageMatchesCup();
    $query = "?stageId={$cup['stage']->id}";

    $etag = stageMatchesGet($cup['tournament'], $query)->assertOk()->headers->get('ETag');

    expect($etag)->toMatch('/^"[^"]+"$/');

    $repeated = stageMatchesGet($cup['tournament'], $query, ['If-None-Match' => $etag])->assertStatus(304);

    expect($repeated->getContent())->toBe('');
});

it('terminarz pucharu z meczem bez obu drużyn daje 200 z homeTeam null', function () {
    $tournament = Tournament::factory()->create(['status' => 'active']);
    $teams = array_map(fn (string $name): int => Team::factory()->for($tournament)->create(['name' => $name])->id, ['Wilki', 'Orły', 'Sokoły', 'Rysie']);
    $stage = Stage::factory()->knockout()->for($tournament)->create();
    app(BracketGenerator::class)->generate($stage, $teams, false);

    $final = collect(test()->getJson("/api/v1/public/t/{$tournament->slug}/fixtures")->assertValidResponse(200)->json('data'))
        ->firstWhere('round.name', 'Finał');

    expect($final['homeTeam'])->toBeNull()
        ->and($final['awayTeam'])->toBeNull()
        ->and($final['scorers'])->toBe([]);
});
