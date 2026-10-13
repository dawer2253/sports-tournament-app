<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Strona publiczna turnieju (#206)
|--------------------------------------------------------------------------
|
| Trasy `/public/t/{slug}*` bez autoryzacji. Spectator asertuje samo ciało,
| więc walidator HTTP (ADR-0007) ma tu własne asercje — tak każe
| `backend/AGENTS.md`. Funkcje niżej lądują w globalnej przestrzeni nazw
| Pesta, stąd prefiks `publicPage`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** Ścieżki pod slugiem, które stoją w tym tickecie. */
const PUBLIC_PAGE_ROUTES = ['', '/standings', '/fixtures', '/results'];

/** Opublikowany turniej z fazą ligową, dwiema kolejkami i dwiema drużynami. */
function publicPageTournament(string $status = 'active', string $sport = 'football', array $attributes = []): Tournament
{
    $factory = Tournament::factory();
    $tournament = ($sport === 'basketball' ? $factory->basketball() : $factory)
        ->create(['status' => $status, ...$attributes]);
    $stage = Stage::factory()->for($tournament)->create(['name' => 'Faza zasadnicza']);
    Round::factory()->for($stage)->create(['name' => 'Kolejka 1', 'order' => 1]);
    Round::factory()->for($stage)->create(['name' => 'Kolejka 2', 'order' => 2]);
    Team::factory()->for($tournament)->create(['name' => 'Orły Bielany']);
    Team::factory()->for($tournament)->create(['name' => 'Sokoły Ursus']);

    return $tournament;
}

/** Mecz Orły – Sokoły w kolejce o podanym `order`. */
function publicPageMatch(Tournament $tournament, int $round, array $attributes = []): GameMatch
{
    $roundModel = $tournament->stages()->firstOrFail()->rounds()->where('order', $round)->firstOrFail();

    return GameMatch::factory()->for($roundModel)->create([
        'match_number' => (int) GameMatch::where('round_id', $roundModel->id)->max('match_number') + 1,
        'home_team_id' => $tournament->teams()->where('name', 'Orły Bielany')->value('id'),
        'away_team_id' => $tournament->teams()->where('name', 'Sokoły Ursus')->value('id'),
        ...$attributes,
    ]);
}

function publicPageGet(string $slug, string $path = '', array $headers = []): TestResponse
{
    return test()->getJson("/api/v1/public/t/{$slug}{$path}", $headers);
}

// --- turniej -----------------------------------------------------------------

it('oddaje turniej opublikowany w kształcie PublicTournament', function (string $status) {
    $tournament = publicPageTournament($status, attributes: ['name' => 'Liga Osiedlowa 2026', 'primary_color' => '#1F7A45']);

    publicPageGet($tournament->slug)
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', 'Liga Osiedlowa 2026')
        ->assertJsonPath('data.slug', $tournament->slug)
        ->assertJsonPath('data.status', $status)
        ->assertJsonPath('data.sport', ['id' => sport('football')->id, 'code' => 'football', 'name' => 'Piłka nożna'])
        ->assertJsonPath('data.branding', ['logoUrl' => null, 'primaryColor' => '#1F7A45'])
        ->assertJsonPath('data.stages.*.name', ['Faza zasadnicza']);
})->with(['active', 'finished']);

it('szkic daje na każdej trasie ten sam 404 co nieznany slug', function (string $path) {
    $draft = publicPageTournament('draft');

    $unknown = publicPageGet('nie-ma-takiego-turnieju', $path)->assertNotFound()->assertValidResponse(404);
    $hidden = publicPageGet($draft->slug, $path)->assertNotFound()->assertValidResponse(404);

    expect($hidden->json())->toBe($unknown->json())
        ->and($hidden->json('message'))->toBe(contractErrorMessage('NotFound'));
})->with(PUBLIC_PAGE_ROUTES);

// --- walidator HTTP (ADR-0007) ------------------------------------------------

it('200 niesie ETag i Cache-Control z no-cache, a zgodny If-None-Match daje 304 z pustym ciałem', function (string $path) {
    $tournament = publicPageTournament();
    publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 2, 'away_score' => 1]);
    publicPageMatch($tournament, 2);

    $first = publicPageGet($tournament->slug, $path)->assertOk()->assertValidResponse(200);
    $etag = $first->headers->get('ETag');

    expect($etag)->toMatch('/^"[^"]+"$/')
        ->and($first->headers->get('Cache-Control'))->toMatch('/(^|,)\s*no-cache\s*(,|$)/');

    $repeated = publicPageGet($tournament->slug, $path, ['If-None-Match' => $etag])->assertStatus(304);

    expect($repeated->getContent())->toBe('')
        ->and($repeated->headers->get('ETag'))->toBe($etag);
})->with(PUBLIC_PAGE_ROUTES);

it('niezgodny If-None-Match daje pełną odpowiedź', function () {
    $tournament = publicPageTournament();

    publicPageGet($tournament->slug, '', ['If-None-Match' => '"nieaktualny"'])
        ->assertOk()
        ->assertJsonPath('data.slug', $tournament->slug);
});

it('404 nie niesie walidatora', function () {
    expect(publicPageGet('nie-ma-takiego-turnieju')->assertNotFound()->headers->has('ETag'))->toBeFalse();
});

it('bez zmiany w danych ETag zostaje, a zapis wyniku zmienia ETag tabeli i wyników', function () {
    $tournament = publicPageTournament();
    $match = publicPageMatch($tournament, 1);
    $etag = fn (string $path): ?string => publicPageGet($tournament->slug, $path)->assertOk()->headers->get('ETag');

    $standings = $etag('/standings');
    $results = $etag('/results');
    expect($etag('/standings'))->toBe($standings)
        ->and($etag('/results'))->toBe($results);

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['status' => 'finished', 'homeScore' => 2, 'awayScore' => 0])
        ->assertOk();

    expect($etag('/standings'))->not->toBe($standings)
        ->and($etag('/results'))->not->toBe($results);
});

// --- tabela ------------------------------------------------------------------

it('tabela niesie allowsDraw sportu i kryteria w kolejności turnieju z etykietami sportu', function () {
    $tournament = publicPageTournament(sport: 'basketball', attributes: ['tiebreakers' => ['points', 'score_diff', 'head_to_head']]);

    publicPageGet($tournament->slug, '/standings')
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.scoreLabel', 'Punkty')
        ->assertJsonPath('data.0.allowsDraw', false)
        ->assertJsonPath('data.0.tiebreakers', [
            ['code' => 'points', 'label' => 'Punkty w tabeli'],
            ['code' => 'score_diff', 'label' => 'Różnica punktów'],
            ['code' => 'head_to_head', 'label' => 'Bezpośredni mecz'],
        ])
        ->assertJsonPath('data.0.rows.*.team.name', ['Orły Bielany', 'Sokoły Ursus']);
});

// --- terminarz i wyniki ------------------------------------------------------

it('terminarz ma mecze zaplanowane i trwające, a wyniki wyłącznie zakończone, bez meczów innego turnieju', function () {
    $tournament = publicPageTournament();
    $scheduled = publicPageMatch($tournament, 2, ['kickoff_at' => '2026-10-18 10:00:00']);
    $live = publicPageMatch($tournament, 1, ['kickoff_at' => '2026-10-11 10:00:00', 'status' => 'live', 'home_score' => 1, 'away_score' => 0]);
    $finished = publicPageMatch($tournament, 1, ['kickoff_at' => '2026-10-04 10:00:00', 'status' => 'finished', 'home_score' => 2, 'away_score' => 2]);

    $other = publicPageTournament();
    publicPageMatch($other, 1, ['kickoff_at' => '2026-10-05 10:00:00']);
    publicPageMatch($other, 1, ['kickoff_at' => '2026-10-05 12:00:00', 'status' => 'finished', 'home_score' => 1, 'away_score' => 0]);

    publicPageGet($tournament->slug, '/fixtures')
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$live->id, $scheduled->id])
        ->assertJsonPath('data.*.status', ['live', 'scheduled']);

    publicPageGet($tournament->slug, '/results')
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$finished->id])
        ->assertJsonPath('data.0.homeScore', 2);
});

it('terminarz idzie rosnąco po terminie, a mecz bez terminu stoi na końcu', function () {
    $tournament = publicPageTournament();
    $undatedLater = publicPageMatch($tournament, 2, ['kickoff_at' => null]);
    $undatedEarlier = publicPageMatch($tournament, 1, ['kickoff_at' => null]);
    $late = publicPageMatch($tournament, 1, ['kickoff_at' => '2026-10-18 10:00:00']);
    $early = publicPageMatch($tournament, 2, ['kickoff_at' => '2026-10-11 10:00:00']);

    publicPageGet($tournament->slug, '/fixtures')
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$early->id, $late->id, $undatedEarlier->id, $undatedLater->id])
        ->assertJsonPath('data.3.kickoffAt', null);
});

it('wyniki idą malejąco po terminie, a mecz bez terminu stoi na końcu', function () {
    $tournament = publicPageTournament();
    $finished = ['status' => 'finished', 'home_score' => 1, 'away_score' => 0];
    $undatedEarlier = publicPageMatch($tournament, 1, ['kickoff_at' => null, ...$finished]);
    $undatedLater = publicPageMatch($tournament, 2, ['kickoff_at' => null, ...$finished]);
    $early = publicPageMatch($tournament, 2, ['kickoff_at' => '2026-10-04 10:00:00', ...$finished]);
    $late = publicPageMatch($tournament, 1, ['kickoff_at' => '2026-10-11 10:00:00', ...$finished]);

    publicPageGet($tournament->slug, '/results')
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$late->id, $early->id, $undatedLater->id, $undatedEarlier->id]);
});
