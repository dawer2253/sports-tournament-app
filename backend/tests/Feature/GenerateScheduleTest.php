<?php

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
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

// Kasowanie pustego terminarza zakładało blokadę szczeliny na końcu `rounds`
// i dwa pierwsze generowania w różnych turniejach kończyły się deadlockiem.
it('przy pierwszym generowaniu nie blokuje kolejek innych faz', function () {
    generateSchedule(leagueWithTeams(4), 1)->assertValidResponse(201);

    expect(anotherConnectionCanAppendRound())->toBeTrue();
});

// W REPEATABLE READ kasowanie kolejek fazy kaskadą na mecze blokowało szczeliny
// na końcu indeksów `matches` i regeneracje w różnych turniejach kończyły się
// deadlockiem. READ COMMITTED tych blokad nie zakłada; blokada sprawdzenia
// duplikatu w `rounds` zostaje (ADR-0010).
it('przy regeneracji nie blokuje meczów innych faz', function () {
    $stage = leagueWithTeams(4);
    generateSchedule($stage, 1)->assertValidResponse(201);

    generateSchedule($stage, 2)->assertValidResponse(201);

    expect(anotherConnectionCanAppendMatch())->toBeTrue();
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

// Faza pucharowa ma własny generator (`POST /stages/{stage}/bracket`, #215),
// więc odmowa odsyła do drabinki. Faza grupowa ma własny terminarz od #258 —
// jego odmowy sprawdza zestaw niżej.
it('odmawia z 422 dla fazy pucharowej', function () {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(4)->for($tournament)->create();
    $stage = Stage::factory()->knockout()->for($tournament)->create();

    generateSchedule($stage, 1)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Faza pucharowa nie ma terminarza „każdy z każdym”. Wygeneruj dla niej drabinkę.']]);

    expect($stage->rounds()->exists())->toBeFalse();
});

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

/**
 * Faza `group` z grupami o zadanych rozmiarach. Drużyny dostają `group_id`
 * po kolei, więc `id` drużyny niesie też jej grupę, a `order` grup rośnie
 * z kolejnością w liście.
 *
 * @param  list<int>  $sizes
 * @return array{Stage, list<Group>, Collection<int, Team>}
 */
function groupStageWithSizes(array $sizes): array
{
    $tournament = Tournament::factory()->create();
    $stage = Stage::factory()->group()->for($tournament)->create();
    $teams = Team::factory()->count(array_sum($sizes))->for($tournament)->create();

    $groups = [];
    $cursor = 0;

    foreach ($sizes as $index => $size) {
        $group = Group::factory()->for($stage)->create([
            'name' => 'Grupa '.chr(65 + $index),
            'order' => $index + 1,
            'qualifiers' => 2,
        ]);

        foreach ($teams->slice($cursor, $size) as $team) {
            $team->update(['group_id' => $group->id]);
        }

        $cursor += $size;
        $groups[] = $group;
    }

    return [$stage, $groups, $teams];
}

// Niezmienniki 4 i 5 z wkładu #249 (#258).
it('układa terminarz grup: pary w grupach, bez meczów międzygrupowych', function (int $meetings) {
    [$stage, , $teams] = groupStageWithSizes([4, 3]);

    generateSchedule($stage, $meetings)
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 3 * $meetings, 'matchesCount' => 9 * $meetings]);

    $groupOf = $teams->mapWithKeys(fn (Team $team): array => [$team->id => $team->group_id]);
    $pairs = [];

    foreach ($stage->matches()->get() as $match) {
        expect($groupOf[$match->home_team_id])->toBe($groupOf[$match->away_team_id])
            ->and($match->group_id)->toBe($groupOf[$match->home_team_id]);

        $pairs[] = min($match->home_team_id, $match->away_team_id).'-'.max($match->home_team_id, $match->away_team_id);
    }

    // Dziewięć par w obu grupach, każda dokładnie `meetings` razy.
    $counts = collect($pairs)->countBy();
    expect($counts)->toHaveCount(9)
        ->and($counts->values()->unique()->all())->toBe([$meetings]);
})->with(['raz' => 1, 'dwa razy' => 2]);

it('w kolejce każda drużyna gra najwyżej raz, a mecze idą grupami po order', function () {
    [$stage, $groups] = groupStageWithSizes([5, 4]);

    generateSchedule($stage, 1)->assertValidResponse(201);

    // Pięć drużyn to pięć kolejek, cztery drużyny to trzy — faza ma pięć.
    expect($stage->rounds()->count())->toBe(5);

    $orderByGroup = collect($groups)->mapWithKeys(fn (Group $group): array => [$group->id => $group->order]);

    foreach ($stage->rounds()->orderBy('order')->with('matches')->get() as $round) {
        $playing = $round->matches->flatMap(fn (GameMatch $match): array => [$match->home_team_id, $match->away_team_id]);

        expect($playing->count())->toBe($playing->unique()->count())
            ->and($round->matches->pluck('match_number')->values()->all())->toBe(range(1, $round->matches->count()));

        $orders = $round->matches->map(fn (GameMatch $match): int => $orderByGroup[$match->group_id])->values()->all();
        $sorted = $orders;
        sort($sorted);

        expect($orders)->toBe($sorted);
    }
});

it('odmawia z 422 pod stage, gdy faza grupowa nie ma składu', function () {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(4)->for($tournament)->create();
    $stage = Stage::factory()->group()->for($tournament)->create();

    generateSchedule($stage, 1)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Najpierw ustal skład grup.']]);

    expect($stage->rounds()->exists())->toBeFalse();
});

it('odmawia z 422 pod teams, gdy drużyna turnieju nie ma grupy', function () {
    [$stage] = groupStageWithSizes([4]);
    Team::factory()->for($stage->tournament)->create(['name' => 'Pumy Saska Kępa']);

    generateSchedule($stage, 1)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['teams' => ['Drużyna „Pumy Saska Kępa” nie ma grupy. Zapisz skład grup od nowa.']]);

    expect($stage->rounds()->exists())->toBeFalse();
});

// Niezmiennik 8 z wkładu #249 (#258).
it('usunięcie drużyny kasuje jej mecze zaplanowane, a grupa zostaje', function () {
    [$stage, $groups, $teams] = groupStageWithSizes([4]);
    generateSchedule($stage, 1)->assertValidResponse(201);

    $victim = $teams->first();
    $matches = $victim->matchesQuery()->pluck('id');

    $victim->delete();

    expect($matches)->not->toBeEmpty()
        ->and(GameMatch::whereIn('id', $matches)->exists())->toBeFalse()
        ->and(Group::query()->whereKey($groups[0]->id)->exists())->toBeTrue();
});

// Niezmiennik 9 z wkładu #249 (#258): kolejka jest wspólna, więc jej mecze
// z różnych grup grają jednego dnia.
it('rozkłada daty w trybie interval: cała kolejka fazy gra jednego dnia', function () {
    [$stage] = groupStageWithSizes([4, 4]);
    generateSchedule($stage, 1)->assertValidResponse(201);

    actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/schedule/dates", [
            'mode' => 'interval',
            'startAt' => '2026-09-06T10:00:00+02:00',
            'timeZone' => 'Europe/Warsaw',
            'intervalDays' => 7,
            'dayEndTime' => null,
            'venueIds' => [],
            'fromRound' => null,
        ])
        ->assertValidResponse(200);

    foreach ($stage->rounds()->orderBy('order')->with('matches')->get() as $round) {
        $days = $round->matches
            ->map(fn (GameMatch $match): string => CarbonImmutable::parse($match->kickoff_at)->setTimezone('Europe/Warsaw')->toDateString())
            ->unique();

        expect($days)->toHaveCount(1);
    }
});

// #301: mecz sportu z setami powstaje z pustą listą setów, a pozostałe z `null`
// (`Match.sets` w kontrakcie). Generator wstawia hurtem, więc kolumnę ustawia sam.
it('w siatkówce mecze terminarza mają pustą listę setów', function () {
    $volleyball = Tournament::factory()->volleyball()->create();
    Team::factory()->count(4)->for($volleyball)->create();
    $stage = Stage::factory()->for($volleyball)->create();

    generateSchedule($stage, 1)->assertCreated();

    expect($stage->matches()->get()->pluck('sets')->unique()->values()->all())->toBe([[]]);
});

it('w piłce mecze terminarza mają sets: null', function () {
    $stage = leagueWithTeams(4);

    generateSchedule($stage, 1)->assertCreated();

    expect($stage->matches()->get()->pluck('sets')->unique()->values()->all())->toBe([null]);
});
