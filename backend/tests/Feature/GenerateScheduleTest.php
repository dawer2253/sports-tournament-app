<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Testing\TestResponse;
use Random\Engine\Mt19937;
use Random\Randomizer;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
    seedScheduleDraw(2026);
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

/**
 * Losowanie kolejności drużyn bierze `Randomizer` z kontenera, więc test
 * podstawia silnik z ziarnem i dostaje ten sam terminarz przy każdym
 * przebiegu (decyzja #157).
 */
function seedScheduleDraw(int $seed): void
{
    app()->instance(Randomizer::class, new Randomizer(new Mt19937($seed)));
}

/** Faza `league` w turnieju z `$teams` drużynami. */
function leagueWithTeams(int $teams, string $status = 'draft'): Stage
{
    $tournament = Tournament::factory()->create(['status' => $status]);
    Team::factory()->count($teams)->for($tournament)->create();

    return Stage::factory()->for($tournament)->create();
}

function generateSchedule(Stage $stage, mixed $meetings): TestResponse
{
    return actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/schedule", ['meetings' => $meetings]);
}

/**
 * Kolejki fazy po `order`, każda jako lista par [gospodarz, gość] po
 * `match_number`.
 *
 * @return list<list<array{int, int}>>
 */
function scheduleOf(Stage $stage): array
{
    return $stage->rounds()->orderBy('order')->with('matches')->get()
        ->map(fn (Round $round): array => $round->matches->sortBy('match_number')
            ->map(fn (GameMatch $match): array => [$match->home_team_id, $match->away_team_id])
            ->values()->all())
        ->all();
}

it('układa terminarz i oddaje liczbę kolejek i meczów', function () {
    $stage = leagueWithTeams(6);

    generateSchedule($stage, 2)
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertExactJson(['data' => ['roundsCount' => 10, 'matchesCount' => 30]]);

    $rounds = $stage->rounds()->orderBy('order')->get();
    expect($rounds->pluck('name')->all())->toBe(array_map(fn (int $order): string => "Kolejka {$order}", range(1, 10)))
        ->and($rounds->pluck('order')->all())->toBe(range(1, 10));

    $matches = $stage->matches()->get();
    expect($matches)->toHaveCount(30)
        ->and($matches->pluck('status')->unique()->all())->toBe(['scheduled'])
        ->and($matches->whereNotNull('kickoff_at'))->toBeEmpty()
        ->and($matches->whereNotNull('venue_id'))->toBeEmpty()
        ->and($matches->whereNotNull('home_score'))->toBeEmpty();
});

// Niezmienniki z #157. Parzyste i nieparzyste n, jedno i dwa spotkania.
it('spełnia niezmienniki terminarza „każdy z każdym”', function (int $teams, int $meetings) {
    $stage = leagueWithTeams($teams);
    $teamIds = $stage->tournament->teams()->pluck('id')->sort()->values()->all();

    generateSchedule($stage, $meetings)->assertValidResponse(201);
    $schedule = scheduleOf($stage);

    $roundsPerLeg = $teams % 2 === 0 ? $teams - 1 : $teams;
    expect($schedule)->toHaveCount($roundsPerLeg * $meetings);

    // Każda drużyna gra najwyżej raz w kolejce, a pauza nie zostawia wiersza:
    // kolejka ma tylko pełne mecze, po jednym na parę grających.
    foreach ($schedule as $round) {
        $playing = array_merge(...$round);
        expect($playing)->toHaveCount(count(array_unique($playing)))
            ->and($playing)->not->toContain(null)
            ->and($round)->toHaveCount(intdiv($teams, 2));
    }

    // Każda para spotyka się dokładnie `meetings` razy.
    $meetingsByPair = collect($schedule)->flatten(1)
        ->countBy(fn (array $pair): string => min($pair).'-'.max($pair));
    $expectedPairs = collect($teamIds)->crossJoin($teamIds)
        ->filter(fn (array $pair): bool => $pair[0] < $pair[1])
        ->mapWithKeys(fn (array $pair): array => [implode('-', $pair) => $meetings]);
    expect($meetingsByPair->sortKeys()->all())->toBe($expectedPairs->sortKeys()->all());

    // Kolejka n − 1 + t (n przy nieparzystym) to odwrócona kolejka t.
    if ($meetings === 2) {
        foreach (array_slice($schedule, 0, $roundsPerLeg) as $index => $round) {
            $mirrored = array_map(fn (array $pair): array => [$pair[1], $pair[0]], $round);
            expect($schedule[$roundsPerLeg + $index])->toBe($mirrored);
        }
    }
})->with([
    'dwie drużyny, raz' => [2, 1],
    'pięć drużyn, raz' => [5, 1],
    'pięć drużyn, dwa razy' => [5, 2],
    'sześć drużyn, raz' => [6, 1],
    'sześć drużyn, dwa razy' => [6, 2],
    'siedem drużyn, dwa razy' => [7, 2],
]);

it('numeruje mecze w kolejce od jedynki, bez dziur', function () {
    $stage = leagueWithTeams(7);

    generateSchedule($stage, 1)->assertValidResponse(201);

    $stage->rounds()->with('matches')->get()->each(function (Round $round): void {
        expect($round->matches->pluck('match_number')->sort()->values()->all())->toBe([1, 2, 3]);
    });
});

it('losuje kolejność drużyn: to samo ziarno daje ten sam terminarz, inne ziarno inny', function () {
    $stage = leagueWithTeams(8);

    seedScheduleDraw(1);
    generateSchedule($stage, 1)->assertValidResponse(201);
    $first = scheduleOf($stage);

    seedScheduleDraw(1);
    generateSchedule($stage, 1)->assertValidResponse(201);
    expect(scheduleOf($stage))->toBe($first);

    seedScheduleDraw(2);
    generateSchedule($stage, 1)->assertValidResponse(201);
    expect(scheduleOf($stage))->not->toBe($first);
});

// Drużyna usunięta miękko i drużyna innego turnieju nie mogą wejść do
// terminarza: relacja turnieju zwraca tylko żywe drużyny tego turnieju.
it('układa terminarz z żywych drużyn turnieju i tylko z nich', function () {
    $stage = leagueWithTeams(4);
    $removed = Team::factory()->for($stage->tournament)->create();
    $removed->delete();
    $foreign = Team::factory()->create();

    generateSchedule($stage, 1)
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 3, 'matchesCount' => 6]);

    $playing = collect(scheduleOf($stage))->flatten()->unique();
    expect($playing->sort()->values()->all())->toBe($stage->tournament->teams()->pluck('id')->sort()->values()->all())
        ->and($playing)->not->toContain($removed->id)
        ->and($playing)->not->toContain($foreign->id);
});

// Ręcznie ustawiony termin i obiekt też znikają (#157, „Ponowne generowanie”).
it('zastępuje cały poprzedni terminarz fazy, razem z terminami i obiektami', function () {
    $stage = leagueWithTeams(4);
    generateSchedule($stage, 2)->assertValidResponse(201);
    $oldRoundIds = $stage->rounds()->pluck('id');
    $oldMatchIds = $stage->matches()->pluck('id');
    $stage->matches()->first()->update([
        'kickoff_at' => '2026-10-04 10:00:00',
        'venue_id' => Venue::factory()->for($stage->tournament)->create()->id,
    ]);

    generateSchedule($stage, 1)
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 3, 'matchesCount' => 6]);

    expect(GameMatch::whereIn('id', $oldMatchIds)->exists())->toBeFalse()
        ->and(Round::whereIn('id', $oldRoundIds)->exists())->toBeFalse()
        ->and($stage->matches()->count())->toBe(6)
        ->and($stage->matches()->where(fn ($query) => $query->whereNotNull('kickoff_at')->orWhereNotNull('venue_id'))->exists())->toBeFalse();
});

it('nie rusza terminarza innej fazy', function () {
    $stage = leagueWithTeams(4);
    $other = GameMatch::factory()->create();

    generateSchedule($stage, 1)->assertValidResponse(201);

    expect($other->fresh())->not->toBeNull()
        ->and($other->round->fresh())->not->toBeNull();
});

it('przy meczu rozpoczętym odmawia z 422 i niczego nie zmienia', function (string $status) {
    $stage = leagueWithTeams(4);
    generateSchedule($stage, 1)->assertValidResponse(201);
    $stage->matches()->orderBy('id')->first()->update(match ($status) {
        'live' => ['status' => 'live', 'home_score' => 1, 'away_score' => 0],
        'finished' => ['status' => 'finished', 'home_score' => 2, 'away_score' => 1],
    });
    $before = $stage->matches()->orderBy('id')->get()->toArray();

    generateSchedule($stage, 2)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Faza ma rozegrane mecze, więc nie można wygenerować terminarza ponownie.']]);

    expect($stage->matches()->orderBy('id')->get()->toArray())->toBe($before);
})->with(['live', 'finished']);

it('odmawia z 422 pod teams, gdy turniej ma mniej niż dwie drużyny', function (int $teams) {
    $stage = leagueWithTeams($teams);

    generateSchedule($stage, 1)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['teams' => ['Liga potrzebuje co najmniej dwóch drużyn.']]);

    expect($stage->rounds()->exists())->toBeFalse();
})->with(['bez drużyn' => 0, 'jedna drużyna' => 1]);

it('odmawia z 422 dla fazy innej niż league', function (string $state) {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(4)->for($tournament)->create();
    $stage = Stage::factory()->for($tournament)->{$state}()->create();

    generateSchedule($stage, 1)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Generowanie terminarza działa na razie tylko dla fazy ligowej.']]);

    expect($stage->rounds()->exists())->toBeFalse();
})->with(['group', 'knockout']);

// Status turnieju nie gra roli (#157, „Status turnieju”).
it('generuje w turnieju w każdym statusie', function (string $status) {
    generateSchedule(leagueWithTeams(3, $status), 1)
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 3, 'matchesCount' => 3]);
})->with(Tournament::STATUSES);

it('wymaga meetings równego 1 albo 2, jako liczby', function (mixed $meetings) {
    $stage = leagueWithTeams(4);

    generateSchedule($stage, $meetings)
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor('meetings')
        ->assertJsonMissingValidationErrors(['stage', 'teams']);

    expect($stage->rounds()->exists())->toBeFalse();
})->with([
    'brak' => null,
    'trzy' => 3,
    'zero' => 0,
    'napis' => '2',
    'logiczna' => true,
]);

it('nie przyjmuje pustego ciała', function () {
    $stage = leagueWithTeams(4);

    actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/schedule", [])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.meetings', ['Wybierz, ile razy grają ze sobą drużyny: raz albo dwa razy.']);
});
