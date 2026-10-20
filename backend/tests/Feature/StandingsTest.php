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
    $tournament = (match ($sport) {
        'basketball' => $factory->basketball(),
        'volleyball' => $factory->volleyball(),
        default => $factory,
    })->create($attributes);
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
            'rallyPointsFor' => null,
            'rallyPointsAgainst' => null,
            'points' => 0,
            'form' => [],
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
        'rallyPointsFor' => null,
        'rallyPointsAgainst' => null,
        'points' => 6,
        'form' => ['win', 'draw'],
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

it('w podglądzie tiebreakers to lista podglądu, a bez parametru — zapisana, z etykietami sportu', function () {
    $tournament = standingsHeadToHeadLeague(['points', 'head_to_head', 'score_for']);

    standingsOf($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.allowsDraw', true)
        ->assertJsonPath('data.0.tiebreakers', [
            ['code' => 'points', 'label' => 'Punkty w tabeli'],
            ['code' => 'head_to_head', 'label' => 'Bezpośredni mecz'],
            ['code' => 'score_for', 'label' => 'Bramki zdobyte'],
        ]);

    standingsOf($tournament, '?tiebreakers=points,score_for,head_to_head')
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.tiebreakers', [
            ['code' => 'points', 'label' => 'Punkty w tabeli'],
            ['code' => 'score_for', 'label' => 'Bramki zdobyte'],
            ['code' => 'head_to_head', 'label' => 'Bezpośredni mecz'],
        ]);
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

// --- forma (#291) ------------------------------------------------------------

/**
 * Mecz w kolejce o podanym `order`; kolejka powstaje, gdy jej jeszcze nie ma.
 * `scheduled` jest bez wyniku.
 */
function standingsRoundMatch(Tournament $tournament, int $order, string $home, string $away, ?int $homeScore = null, ?int $awayScore = null, string $status = 'finished'): GameMatch
{
    $stage = $tournament->stages()->firstOrFail();
    $round = $stage->rounds()->where('order', $order)->first()
        ?? Round::factory()->for($stage)->create(['name' => "Kolejka {$order}", 'order' => $order]);

    return GameMatch::factory()->for($round)->create([
        'match_number' => (int) GameMatch::where('round_id', $round->id)->max('match_number') + 1,
        'home_team_id' => standingsTeam($tournament, $home)->id,
        'away_team_id' => standingsTeam($tournament, $away)->id,
        'home_score' => $homeScore,
        'away_score' => $awayScore,
        'status' => $status,
    ]);
}

/** Forma drużyny z pierwszej tabeli odpowiedzi. */
function standingsFormOf(TestResponse $response, string $team): array
{
    return collect($response->json('data.0.rows'))->firstWhere('team.name', $team)['form'];
}

/**
 * Niezmiennik formy w każdym wierszu każdej tabeli: długość `min(played, 5)`,
 * a przy `played ≤ 5` tyle samo `win`/`draw`/`loss` co `won`/`drawn`/`lost`.
 */
function standingsExpectFormMatchesRecord(TestResponse $response): void
{
    foreach ($response->json('data.*.rows.*') as $row) {
        expect($row['form'])->toHaveCount(min($row['played'], 5));

        if ($row['played'] <= 5) {
            $counts = array_count_values($row['form']);
            expect([$counts['win'] ?? 0, $counts['draw'] ?? 0, $counts['loss'] ?? 0])
                ->toBe([$row['won'], $row['drawn'], $row['lost']]);
        }
    }
}

// Wilki wygrywają kolejki 1–3, remisują 4., przegrywają 5., wygrywają 6.
// i remisują 7. Ostatnie pięć to kolejki 3–7, najnowsza na końcu.
it('forma to pięć ostatnich meczów po kolejce, najnowszy na końcu', function () {
    $tournament = standingsLeague(['Wilki Bemowo', 'Orły Bielany']);
    $scores = [[1, 0], [2, 0], [3, 1], [1, 1], [0, 2], [4, 0], [2, 2]];

    foreach ($scores as $index => [$home, $away]) {
        standingsRoundMatch($tournament, $index + 1, 'Wilki Bemowo', 'Orły Bielany', $home, $away);
    }

    $response = standingsOf($tournament)->assertValidResponse(200);

    expect(standingsFormOf($response, 'Wilki Bemowo'))->toBe(['win', 'draw', 'loss', 'win', 'draw'])
        ->and(standingsFormOf($response, 'Orły Bielany'))->toBe(['loss', 'draw', 'win', 'loss', 'draw']);
    standingsExpectFormMatchesRecord($response);
});

// Mecz 1. kolejki przełożono: jego wynik zapisano po wyniku 2. kolejki, więc
// ma późniejsze `id`. W formie i tak stoi przed meczem 2. kolejki.
it('forma idzie po kolejce, nie po kolejności zapisu wyniku ani id meczu', function () {
    $tournament = standingsLeague(['Wilki Bemowo', 'Orły Bielany', 'Sokoły Ursus']);
    standingsRoundMatch($tournament, 2, 'Wilki Bemowo', 'Orły Bielany', 0, 3);
    standingsRoundMatch($tournament, 1, 'Wilki Bemowo', 'Sokoły Ursus', 2, 0);

    expect(standingsFormOf(standingsOf($tournament)->assertValidResponse(200), 'Wilki Bemowo'))
        ->toBe(['win', 'loss']);
});

it('w jednej kolejce forma idzie po numerze meczu, nie po id', function () {
    $tournament = standingsLeague(['Wilki Bemowo', 'Orły Bielany', 'Sokoły Ursus']);
    $round = $tournament->stages()->firstOrFail()->rounds()->firstOrFail();

    foreach ([[2, 'Orły Bielany', 0, 1], [1, 'Sokoły Ursus', 1, 0]] as [$number, $away, $homeScore, $awayScore]) {
        GameMatch::factory()->for($round)->finished($homeScore, $awayScore)->create([
            'match_number' => $number,
            'home_team_id' => standingsTeam($tournament, 'Wilki Bemowo')->id,
            'away_team_id' => standingsTeam($tournament, $away)->id,
        ]);
    }

    expect(standingsFormOf(standingsOf($tournament)->assertValidResponse(200), 'Wilki Bemowo'))
        ->toBe(['win', 'loss']);
});

it('mecz live z dowolnym wynikiem i mecz zaplanowany nie wchodzą do formy', function () {
    $tournament = standingsLeague(['Wilki Bemowo', 'Orły Bielany', 'Sokoły Ursus']);
    standingsRoundMatch($tournament, 1, 'Wilki Bemowo', 'Orły Bielany', 1, 0);
    standingsRoundMatch($tournament, 2, 'Sokoły Ursus', 'Wilki Bemowo', 4, 0, 'live');
    standingsRoundMatch($tournament, 3, 'Orły Bielany', 'Wilki Bemowo', status: 'scheduled');

    $response = standingsOf($tournament)->assertValidResponse(200);

    expect(standingsFormOf($response, 'Wilki Bemowo'))->toBe(['win'])
        ->and(standingsFormOf($response, 'Sokoły Ursus'))->toBe([]);
    standingsExpectFormMatchesRecord($response);
});

// Model odmawia usunięcia drużyny z meczem zakończonym (`GuardsStartedMatches`),
// ale kalkulator pomija mecz z drużyną usuniętą niezależnie od tego guardu
// (docblock `tally()`), więc test usuwa ją masowo, z pominięciem modelu.
it('forma zgadza się z bilansem także po usunięciu drużyny, z którą grano', function () {
    $tournament = standingsLeague(['Wilki Bemowo', 'Orły Bielany', 'Sokoły Ursus']);
    standingsRoundMatch($tournament, 1, 'Wilki Bemowo', 'Orły Bielany', 2, 0);
    standingsRoundMatch($tournament, 2, 'Sokoły Ursus', 'Wilki Bemowo', 1, 1);
    standingsRoundMatch($tournament, 3, 'Orły Bielany', 'Sokoły Ursus', 0, 3);
    Team::query()->whereKey(standingsTeam($tournament, 'Orły Bielany')->id)->delete();

    $response = standingsOf($tournament)->assertValidResponse(200);

    expect(standingsOrder($response))->toBe(['Sokoły Ursus', 'Wilki Bemowo'])
        ->and(standingsFormOf($response, 'Wilki Bemowo'))->toBe(['draw'])
        ->and(standingsFormOf($response, 'Sokoły Ursus'))->toBe(['draw']);
    standingsExpectFormMatchesRecord($response);
});

it('w koszykówce forma nie ma remisu', function () {
    $tournament = standingsLeague(['Rysie Mokotów', 'Żubry Wola'], 'basketball');
    standingsRoundMatch($tournament, 1, 'Rysie Mokotów', 'Żubry Wola', 70, 81);
    standingsRoundMatch($tournament, 2, 'Żubry Wola', 'Rysie Mokotów', 77, 80);

    $response = standingsOf($tournament)->assertValidResponse(200);

    expect(standingsFormOf($response, 'Rysie Mokotów'))->toBe(['loss', 'win'])
        ->and(standingsFormOf($response, 'Żubry Wola'))->toBe(['win', 'loss'])
        ->and($response->json('data.0.rows.*.form.*'))->not->toContain('draw');
});

// Wisła i Arka mają po 4 punkty, a kolejność rozstrzyga mini-tabela. Forma
// każdej z nich to dalej jej pełny sezon, nie same mecze bezpośrednie.
it('remis rozstrzygany head_to_head nie zmienia formy', function () {
    $tournament = standingsHeadToHeadLeague(['points', 'head_to_head', 'score_for']);

    $response = standingsOf($tournament)->assertValidResponse(200);

    expect(standingsOrder($response))->toBe(['Wisła', 'Arka', 'Cracovia'])
        ->and(standingsFormOf($response, 'Wisła'))->toBe(['win', 'loss', 'draw'])
        ->and(standingsFormOf($response, 'Arka'))->toBe(['loss', 'win', 'draw'])
        ->and(standingsFormOf($response, 'Cracovia'))->toBe(['draw', 'draw']);
    standingsExpectFormMatchesRecord($response);
});

// --- sport z setami (#301) ---------------------------------------------------

/**
 * Mecz siatkówki w pierwszej kolejce z setami `[[25, 20], …]`; wynik to sety
 * wygrane, jak po zapisie przez API.
 *
 * @param  list<array{int, int}>  $sets
 */
function standingsSetMatch(Tournament $tournament, string $home, string $away, array $sets): GameMatch
{
    $round = $tournament->stages()->firstOrFail()->rounds()->firstOrFail();

    return GameMatch::factory()->for($round)->withSets($sets)->create([
        'match_number' => (int) GameMatch::where('round_id', $round->id)->max('match_number') + 1,
        'home_team_id' => standingsTeam($tournament, $home)->id,
        'away_team_id' => standingsTeam($tournament, $away)->id,
    ]);
}

/** @return array<string, array<string, mixed>> wiersze pierwszej tabeli po nazwie drużyny */
function standingsRowsByName(TestResponse $response): array
{
    return collect($response->json('data.0.rows'))->keyBy('team.name')->all();
}

it('w siatkówce 3:1 daje 3 i 0 pkt, 3:2 daje 2 i 1, a wiersz niesie sety i punkty w setach', function () {
    $tournament = standingsLeague(['Orlęta', 'Mewy', 'Czaple'], 'volleyball');
    standingsSetMatch($tournament, 'Orlęta', 'Mewy', [[25, 20], [23, 25], [25, 22], [25, 19]]);
    standingsSetMatch($tournament, 'Czaple', 'Mewy', [[25, 23], [23, 25], [25, 21], [20, 25], [15, 11]]);

    $response = standingsOf($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.scoreLabel', 'Sety')
        ->assertJsonPath('data.0.rallyPointsLabel', 'Punkty w setach');
    $rows = standingsRowsByName($response);

    expect($rows['Orlęta'])->toMatchArray(['points' => 3, 'scoreFor' => 3, 'scoreAgainst' => 1, 'rallyPointsFor' => 98, 'rallyPointsAgainst' => 86])
        ->and($rows['Czaple'])->toMatchArray(['points' => 2, 'scoreFor' => 3, 'scoreAgainst' => 2, 'rallyPointsFor' => 108, 'rallyPointsAgainst' => 105])
        ->and($rows['Mewy'])->toMatchArray(['points' => 1, 'won' => 0, 'lost' => 2, 'scoreFor' => 3, 'scoreAgainst' => 6, 'rallyPointsFor' => 191, 'rallyPointsAgainst' => 206]);
});

it('w siatkówce drużyna bez meczu ma punkty w setach 0:0', function () {
    $volleyball = standingsLeague(['Orlęta'], 'volleyball');

    expect(standingsOf($volleyball)->assertValidResponse(200)->json('data.0.rows.0'))
        ->toMatchArray(['rallyPointsFor' => 0, 'rallyPointsAgainst' => 0]);
});

it('w siatkówce zmiana punktacji po secie decydującym działa wstecz', function () {
    $tournament = standingsLeague(['Orlęta', 'Mewy'], 'volleyball');
    standingsSetMatch($tournament, 'Orlęta', 'Mewy', [[25, 23], [23, 25], [25, 21], [20, 25], [15, 11]]);

    $tournament->update(['points' => ['win' => 3, 'draw' => 0, 'loss' => 0, 'winDecidingSet' => 3, 'lossDecidingSet' => 0]]);

    expect(standingsOf($tournament)->assertValidResponse(200)->json('data.0.rows.*.points'))->toBe([3, 0]);
});

it('w siatkówce stosunek setów rozstrzyga remis punktowy, a drużyna bez straconego seta stoi wyżej', function () {
    $tournament = standingsLeague(['Orlęta', 'Mewy', 'Czaple', 'Jaskółki'], 'volleyball', ['tiebreakers' => ['points', 'set_ratio']]);
    standingsSetMatch($tournament, 'Mewy', 'Czaple', [[25, 20], [23, 25], [25, 22], [25, 19]]);
    standingsSetMatch($tournament, 'Orlęta', 'Jaskółki', [[25, 20], [25, 22], [25, 19]]);

    expect(standingsOrder(standingsOf($tournament)->assertValidResponse(200)))->toBe(['Orlęta', 'Mewy', 'Czaple', 'Jaskółki']);
});

it('w siatkówce 0:0 w setach ma iloraz zero, jak 0:3, a 1:3 stoi wyżej', function () {
    $tournament = standingsLeague(['Orlęta', 'Mewy', 'Czaple', 'Jaskółki', 'Albatrosy'], 'volleyball', ['tiebreakers' => ['points', 'set_ratio']]);
    standingsSetMatch($tournament, 'Orlęta', 'Mewy', [[25, 20], [25, 22], [25, 19]]);
    standingsSetMatch($tournament, 'Czaple', 'Jaskółki', [[25, 20], [23, 25], [25, 22], [25, 19]]);

    // Albatrosy bez meczu (0:0) i Mewy (0:3) remisują na stosunku setów, więc
    // rozstrzyga nazwa; Jaskółki (1:3) stoją przed obiema.
    expect(standingsOrder(standingsOf($tournament)->assertValidResponse(200)))->toBe(['Orlęta', 'Czaple', 'Jaskółki', 'Albatrosy', 'Mewy']);
});

it('w siatkówce stosunek punktów w setach rozstrzyga przy równym stosunku setów', function () {
    $tournament = standingsLeague(['Orlęta', 'Mewy', 'Czaple', 'Jaskółki'], 'volleyball', ['tiebreakers' => ['points', 'set_ratio', 'point_ratio']]);
    // Mewy: 3:1 w setach, 98:86 w punktach. Orlęta: 3:1, 100:95.
    standingsSetMatch($tournament, 'Mewy', 'Czaple', [[25, 20], [23, 25], [25, 22], [25, 19]]);
    standingsSetMatch($tournament, 'Orlęta', 'Jaskółki', [[25, 23], [25, 23], [25, 27], [25, 22]]);

    expect(standingsOrder(standingsOf($tournament)->assertValidResponse(200)))->toBe(['Mewy', 'Orlęta', 'Jaskółki', 'Czaple']);
});
