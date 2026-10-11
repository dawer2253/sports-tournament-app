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
| Tabela turnieju (#173)
|--------------------------------------------------------------------------
|
| Niezmienniki kolejności ustalił #160. Mecze powstają z fabryki, bo
| generator terminarza i wpisywanie wyniku to osobne tickety.
|
| 401 i 403 tej trasy pilnuje `SubtreeAuthorizationTest`. Funkcje niżej
| lądują w globalnej przestrzeni nazw Pesta, stąd prefiks `standings`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** Turniej z fazą ligową, jedną kolejką i drużynami o podanych nazwach. */
function standingsLeague(array $teamNames, string $sport = 'football', array $attributes = []): Tournament
{
    $factory = Tournament::factory();
    $tournament = ($sport === 'basketball' ? $factory->basketball() : $factory)->create($attributes);
    $stage = Stage::factory()->for($tournament)->create(['name' => 'Faza zasadnicza']);
    Round::factory()->for($stage)->create();

    foreach ($teamNames as $name) {
        Team::factory()->for($tournament)->create(['name' => $name]);
    }

    return $tournament;
}

function standingsTeam(Tournament $tournament, string $name): Team
{
    return $tournament->teams()->where('name', $name)->firstOrFail();
}

/** Mecz w pierwszej kolejce ligi; `scheduled` jest bez wyniku. */
function standingsMatch(Tournament $tournament, string $home, string $away, ?int $homeScore = null, ?int $awayScore = null, string $status = 'finished'): GameMatch
{
    $round = $tournament->stages()->firstOrFail()->rounds()->firstOrFail();

    return GameMatch::factory()->for($round)->create([
        'match_number' => (int) GameMatch::where('round_id', $round->id)->max('match_number') + 1,
        'home_team_id' => standingsTeam($tournament, $home)->id,
        'away_team_id' => standingsTeam($tournament, $away)->id,
        'home_score' => $homeScore,
        'away_score' => $awayScore,
        'status' => $status,
    ]);
}

function standingsOf(Tournament $tournament, string $query = ''): TestResponse
{
    return actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/standings{$query}");
}

/** Nazwy drużyn pierwszej tabeli w kolejności miejsc. */
function standingsOrder(TestResponse $response): array
{
    return $response->json('data.0.rows.*.team.name');
}

// --- skład tabeli ------------------------------------------------------------

it('przed pierwszym meczem oddaje wszystkie drużyny fazy z zerami, alfabetycznie', function () {
    $tournament = standingsLeague(['Wilki Bemowo', 'Orły Bielany', 'Sokoły Ursus']);
    $orly = standingsTeam($tournament, 'Orły Bielany');

    standingsOf($tournament)
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.stageId', $tournament->stages()->first()->id)
        ->assertJsonPath('data.0.stageName', 'Faza zasadnicza')
        ->assertJsonPath('data.0.groupId', null)
        ->assertJsonPath('data.0.groupName', null)
        ->assertJsonPath('data.0.scoreLabel', 'Bramki')
        ->assertJsonPath('data.0.rows.*.team.name', ['Orły Bielany', 'Sokoły Ursus', 'Wilki Bemowo'])
        ->assertJsonPath('data.0.rows.*.position', [1, 2, 3])
        ->assertJsonPath('data.0.rows.0', [
            'position' => 1,
            'team' => ['id' => $orly->id, 'name' => 'Orły Bielany', 'logoUrl' => null],
            'played' => 0,
            'won' => 0,
            'drawn' => 0,
            'lost' => 0,
            'scoreFor' => 0,
            'scoreAgainst' => 0,
            'scoreDifference' => 0,
            'points' => 0,
        ]);
});

it('nie daje wiersza drużynie usuniętej', function () {
    $tournament = standingsLeague(['Orły Bielany', 'Sokoły Ursus']);
    standingsTeam($tournament, 'Sokoły Ursus')->delete();

    standingsOf($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.rows.*.team.name', ['Orły Bielany']);
});

it('nie oddaje tabeli fazy pucharowej', function () {
    $tournament = Tournament::factory()->create();
    Stage::factory()->knockout()->for($tournament)->create();
    Team::factory()->for($tournament)->create();

    standingsOf($tournament)
        ->assertValidResponse(200)
        ->assertExactJson(['data' => []]);
});

it('liczy mecze, bilans i punkty według punktacji turnieju', function () {
    $tournament = standingsLeague(['Orły Bielany', 'Sokoły Ursus', 'Wilki Bemowo']);
    standingsMatch($tournament, 'Wilki Bemowo', 'Sokoły Ursus', 3, 1);
    standingsMatch($tournament, 'Orły Bielany', 'Wilki Bemowo', 2, 2);
    $tournament->update(['points' => ['win' => 4, 'draw' => 2, 'loss' => 1]]);

    $response = standingsOf($tournament)->assertValidResponse(200);

    expect(standingsOrder($response))->toBe(['Wilki Bemowo', 'Orły Bielany', 'Sokoły Ursus'])
        ->and($response->json('data.0.rows.*.points'))->toBe([6, 2, 1]);
    $response->assertJsonPath('data.0.rows.0', [
        'position' => 1,
        'team' => ['id' => standingsTeam($tournament, 'Wilki Bemowo')->id, 'name' => 'Wilki Bemowo', 'logoUrl' => null],
        'played' => 2,
        'won' => 1,
        'drawn' => 1,
        'lost' => 0,
        'scoreFor' => 5,
        'scoreAgainst' => 3,
        'scoreDifference' => 2,
        'points' => 6,
    ]);
});

it('w koszykówce nazywa zdobycze Punkty i liczy punktację sportu', function () {
    $tournament = standingsLeague(['Rysie Mokotów', 'Żubry Wola'], 'basketball');
    standingsMatch($tournament, 'Rysie Mokotów', 'Żubry Wola', 70, 81);

    standingsOf($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.scoreLabel', 'Punkty')
        ->assertJsonPath('data.0.rows.*.team.name', ['Żubry Wola', 'Rysie Mokotów'])
        ->assertJsonPath('data.0.rows.*.points', [2, 1]);
});

// --- niezmienniki z #160 -----------------------------------------------------

it('mecz live z dowolnym wynikiem nie zmienia tabeli', function (int $home, int $away) {
    $tournament = standingsLeague(['Orły Bielany', 'Sokoły Ursus', 'Wilki Bemowo']);
    standingsMatch($tournament, 'Wilki Bemowo', 'Orły Bielany', 1, 0);
    $before = standingsOf($tournament)->json();

    standingsMatch($tournament, 'Orły Bielany', 'Sokoły Ursus', $home, $away, 'live');

    expect(standingsOf($tournament)->assertValidResponse(200)->json())->toBe($before);
})->with([
    'wygrana gospodarza' => [5, 0],
    'remis' => [1, 1],
    'wygrana gościa' => [0, 3],
]);

/**
 * Wisła i Arka mają po 4 punkty. Mecze bezpośrednie (2:0 i 0:1) wygrała
 * bilansem Wisła, a Arka strzeliła więcej w całym sezonie — o tym, która jest
 * wyżej, decyduje więc kolejność kryteriów. Alfabet postawiłby Arkę.
 */
function standingsHeadToHeadLeague(array $tiebreakers): Tournament
{
    $tournament = standingsLeague(['Wisła', 'Arka', 'Cracovia'], attributes: ['tiebreakers' => $tiebreakers]);
    standingsMatch($tournament, 'Wisła', 'Arka', 2, 0);
    standingsMatch($tournament, 'Arka', 'Wisła', 1, 0);
    standingsMatch($tournament, 'Wisła', 'Cracovia', 0, 0);
    standingsMatch($tournament, 'Arka', 'Cracovia', 3, 3);

    return $tournament;
}

it('przy równych punktach bilans w meczach bezpośrednich stawia wyżej ich zwycięzcę', function () {
    $tournament = standingsHeadToHeadLeague(['points', 'head_to_head', 'score_for']);

    expect(standingsOrder(standingsOf($tournament)->assertValidResponse(200)))
        ->toBe(['Wisła', 'Arka', 'Cracovia']);
});

it('zmiana kolejności kryteriów turnieju zmienia tabelę przy następnym odczycie', function () {
    $tournament = standingsHeadToHeadLeague(['points', 'head_to_head', 'score_for']);
    expect(standingsOrder(standingsOf($tournament)))->toBe(['Wisła', 'Arka', 'Cracovia']);

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", ['tiebreakers' => ['points', 'score_for', 'head_to_head']])
        ->assertOk();

    expect(standingsOrder(standingsOf($tournament)->assertValidResponse(200)))
        ->toBe(['Arka', 'Wisła', 'Cracovia']);
});

// Wisła wygrała jedyny rozegrany mecz z Arką, ale rewanż nie jest zakończony,
// więc o kolejności mówi bilans (Arka rozbiła Cracovię).
it('pomija head_to_head, dopóki mecz między remisującymi nie jest zakończony', function (string $status) {
    $tournament = standingsLeague(['Wisła', 'Arka', 'Cracovia'], attributes: [
        'tiebreakers' => ['points', 'head_to_head', 'score_diff'],
    ]);
    standingsMatch($tournament, 'Wisła', 'Arka', 1, 0);
    standingsMatch($tournament, 'Arka', 'Cracovia', 5, 0);
    $score = $status === 'live' ? 0 : null;
    standingsMatch($tournament, 'Arka', 'Wisła', $score, $score, $status);

    expect(standingsOrder(standingsOf($tournament)->assertValidResponse(200)))
        ->toBe(['Arka', 'Wisła', 'Cracovia']);
})->with(['scheduled', 'live']);

// Arka, Bałtyk i Cracovia mają po 6 punktów. Mini-tabela ich trzech spycha Arkę
// na dół (bilans −2), a Bałtyk i Cracovię zostawia równo (3 pkt, +1, 3 bramki).
// Bałtyk wygrał z Cracovią, ale do meczów bezpośrednich nie wracamy: decyduje
// bilans całego sezonu, w którym Cracovia ma +6, a Bałtyk +2.
it('drużyny nierozdzielone przez mini-tabelę układa następne kryterium, bez powrotu do head_to_head', function () {
    $tournament = standingsLeague(['Arka', 'Bałtyk', 'Cracovia', 'Dąb'], attributes: [
        'tiebreakers' => ['points', 'head_to_head', 'score_diff'],
    ]);
    standingsMatch($tournament, 'Bałtyk', 'Cracovia', 2, 0);
    standingsMatch($tournament, 'Arka', 'Bałtyk', 2, 1);
    standingsMatch($tournament, 'Cracovia', 'Arka', 3, 0);
    standingsMatch($tournament, 'Arka', 'Dąb', 1, 0);
    standingsMatch($tournament, 'Bałtyk', 'Dąb', 1, 0);
    standingsMatch($tournament, 'Cracovia', 'Dąb', 5, 0);

    $response = standingsOf($tournament)->assertValidResponse(200);

    expect(standingsOrder($response))->toBe(['Cracovia', 'Bałtyk', 'Arka', 'Dąb'])
        ->and($response->json('data.0.rows.*.points'))->toBe([6, 6, 6, 0]);
});

// Trzy remisy: punkty i bilans w meczach bezpośrednich są równe, więc
// rozstrzygają bramki zdobyte w tych meczach (trzeci klucz mini-tabeli).
// Alfabet ułożyłby je odwrotnie.
it('przy równych punktach i bilansie w meczach bezpośrednich rozstrzygają zdobycze w tych meczach', function () {
    $tournament = standingsLeague(['Arka', 'Stal', 'Zawisza'], attributes: [
        'tiebreakers' => ['points', 'head_to_head'],
    ]);
    standingsMatch($tournament, 'Zawisza', 'Stal', 2, 2);
    standingsMatch($tournament, 'Stal', 'Arka', 0, 0);
    standingsMatch($tournament, 'Arka', 'Zawisza', 1, 1);

    expect(standingsOrder(standingsOf($tournament)->assertValidResponse(200)))
        ->toBe(['Zawisza', 'Stal', 'Arka']);
});

// Trzy remisy, po 2 punkty. Bramki zdobyte ułożyłyby Legię, Mazura i Łódź,
// ale lista to samo `points`, więc po nim zostaje już tylko nazwa.
it('pełny remis po wszystkich kryteriach układa alfabetycznie po polsku, z unikalnymi miejscami', function () {
    $tournament = standingsLeague(['Mazur', 'Łódź', 'Legia'], attributes: ['tiebreakers' => ['points']]);
    standingsMatch($tournament, 'Mazur', 'Legia', 3, 3);
    standingsMatch($tournament, 'Łódź', 'Mazur', 0, 0);
    standingsMatch($tournament, 'Legia', 'Łódź', 1, 1);

    $response = standingsOf($tournament)->assertValidResponse(200);

    expect(standingsOrder($response))->toBe(['Legia', 'Łódź', 'Mazur'])
        ->and($response->json('data.0.rows.*.position'))->toBe([1, 2, 3]);
});

// „Ł” stoi w polskim alfabecie za całym „L”, więc „lwy” wyprzedza „łada”.
// Porządek bajtowy postawiłby małe litery za „Mazurem”, a sortowanie bez
// polskich reguł — „łada” przed „Legią”. Ten test sprawdza `Collator('pl_PL')`
// także w CI.
it('porządkuje nazwy po polsku, bez rozróżniania wielkości liter', function () {
    $tournament = standingsLeague(['Mazur', 'łada', 'Łódź', 'Legia', 'lwy']);

    expect(standingsOrder(standingsOf($tournament)->assertValidResponse(200)))
        ->toBe(['Legia', 'lwy', 'łada', 'Łódź', 'Mazur']);
});

it('przy tej samej nazwie rozstrzyga id drużyny', function () {
    $tournament = standingsLeague(['Orły', 'Orły']);
    $ids = $tournament->teams()->orderBy('id')->pluck('id')->all();

    standingsOf($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.rows.*.team.id', $ids)
        ->assertJsonPath('data.0.rows.*.position', [1, 2]);
});

// --- podgląd (?tiebreakers=) -------------------------------------------------

it('liczy podgląd według podanej listy i niczego nie zapisuje', function () {
    $tournament = standingsHeadToHeadLeague(['points', 'head_to_head', 'score_for']);

    $response = standingsOf($tournament, '?tiebreakers=points,score_for,head_to_head')
        ->assertValidRequest()
        ->assertValidResponse(200);

    expect(standingsOrder($response))->toBe(['Arka', 'Wisła', 'Cracovia'])
        ->and($tournament->fresh()->tiebreakers)->toBe(['points', 'head_to_head', 'score_for']);
});

it('podgląd z listą równą zapisanej oddaje to samo co odczyt bez parametru', function () {
    $tournament = standingsHeadToHeadLeague(['points', 'head_to_head', 'score_for']);

    expect(standingsOf($tournament, '?tiebreakers=points,head_to_head,score_for')->assertOk()->json())
        ->toBe(standingsOf($tournament)->assertOk()->json());
});

// Te same listy idą do `PATCH` i do podglądu: błędy mają się zgadzać co do
// klucza i treści, a turniej zostaje nietknięty.
it('odrzuca podgląd z tymi samymi błędami co PATCH', function (array $list, string $key) {
    $tournament = standingsHeadToHeadLeague(['points', 'head_to_head', 'score_for']);

    $patch = actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", ['tiebreakers' => $list])
        ->assertUnprocessable();

    standingsOf($tournament, '?tiebreakers='.rawurlencode(implode(',', $list)))
        ->assertValidResponse(422)
        ->assertJsonValidationErrors($key)
        ->assertJsonPath('errors', $patch->json('errors'));

    expect($tournament->fresh()->tiebreakers)->toBe(['points', 'head_to_head', 'score_for']);
})->with([
    'nieznany kod' => [['points', 'goals'], 'tiebreakers.1'],
    'niedostępne w sporcie' => [['points', 'score_diff', 'score_against'], 'tiebreakers.2'],
    'duplikat' => [['points', 'score_diff', 'wins', 'score_diff'], 'tiebreakers.3'],
    'bez points na początku' => [['score_diff', 'points'], 'tiebreakers.0'],
    'pusta lista' => [[], 'tiebreakers'],
    // `?tiebreakers=points,` i `points,,score_diff`: pusty element nie może
    // przejść walidacji i wywrócić kalkulatora.
    'pusty element na końcu' => [['points', ''], 'tiebreakers.1'],
    'pusty element w środku' => [['points', '', 'score_diff'], 'tiebreakers.1'],
    'element ze spacji' => [['points', ' ', 'score_diff'], 'tiebreakers.1'],
]);

// Bez Spectatora: kształtu spoza kontraktu (nawiasy) jego middleware nie umie
// rozebrać i kończy żądanie 500, zanim dotrze ono do walidacji. Poza testami
// tego middleware'u nie ma.
it('odrzuca powtórzony klucz i notację nawiasową pod tiebreakers', function (string $query) {
    Spectator::reset();
    $tournament = standingsHeadToHeadLeague(['points', 'head_to_head', 'score_for']);

    standingsOf($tournament, $query)
        ->assertUnprocessable()
        ->assertJsonPath('errors.tiebreakers', [
            'Parametr tiebreakers podaj raz, z wartościami po przecinku, np. tiebreakers=points,score_diff,head_to_head.',
        ]);
})->with([
    'powtórzony klucz' => ['?tiebreakers=points&tiebreakers=score_for'],
    'nawiasy' => ['?tiebreakers[]=points&tiebreakers[]=score_for'],
]);
