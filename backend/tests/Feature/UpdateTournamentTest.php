<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Tournament;
use Spectator\Spectator;
use Symfony\Component\Yaml\Yaml;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`. Żądania łamiące
// schemat nie mają `assertValidRequest()`, bo nie przechodzą walidacji
// kontraktu po stronie wejścia — sprawdzana jest sama odpowiedź `422`.

function patchTournament(Tournament $tournament, array $body)
{
    return actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", $body);
}

function tournamentOfSport(string $sport): Tournament
{
    $factory = Tournament::factory();

    return ($sport === 'basketball' ? $factory->basketball() : $factory)->create();
}

function withFinishedMatch(Tournament $tournament): Tournament
{
    GameMatch::factory()
        ->for(Round::factory()->for(Stage::factory()->for($tournament)))
        ->finished()
        ->create();

    expect($tournament->hasFinishedMatches())->toBeTrue();

    return $tournament;
}

it('zmienia wszystkie pola naraz i oddaje turniej w kształcie z show', function () {
    $tournament = Tournament::factory()->create(['status' => 'draft']);

    patchTournament($tournament, [
        'name' => 'Liga Osiedlowa 2026/27',
        'slug' => 'liga-osiedlowa-2026-27',
        'status' => 'active',
        'branding' => ['primaryColor' => '#AA3300'],
        'points' => ['win' => 2, 'draw' => 1, 'loss' => 0],
        'tiebreakers' => ['points', 'score_diff', 'head_to_head', 'score_for'],
    ])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.id', $tournament->id)
        ->assertJsonPath('data.name', 'Liga Osiedlowa 2026/27')
        ->assertJsonPath('data.slug', 'liga-osiedlowa-2026-27')
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.branding.primaryColor', '#AA3300')
        ->assertJsonPath('data.points', ['win' => 2, 'draw' => 1, 'loss' => 0])
        ->assertJsonPath('data.tiebreakers', ['points', 'score_diff', 'head_to_head', 'score_for'])
        ->assertJsonPath('data.sport.code', 'football')
        ->assertJsonPath('data.teamsCount', 0);

    $fresh = $tournament->fresh();
    expect($fresh->name)->toBe('Liga Osiedlowa 2026/27')
        ->and($fresh->slug)->toBe('liga-osiedlowa-2026-27')
        ->and($fresh->status)->toBe('active')
        ->and($fresh->primary_color)->toBe('#AA3300')
        ->and($fresh->points)->toBe(['win' => 2, 'draw' => 1, 'loss' => 0])
        ->and($fresh->tiebreakers)->toBe(['points', 'score_diff', 'head_to_head', 'score_for']);
});

it('przyjmuje puste ciało bez zmian', function () {
    $tournament = Tournament::factory()->create();
    $before = $tournament->fresh()->getAttributes();

    patchTournament($tournament, [])
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', $tournament->name);

    expect($tournament->fresh()->getAttributes())->toBe($before);
});

it('nie rusza pól, których nie wysłano', function (array $body, string $changedColumn) {
    $tournament = Tournament::factory()->create(['status' => 'draft']);
    $before = $tournament->fresh()->getAttributes();

    patchTournament($tournament, $body)->assertValidResponse(200);

    $after = $tournament->fresh()->getAttributes();
    expect($after[$changedColumn])->not->toBe($before[$changedColumn]);

    unset($before[$changedColumn], $before['updated_at'], $after[$changedColumn], $after['updated_at']);
    expect($after)->toBe($before);
})->with([
    'nazwa' => [['name' => 'Nowa nazwa'], 'name'],
    'slug' => [['slug' => 'nowy-adres'], 'slug'],
    'status' => [['status' => 'active'], 'status'],
    'kolor' => [['branding' => ['primaryColor' => '#000000']], 'primary_color'],
    'punktacja' => [['points' => ['win' => 2, 'draw' => 1, 'loss' => 0]], 'points'],
    'tiebreakery' => [['tiebreakers' => ['points']], 'tiebreakers'],
]);

it('odrzuca pustą nazwę i nazwę ponad limit', function (string $name) {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['name' => $name])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('name');
})->with([
    'pusty napis' => [''],
    'same spacje' => ['   '],
    'za długa' => [str_repeat('a', 161)],
]);

// --- slug -------------------------------------------------------------------

it('przyjmuje własny slug turnieju', function () {
    $tournament = Tournament::factory()->create(['slug' => 'liga-osiedlowa-2026']);

    patchTournament($tournament, ['slug' => 'liga-osiedlowa-2026'])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.slug', 'liga-osiedlowa-2026');
});

// Slug jest unikalny globalnie, więc koliduje też turniej innego organizera.
it('odrzuca slug innego turnieju', function () {
    Tournament::factory()->create(['slug' => 'liga-osiedlowa-2026']);
    $tournament = Tournament::factory()->create(['slug' => 'puchar-lata']);

    patchTournament($tournament, ['slug' => 'liga-osiedlowa-2026'])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonPath('errors.slug', ['Ten adres ma już inny turniej.']);

    expect($tournament->fresh()->slug)->toBe('puchar-lata');
});

it('odrzuca slug spoza wzorca i długości z kontraktu', function (string $slug) {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['slug' => $slug])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('slug');
})->with([
    'wielkie litery' => ['Liga'],
    'polskie znaki' => ['łódź-2026'],
    'podwójny myślnik' => ['liga--2026'],
    'myślnik na końcu' => ['liga-'],
    'spacja w środku' => ['liga 2026'],
    'za krótki' => ['ab'],
    'za długi' => [str_repeat('a', 81)],
]);

// --- branding ---------------------------------------------------------------

it('odrzuca kolor spoza wzorca', function (string $color) {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['branding' => ['primaryColor' => $color]])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('branding.primaryColor');
})->with([
    'bez krzyżyka' => ['1F7A45'],
    'trzy znaki' => ['#1F7'],
    'spoza hex' => ['#1G7A45'],
]);

// `logoUrl` nie występuje w `TournamentUpdate.branding`
// (`additionalProperties: false`) — logo wgrywa osobna trasa.
it('odrzuca logoUrl w brandingu', function () {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['branding' => ['logoUrl' => 'http://example.com/logo.png']])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('branding');

    expect($tournament->fresh()->logo_path)->toBeNull();
});

// --- status (#82) -----------------------------------------------------------

it('przechodzi między stanami bez warunków wstępnych', function (string $from, string $to, bool $finishedMatch) {
    $tournament = Tournament::factory()->create(['status' => $from]);

    if ($finishedMatch) {
        withFinishedMatch($tournament);
    }

    patchTournament($tournament, ['status' => $to])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', $to);

    expect($tournament->fresh()->status)->toBe($to);
})->with([
    'draft → active' => ['draft', 'active', false],
    'draft → finished' => ['draft', 'finished', false],
    'active → finished z meczem' => ['active', 'finished', true],
    'finished → active z meczem' => ['finished', 'active', true],
    'active → draft bez meczu' => ['active', 'draft', false],
    'finished → draft bez meczu' => ['finished', 'draft', false],
    // Wysłanie `draft` szkicowi nie jest przejściem, więc zakaz go nie dotyczy.
    'draft → draft z meczem' => ['draft', 'draft', true],
]);

it('nie cofa do draft turnieju z rozegranym meczem', function (string $from) {
    $tournament = withFinishedMatch(Tournament::factory()->create(['status' => $from]));

    patchTournament($tournament, ['status' => 'draft'])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonPath('errors.status', ['Turniej ma rozegrany mecz, więc nie może wrócić do szkicu.']);

    expect($tournament->fresh()->status)->toBe($from);
})->with(['active', 'finished']);

// Mecz zaplanowany nie blokuje powrotu do szkicu — liczy się tylko rozegrany.
it('cofa do draft turniej z meczem nierozegranym', function () {
    $tournament = Tournament::factory()->create(['status' => 'active']);
    GameMatch::factory()->for(Round::factory()->for(Stage::factory()->for($tournament)))->create();

    patchTournament($tournament, ['status' => 'draft'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'draft');
});

it('odrzuca nieznany status', function () {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['status' => 'archived'])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('status');
});

// --- punktacja (#87) --------------------------------------------------------

// Granice pola: `0` i `10` nie dają błędu pod polem. Pełne `200` nie zawsze
// jest możliwe — `win: 0` i `loss: 10` łamią `loss < win` — więc sprawdzany
// jest brak błędu pod samym polem.
it('przyjmuje granice zakresu 0 i 10 w każdym polu punktacji', function (string $field, int $value, array $points) {
    $tournament = Tournament::factory()->create();

    $response = patchTournament($tournament, ['points' => [...$points, $field => $value]]);

    $response->assertJsonMissingValidationErrors("points.{$field}");
})->with([
    'win 0' => ['win', 0, ['draw' => 0, 'loss' => 0]],
    'win 10' => ['win', 10, ['draw' => 1, 'loss' => 0]],
    'draw 0' => ['draw', 0, ['win' => 3, 'loss' => 0]],
    'draw 10' => ['draw', 10, ['win' => 10, 'loss' => 0]],
    'loss 0' => ['loss', 0, ['win' => 3, 'draw' => 1]],
    'loss 10' => ['loss', 10, ['win' => 10, 'draw' => 10]],
]);

it('zapisuje punktację na granicach zakresu', function (array $points) {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['points' => $points])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.points', $points);
})->with([
    'remis równy porażce' => [['win' => 10, 'draw' => 0, 'loss' => 0]],
    'remis równy wygranej' => [['win' => 10, 'draw' => 10, 'loss' => 9]],
]);

// Jedna literówka daje jeden komunikat: porządek nie jest sprawdzany, dopóki
// któreś pole nie przeszło walidacji.
it('odrzuca wartość spoza zakresu albo typu pod polem punktacji', function (string $field, mixed $value) {
    $tournament = Tournament::factory()->create();
    $points = ['win' => 3, 'draw' => 1, 'loss' => 0, $field => $value];

    patchTournament($tournament, ['points' => $points])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors("points.{$field}")
        ->assertJsonMissingValidationErrors('points');

    expect($tournament->fresh()->points)->toBe(['win' => 3, 'draw' => 1, 'loss' => 0]);
})->with([
    'win -1' => ['win', -1],
    'win 11' => ['win', 11],
    'draw -1' => ['draw', -1],
    'draw 11' => ['draw', 11],
    'loss -1' => ['loss', -1],
    'loss 11' => ['loss', 11],
    'win jako napis' => ['win', '3'],
    'win jako ułamek' => ['win', 2.5],
    'draw jako bool' => ['draw', true],
    'loss jako null' => ['loss', null],
]);

it('wymaga kompletu win, draw i loss', function () {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['points' => ['win' => 3, 'loss' => 0]])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('points.draw');
});

it('odrzuca punktację łamiącą porządek w piłce nożnej', function (array $points) {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['points' => $points])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('points')
        ->assertJsonMissingValidationErrors(['points.win', 'points.draw', 'points.loss']);
})->with([
    'loss równe win' => [['win' => 2, 'draw' => 2, 'loss' => 2]],
    'loss większe od win' => [['win' => 1, 'draw' => 1, 'loss' => 3]],
    'draw większe od win' => [['win' => 3, 'draw' => 4, 'loss' => 0]],
    'draw mniejsze od loss' => [['win' => 3, 'draw' => 0, 'loss' => 1]],
]);

it('w koszykówce nie stosuje do remisu porządku loss ≤ draw', function () {
    $tournament = Tournament::factory()->basketball()->create();

    patchTournament($tournament, ['points' => ['win' => 2, 'draw' => 0, 'loss' => 1]])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.points', ['win' => 2, 'draw' => 0, 'loss' => 1]);
});

it('w koszykówce wymaga zera za remis i go nie zeruje', function () {
    $tournament = Tournament::factory()->basketball()->create();

    patchTournament($tournament, ['points' => ['win' => 2, 'draw' => 1, 'loss' => 0]])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors(['points.draw' => 'W tym sporcie nie ma remisów, więc remis musi dawać 0 punktów.'])
        ->assertJsonMissingValidationErrors('points');

    expect($tournament->fresh()->points)->toBe(['win' => 2, 'draw' => 0, 'loss' => 1]);
});

it('w koszykówce wymaga loss < win', function () {
    $tournament = Tournament::factory()->basketball()->create();

    patchTournament($tournament, ['points' => ['win' => 1, 'draw' => 0, 'loss' => 1]])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('points');
});

// Dodatkowy klucz kontrakt dopuszcza, ale do kolumny nie trafia.
it('zapisuje z punktacji tylko win, draw i loss', function () {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['points' => ['win' => 3, 'draw' => 1, 'loss' => 0, 'bonus' => 1]])
        ->assertValidResponse(200)
        ->assertJsonPath('data.points', ['win' => 3, 'draw' => 1, 'loss' => 0]);

    expect($tournament->fresh()->points)->toBe(['win' => 3, 'draw' => 1, 'loss' => 0]);
});

// --- tiebreakery (#87) ------------------------------------------------------

it('przyjmuje samo [points]', function (string $sport) {
    $tournament = tournamentOfSport($sport);

    patchTournament($tournament, ['tiebreakers' => ['points']])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.tiebreakers', ['points']);
})->with([
    'piłka nożna' => ['football'],
    'koszykówka' => ['basketball'],
]);

it('przyjmuje dowolny podzbiór dostępnych kryteriów w dowolnej kolejności', function () {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['tiebreakers' => ['points', 'wins', 'score_for', 'head_to_head']])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.tiebreakers', ['points', 'wins', 'score_for', 'head_to_head']);
});

it('odrzuca kryterium niedostępne w sporcie pod jego indeksem', function (string $sport) {
    $tournament = tournamentOfSport($sport);
    $before = $tournament->tiebreakers;

    patchTournament($tournament, ['tiebreakers' => ['points', 'score_diff', 'score_against']])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors(['tiebreakers.2' => 'To kryterium nie jest dostępne w sporcie tego turnieju.'])
        ->assertJsonMissingValidationErrors(['tiebreakers', 'tiebreakers.0', 'tiebreakers.1']);

    expect($tournament->fresh()->tiebreakers)->toBe($before);
})->with([
    'piłka nożna' => ['football'],
    'koszykówka' => ['basketball'],
]);

it('odrzuca kod spoza enuma pod jego indeksem', function () {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['tiebreakers' => ['points', 'goals']])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors(['tiebreakers.1' => 'Nieznane kryterium kolejności.']);
});

// Błąd stoi przy powtórzeniu, nie przy pierwszym wystąpieniu.
it('odrzuca duplikat pod indeksem powtórzenia', function () {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['tiebreakers' => ['points', 'score_diff', 'wins', 'score_diff']])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors(['tiebreakers.3' => 'To kryterium jest już na liście.'])
        ->assertJsonMissingValidationErrors(['tiebreakers.0', 'tiebreakers.1', 'tiebreakers.2']);
});

it('odrzuca listę, która nie zaczyna się od points, pod tiebreakers.0', function (array $tiebreakers) {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['tiebreakers' => $tiebreakers])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors(['tiebreakers.0' => 'Pierwszym kryterium jest zawsze liczba punktów.']);
})->with([
    'points dalej' => [['score_diff', 'points']],
    'bez points' => [['head_to_head', 'score_diff']],
]);

it('odrzuca pustą listę pod tiebreakers', function () {
    $tournament = Tournament::factory()->create();

    patchTournament($tournament, ['tiebreakers' => []])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.tiebreakers', ['Lista kryteriów musi mieć co najmniej jedną pozycję.'])
        ->assertJsonMissingValidationErrors('tiebreakers.0');
});

// --- niezależność od statusu i meczów (#87) ---------------------------------

it('zmienia punktację i tiebreaki niezależnie od statusu i rozegranych meczów', function (string $status, bool $finishedMatch) {
    $tournament = Tournament::factory()->create(['status' => $status]);

    if ($finishedMatch) {
        withFinishedMatch($tournament);
    }

    patchTournament($tournament, [
        'points' => ['win' => 2, 'draw' => 1, 'loss' => 0],
        'tiebreakers' => ['points', 'wins'],
    ])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.points', ['win' => 2, 'draw' => 1, 'loss' => 0])
        ->assertJsonPath('data.tiebreakers', ['points', 'wins']);
})->with([
    'aktywny z rozegranym meczem' => ['active', true],
    'zakończony' => ['finished', false],
    'zakończony z rozegranym meczem' => ['finished', true],
]);

it('trzyma kody tiebreaków zgodne z enumem TiebreakerCode w kontrakcie', function () {
    $contract = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');

    expect($contract['components']['schemas']['TiebreakerCode']['enum'])
        ->toBe(Tournament::TIEBREAKER_CODES);
});
