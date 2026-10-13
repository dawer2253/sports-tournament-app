<?php

use App\Models\GameMatch;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
use App\Schedule\BracketGenerator;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Wynik meczu pucharowego: karne, awans i blokada (#228)
|--------------------------------------------------------------------------
|
| Reguły ustalił #216 (niezmienniki 1–8 z wkładu na #217). Puchar powstaje
| z generatora, więc krawędzie są te same co w panelu. 401, 403 i `manage`
| tej trasy są w `SubtreeAuthorizationTest`.
|
| Funkcje niżej lądują w globalnej przestrzeni nazw Pesta, stąd prefiks
| `cupResult`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/**
 * Puchar czterech drużyn z meczem o 3. miejsce: Półfinał 1 to Wilki – Rysie
 * (seedy 1 i 4, zasila stronę `home`), Półfinał 2 to Orły – Sokoły (seedy
 * 2 i 3, strona `away`).
 *
 * @return array{sf1: GameMatch, sf2: GameMatch, final: GameMatch, third: GameMatch, teams: array<string, Team>}
 */
function cupResultBracket(string $sport = 'football'): array
{
    $factory = Tournament::factory();
    $tournament = ($sport === 'basketball' ? $factory->basketball() : $factory)->create();
    $teams = [];
    foreach (['Wilki', 'Orły', 'Sokoły', 'Rysie'] as $name) {
        $teams[$name] = Team::factory()->for($tournament)->create(['name' => $name]);
    }
    $stage = Stage::factory()->knockout()->for($tournament)->create();

    app(BracketGenerator::class)->generate($stage, array_map(fn (Team $team): int => $team->id, array_values($teams)), true);

    $byPosition = fn (int $order, int $number): GameMatch => $stage->matches()
        ->whereHas('round', fn ($query) => $query->where('order', $order))
        ->where('match_number', $number)
        ->firstOrFail();

    return [
        'sf1' => $byPosition(1, 1),
        'sf2' => $byPosition(1, 2),
        'final' => $byPosition(2, 1),
        'third' => $byPosition(2, 2),
        'teams' => $teams,
    ];
}

function cupResultUpdate(GameMatch $match, array $body): TestResponse
{
    return actingAsOrganizer($match->stage->tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", $body);
}

// --- niezmiennik 1 i 2: awans przy `finished` --------------------------------

it('po zakończeniu półfinału zwycięzca stoi w finale, a przegrany w meczu o 3. miejsce, po stronie advancesToSlot', function () {
    ['sf1' => $sf1, 'sf2' => $sf2, 'final' => $final, 'third' => $third, 'teams' => $teams] = cupResultBracket();

    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 2, 'awayScore' => 0])
        ->assertValidRequest()
        ->assertValidResponse(200);

    cupResultUpdate($sf2, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 3])
        ->assertValidResponse(200);

    expect($final->fresh())
        ->home_team_id->toBe($teams['Wilki']->id)
        ->away_team_id->toBe($teams['Sokoły']->id)
        ->and($third->fresh())
        ->home_team_id->toBe($teams['Rysie']->id)
        ->away_team_id->toBe($teams['Orły']->id);
});

it('mecz live z wynikiem nie wypełnia żadnego slotu', function () {
    ['sf1' => $sf1, 'final' => $final, 'third' => $third] = cupResultBracket();

    cupResultUpdate($sf1, ['status' => 'live', 'homeScore' => 2, 'awayScore' => 0])
        ->assertValidResponse(200);

    expect($final->fresh())->home_team_id->toBeNull()
        ->and($third->fresh())->home_team_id->toBeNull();
});

// --- niezmiennik 3: podmiana ---------------------------------------------------

it('zmiana zwycięzcy podmienia drużyny w obu meczach zależnych, a termin, obiekt i druga drużyna zostają', function () {
    ['sf1' => $sf1, 'sf2' => $sf2, 'final' => $final, 'third' => $third, 'teams' => $teams] = cupResultBracket();
    cupResultUpdate($sf2, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 0])->assertValidResponse(200);
    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 2, 'awayScore' => 0])->assertValidResponse(200);
    $venue = Venue::factory()->for($final->stage->tournament)->create();
    $final->update(['kickoff_at' => '2026-10-11 10:00:00', 'venue_id' => $venue->id]);

    cupResultUpdate($sf1, ['homeScore' => 0, 'awayScore' => 2])->assertValidResponse(200);

    expect($final->fresh())
        ->home_team_id->toBe($teams['Rysie']->id)
        ->away_team_id->toBe($teams['Orły']->id)
        ->venue_id->toBe($venue->id)
        ->kickoff_at->toDateTimeString()->toBe('2026-10-11 10:00:00')
        ->and($third->fresh())
        ->home_team_id->toBe($teams['Wilki']->id)
        ->away_team_id->toBe($teams['Sokoły']->id);
});

it('zmiana zwycięzcy samymi karnymi (4:3 na 3:4) podmienia drużyny w obu meczach zależnych', function () {
    ['sf1' => $sf1, 'final' => $final, 'third' => $third, 'teams' => $teams] = cupResultBracket();
    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 1, 'homePenalties' => 4, 'awayPenalties' => 3])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.homePenalties', 4)
        ->assertJsonPath('data.awayPenalties', 3);
    expect($final->fresh())->home_team_id->toBe($teams['Wilki']->id);

    cupResultUpdate($sf1, ['homePenalties' => 3, 'awayPenalties' => 4])->assertValidResponse(200);

    expect($final->fresh())->home_team_id->toBe($teams['Rysie']->id)
        ->and($third->fresh())->home_team_id->toBe($teams['Wilki']->id);
});

// --- niezmiennik 4: zerowanie --------------------------------------------------

it('powrót z finished do live albo scheduled zeruje slot w obu meczach zależnych', function (array $body) {
    ['sf1' => $sf1, 'final' => $final, 'third' => $third] = cupResultBracket();
    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 2, 'awayScore' => 0])->assertValidResponse(200);

    cupResultUpdate($sf1, $body)->assertValidResponse(200);

    expect($final->fresh())->home_team_id->toBeNull()
        ->and($third->fresh())->home_team_id->toBeNull();
})->with([
    'live' => [['status' => 'live']],
    'scheduled' => [['status' => 'scheduled', 'homeScore' => null, 'awayScore' => null]],
]);

// --- niezmiennik 5: atomowa blokada --------------------------------------------

/** Półfinały rozegrane 2:0 i 1:0, więc finał to Wilki – Orły, a o 3. miejsce Rysie – Sokoły. */
function cupResultPlayedSemis(): array
{
    $bracket = cupResultBracket();
    cupResultUpdate($bracket['sf1'], ['status' => 'finished', 'homeScore' => 2, 'awayScore' => 0])->assertValidResponse(200);
    cupResultUpdate($bracket['sf2'], ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 0])->assertValidResponse(200);

    return array_map(fn ($value) => $value instanceof GameMatch ? $value->fresh() : $value, $bracket);
}

it('zmiana zwycięzcy przy rozpoczętym meczu zależnym daje 422 i nie zmienia niczego w bazie', function () {
    ['sf1' => $sf1, 'final' => $final, 'third' => $third] = cupResultPlayedSemis();
    cupResultUpdate($final, ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0])->assertValidResponse(200);
    cupResultUpdate($third, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 0])->assertValidResponse(200);
    $before = [$sf1->fresh()->toArray(), $final->fresh()->toArray(), $third->fresh()->toArray()];

    cupResultUpdate($sf1, ['homeScore' => 0, 'awayScore' => 2])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.homeScore.0', 'Zwycięzca zagrał już dalej: Finał (Wilki – Orły), Mecz o 3. miejsce (Rysie – Sokoły). Cofnij te mecze do zaplanowanych, zanim zmienisz zwycięzcę.');

    expect([$sf1->fresh()->toArray(), $final->fresh()->toArray(), $third->fresh()->toArray()])->toBe($before);
});

it('blokuje też wtedy, gdy rozpoczęty jest tylko mecz o 3. miejsce, i nie rusza finału', function () {
    ['sf1' => $sf1, 'final' => $final, 'third' => $third, 'teams' => $teams] = cupResultPlayedSemis();
    cupResultUpdate($third, ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0])->assertValidResponse(200);

    cupResultUpdate($sf1, ['homeScore' => 0, 'awayScore' => 2])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.homeScore.0', 'Zwycięzca zagrał już dalej: Mecz o 3. miejsce (Rysie – Sokoły). Cofnij te mecze do zaplanowanych, zanim zmienisz zwycięzcę.');

    expect($sf1->fresh())->home_score->toBe(2)->away_score->toBe(0)
        ->and($final->fresh())->home_team_id->toBe($teams['Wilki']->id);
});

it('przy ciele z samym stanem błąd blokady idzie pod status', function () {
    ['sf1' => $sf1, 'final' => $final] = cupResultPlayedSemis();
    cupResultUpdate($final, ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0])->assertValidResponse(200);

    cupResultUpdate($sf1, ['status' => 'live'])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('status')
        ->assertJsonMissingValidationErrors('homeScore');

    expect($sf1->fresh())->status->toBe('finished');
});

// --- niezmiennik 6 i 7: co zostaje nietknięte --------------------------------

it('poprawka 3:1 na 3:2 po rozegranym finale przechodzi i nie rusza finału', function () {
    ['sf1' => $sf1, 'final' => $final] = cupResultPlayedSemis();
    cupResultUpdate($sf1, ['homeScore' => 3, 'awayScore' => 1])->assertValidResponse(200);
    cupResultUpdate($final, ['status' => 'finished', 'homeScore' => 2, 'awayScore' => 1])->assertValidResponse(200);
    $before = $final->fresh()->toArray();

    cupResultUpdate($sf1, ['homeScore' => 3, 'awayScore' => 2])
        ->assertValidResponse(200)
        ->assertJsonPath('data.awayScore', 2);

    expect($final->fresh()->toArray())->toBe($before);
});

it('slotu po wolnym losie nic nie czyści', function () {
    $tournament = Tournament::factory()->create();
    $seeds = Team::factory()->count(3)->for($tournament)->create();
    $stage = Stage::factory()->knockout()->for($tournament)->create();
    app(BracketGenerator::class)->generate($stage, $seeds->pluck('id')->all(), false);
    // Drabinka na 4: seed 1 ma wolny los i stoi od razu w finale, po stronie home.
    $semi = $stage->matches()->whereNotNull('winner_to_match_id')->sole();
    $final = $stage->matches()->whereNull('winner_to_match_id')->sole();

    cupResultUpdate($semi, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 0])->assertValidResponse(200);
    cupResultUpdate($semi, ['status' => 'scheduled', 'homeScore' => null, 'awayScore' => null])->assertValidResponse(200);

    expect($final->fresh())
        ->home_team_id->toBe($seeds[0]->id)
        ->away_team_id->toBeNull();
});

// --- niezmiennik 8: tabela 422 -----------------------------------------------

it('remis finished w meczu pucharowym bez karnych daje 422 pod homePenalties', function () {
    ['sf1' => $sf1] = cupResultBracket();

    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 1])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.homePenalties.0', 'Remis w meczu pucharowym rozstrzygają karne. Wpisz je.');
});

it('karne przy wyniku innym niż remis albo przy live dają 422 pod homePenalties', function (array $body) {
    ['sf1' => $sf1] = cupResultBracket();

    cupResultUpdate($sf1, $body)
        ->assertValidResponse(422)
        ->assertJsonPath('errors.homePenalties.0', 'Karne należą tylko do remisu w meczu zakończonym. Wyczyść oba pola: homePenalties i awayPenalties.');
})->with([
    'wynik 2:1' => [['status' => 'finished', 'homeScore' => 2, 'awayScore' => 1, 'homePenalties' => 4, 'awayPenalties' => 3]],
    'live' => [['status' => 'live', 'homeScore' => 1, 'awayScore' => 1, 'homePenalties' => 4, 'awayPenalties' => 3]],
]);

it('zmiana 1:1 (k. 4:3) na 2:1 bez jawnego null w karnych daje 422, a z null przechodzi', function () {
    ['sf1' => $sf1] = cupResultBracket();
    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 1, 'homePenalties' => 4, 'awayPenalties' => 3])
        ->assertValidResponse(200);

    cupResultUpdate($sf1, ['homeScore' => 2])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('homePenalties');

    cupResultUpdate($sf1, ['homeScore' => 2, 'homePenalties' => null, 'awayPenalties' => null])
        ->assertValidResponse(200)
        ->assertJsonPath('data.homePenalties', null);
});

it('jedno pole karnych puste daje 422 pod homePenalties', function () {
    ['sf1' => $sf1] = cupResultBracket();

    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 1, 'awayPenalties' => 3])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.homePenalties.0', 'Wpisz karne obu drużyn.');
});

it('karne remisowe dają 422 pod homePenalties', function () {
    ['sf1' => $sf1] = cupResultBracket();

    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 1, 'homePenalties' => 3, 'awayPenalties' => 3])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.homePenalties.0', 'Karne muszą wyłonić zwycięzcę.');
});

it('karne poza 0–99 dają 422 pod swoim polem', function () {
    ['sf1' => $sf1] = cupResultBracket();

    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 1, 'homePenalties' => 100, 'awayPenalties' => -1])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors(['homePenalties', 'awayPenalties']);
});

it('w koszykówce remis przy finished z karnymi to błąd wyniku, a nie karnych', function () {
    ['sf1' => $sf1] = cupResultBracket('basketball');

    cupResultUpdate($sf1, ['status' => 'finished', 'homeScore' => 50, 'awayScore' => 50, 'homePenalties' => 4, 'awayPenalties' => 3])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('homeScore')
        ->assertJsonMissingValidationErrors('homePenalties');
});

it('live albo finished w meczu bez obu drużyn daje 422 pod status', function (string $status) {
    ['final' => $final] = cupResultPlayedSemis();
    $final->update(['away_team_id' => null]);

    cupResultUpdate($final, ['status' => $status, 'homeScore' => 1, 'awayScore' => 0])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.status.0', 'Mecz czeka na rywali z poprzedniej rundy.');
})->with(['live', 'finished']);

it('mecz bez rywala przyjmuje sam termin', function () {
    ['final' => $final] = cupResultBracket();

    cupResultUpdate($final, ['kickoffAt' => '2026-10-11T10:00:00+00:00'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.kickoffAt', '2026-10-11T10:00:00+00:00')
        ->assertJsonPath('data.status', 'scheduled');
});
