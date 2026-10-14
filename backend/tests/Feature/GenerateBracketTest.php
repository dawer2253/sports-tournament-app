<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Support\Collection;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;
use Symfony\Component\Yaml\Yaml;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

/**
 * Faza `knockout` w turnieju z `$teams` drużynami. Drużyny idą po `id`, więc
 * ich kolejność to od razu rozstawienie: pierwsza jest seedem 1.
 */
function cupWithTeams(int $teams, string $status = 'draft'): Stage
{
    $tournament = Tournament::factory()->create(['status' => $status]);
    Team::factory()->count($teams)->for($tournament)->create();

    return Stage::factory()->knockout()->for($tournament)->create();
}

/** @return list<int> drużyny turnieju fazy po `id`, czyli seedy 1…n */
function seedsOf(Stage $stage): array
{
    return $stage->tournament->teams()->orderBy('id')->pluck('id')->all();
}

/** @param  list<int>|null  $teamIds  domyślnie drużyny po `id` */
function generateBracket(Stage $stage, ?array $teamIds = null, mixed $thirdPlaceMatch = false): TestResponse
{
    return actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/bracket", [
            'teamIds' => $teamIds ?? seedsOf($stage),
            'thirdPlaceMatch' => $thirdPlaceMatch,
        ]);
}

it('układa drabinkę sześciu drużyn i oddaje liczbę rund i meczów', function () {
    $stage = cupWithTeams(6);

    generateBracket($stage)
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertExactJson(['data' => ['roundsCount' => 3, 'matchesCount' => 5]]);

    $rounds = $stage->rounds()->orderBy('order')->get();
    expect($rounds->pluck('name')->all())->toBe(['Ćwierćfinał', 'Półfinał', 'Finał'])
        ->and($rounds->pluck('order')->all())->toBe([1, 2, 3]);

    $matches = $stage->matches()->get();
    expect($matches)->toHaveCount(5)
        ->and($matches->pluck('status')->unique()->all())->toBe(['scheduled'])
        ->and($matches->whereNotNull('kickoff_at'))->toBeEmpty()
        ->and($matches->whereNotNull('venue_id'))->toBeEmpty();
});

/**
 * Mecze drabinki fazy z rundą, po `round.order` i `match_number`.
 *
 * @return Collection<int, GameMatch>
 */
function bracketMatches(Stage $stage): Collection
{
    return $stage->matches()->with('round')->get()
        ->sortBy(fn (GameMatch $match): array => [$match->round->order, $match->match_number])
        ->values();
}

/**
 * Sloty, do których prowadzi krawędź zwycięzcy albo przegranego.
 *
 * @param  Collection<int, GameMatch>  $matches
 * @return array<string, true> klucz `"{id meczu}.{home|away}"`
 */
function bracketFedSlots(Collection $matches): array
{
    $fed = [];
    foreach ($matches as $match) {
        foreach ([$match->winner_to_match_id, $match->loser_to_match_id] as $target) {
            if ($target !== null) {
                $fed["{$target}.{$match->advances_to_slot}"] = true;
            }
        }
    }

    return $fed;
}

/**
 * Drużyny na wejściu drabinki: obie z meczu pierwszej rundy i każda drużyna
 * postawiona w slocie, do którego nie prowadzi żadna krawędź (wolny los).
 *
 * @return list<int>
 */
function bracketEntrants(Stage $stage): array
{
    $matches = bracketMatches($stage);
    $fed = bracketFedSlots($matches);
    $entrants = [];

    foreach ($matches as $match) {
        foreach (['home', 'away'] as $side) {
            $team = $match->{"{$side}_team_id"};
            if ($team !== null && ($match->round->order === 1 || ! isset($fed["{$match->id}.{$side}"]))) {
                $entrants[] = $team;
            }
        }
    }

    return $entrants;
}

/** Liczby drużyn z niezmienników #215: 2…33 i 128. */
dataset('rozmiary drabinki', fn (): array => array_merge(range(2, 33), [128]));

// Niezmiennik 1 z #215.
it('ma n − 1 meczów i ⌈log₂ n⌉ rund, a z meczem o 3. miejsce jeden mecz więcej', function (int $teams) {
    $stage = cupWithTeams($teams);
    $roundsCount = (int) ceil(log($teams, 2));

    generateBracket($stage)
        ->assertValidResponse(201)
        ->assertExactJson(['data' => ['roundsCount' => $roundsCount, 'matchesCount' => $teams - 1]]);

    expect($stage->matches()->count())->toBe($teams - 1)
        ->and($stage->rounds()->count())->toBe($roundsCount);

    if ($teams >= 4) {
        generateBracket($stage, thirdPlaceMatch: true)
            ->assertValidResponse(201)
            ->assertExactJson(['data' => ['roundsCount' => $roundsCount, 'matchesCount' => $teams]]);
    }
})->with('rozmiary drabinki');

// Niezmienniki 2 i 3 z #215.
it('stawia każdą drużynę na wejściu dokładnie raz, a wolne losy daje seedom 1…(2^k − n)', function (int $teams) {
    $stage = cupWithTeams($teams);
    $seeds = seedsOf($stage);
    $size = 2 ** (int) ceil(log($teams, 2));

    generateBracket($stage)->assertValidResponse(201);

    $entrants = bracketEntrants($stage);
    sort($entrants);
    expect($entrants)->toBe($seeds);

    $firstRound = bracketMatches($stage)->filter(fn (GameMatch $match): bool => $match->round->order === 1)
        ->flatMap(fn (GameMatch $match): array => [$match->home_team_id, $match->away_team_id]);
    $byes = array_values(array_diff($seeds, $firstRound->all()));
    expect($byes)->toBe(array_slice($seeds, 0, $size - $teams));
})->with('rozmiary drabinki');

// Niezmienniki 4 i 4a z #215: gdy zawsze wygrywa wyżej rozstawiony, w rundzie
// z m drużynami para ma postać s – (m + 1 − s), więc seedy 1…2^k spotykają
// się najwcześniej wtedy, gdy zostaje 2^k drużyn. Liczone na pełnej
// drabince: wolny los gra jak mecz z seedem spoza listy, więc w drugiej
// rundzie drużyna z wolnym losem stoi tam, gdzie postawiłby ją ten mecz.
it('rozstawia poziomami: przy wygranych wyżej rozstawionych para to s – (m + 1 − s)', function (int $teams) {
    $stage = cupWithTeams($teams);
    $seedOf = array_flip(seedsOf($stage));

    generateBracket($stage)->assertValidResponse(201);

    $size = 2 ** (int) ceil(log($teams, 2));
    $arriving = [];

    foreach (bracketMatches($stage) as $match) {
        $left = intdiv($size, 2 ** ($match->round->order - 1));
        $pair = array_map(
            fn (string $side): int => $match->{"{$side}_team_id"} !== null
                ? $seedOf[$match->{"{$side}_team_id"}] + 1
                : $arriving["{$match->id}.{$side}"],
            ['home', 'away'],
        );

        expect(array_sum($pair))->toBe($left + 1);

        if ($match->winner_to_match_id !== null) {
            $arriving["{$match->winner_to_match_id}.{$match->advances_to_slot}"] = min($pair);
        }
    }
})->with('rozmiary drabinki');

it('przy 32 drużynach zestawia w pierwszej rundzie każdego z seedów 1–16 z kimś z 17–32', function () {
    $stage = cupWithTeams(32);
    $seeds = seedsOf($stage);

    generateBracket($stage)->assertValidResponse(201);

    $firstRound = bracketMatches($stage)->filter(fn (GameMatch $match): bool => $match->round->order === 1);
    expect($firstRound)->toHaveCount(16);
    foreach ($firstRound as $match) {
        $pair = [array_search($match->home_team_id, $seeds, true) + 1, array_search($match->away_team_id, $seeds, true) + 1];
        expect(array_sum($pair))->toBe(33)
            ->and(max($pair))->toBeGreaterThan(16);
    }
});

// Niezmiennik 5 z #215 (część o generatorze), ADR-0004.
it('zapisuje krawędzie według ADR-0004', function (int $teams, bool $thirdPlaceMatch) {
    $stage = cupWithTeams($teams);

    generateBracket($stage, thirdPlaceMatch: $thirdPlaceMatch)->assertValidResponse(201);

    $matches = bracketMatches($stage);
    $fed = bracketFedSlots($matches);
    $byId = $matches->keyBy('id');

    foreach ($matches as $match) {
        $hasEdge = $match->winner_to_match_id !== null || $match->loser_to_match_id !== null;
        expect($match->advances_to_slot)->toBe($hasEdge ? ($match->match_number % 2 === 1 ? 'home' : 'away') : null);

        if ($match->winner_to_match_id !== null) {
            expect($byId[$match->winner_to_match_id]->round->order)->toBe($match->round->order + 1);
        }

        foreach (['home', 'away'] as $side) {
            $isFed = isset($fed["{$match->id}.{$side}"]);
            $hasTeam = $match->{"{$side}_team_id"} !== null;
            expect($isFed && $hasTeam)->toBeFalse();
            if ($match->round->order > 1) {
                expect($isFed || $hasTeam)->toBeTrue();
            }
        }
    }
})->with([
    'dwie drużyny' => [2, false],
    'pięć drużyn' => [5, false],
    'sześć drużyn z meczem o 3. miejsce' => [6, true],
    'siedemnaście drużyn z meczem o 3. miejsce' => [17, true],
]);

it('nie zapisuje krawędzi poza fazą knockout', function () {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(4)->for($tournament)->create();
    $stage = Stage::factory()->for($tournament)->create();

    actingAsOrganizer($tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/schedule", ['meetings' => 1])
        ->assertValidResponse(201);

    expect($stage->matches()->where(fn ($query) => $query
        ->whereNotNull('winner_to_match_id')
        ->orWhereNotNull('loser_to_match_id')
        ->orWhereNotNull('advances_to_slot'))->exists())->toBeFalse();
});

// Niezmiennik 6 z #215.
it('dokłada mecz o 3. miejsce w rundzie finału, z wejściem przegranego z każdego półfinału', function () {
    $stage = cupWithTeams(6);

    generateBracket($stage, thirdPlaceMatch: true)
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 3, 'matchesCount' => 6]);

    $final = $stage->rounds()->where('order', 3)->firstOrFail();
    $bronze = $final->matches()->where('match_number', 2)->firstOrFail();
    $semis = $stage->rounds()->where('order', 2)->firstOrFail()->matches()->orderBy('match_number')->get();

    expect($semis->pluck('loser_to_match_id')->all())->toBe([$bronze->id, $bronze->id])
        ->and($semis->pluck('advances_to_slot')->all())->toBe(['home', 'away'])
        ->and([$bronze->home_team_id, $bronze->away_team_id])->toBe([null, null])
        ->and($bronze->winner_to_match_id)->toBeNull()
        ->and($final->matches()->count())->toBe(2);
});

it('odmawia meczu o 3. miejsce przy trzech drużynach', function () {
    $stage = cupWithTeams(3);

    generateBracket($stage, thirdPlaceMatch: true)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['thirdPlaceMatch' => ['Mecz o 3. miejsce wymaga co najmniej czterech drużyn.']]);

    expect($stage->rounds()->exists())->toBeFalse();
});

// Niezmiennik 11 z #215.
it('nazywa rundy według rozmiaru drabinki', function (int $teams, array $names) {
    $stage = cupWithTeams($teams);

    generateBracket($stage)->assertValidResponse(201);

    expect($stage->rounds()->orderBy('order')->pluck('name')->all())->toBe($names);
})->with([
    'dwie drużyny' => [2, ['Finał']],
    'pięć drużyn' => [5, ['Ćwierćfinał', 'Półfinał', 'Finał']],
    'siedemnaście drużyn' => [17, ['1/16 finału', '1/8 finału', 'Ćwierćfinał', 'Półfinał', 'Finał']],
]);

it('stawia drużyny według rozstawienia z żądania, a nie według id', function () {
    $stage = cupWithTeams(4);
    [$a, $b, $c, $d] = seedsOf($stage);

    generateBracket($stage, [$d, $c, $b, $a])->assertValidResponse(201);

    // Drabinka na 4: pozycje 1–4 i 2–3.
    $pairs = bracketMatches($stage)->filter(fn (GameMatch $match): bool => $match->round->order === 1)
        ->map(fn (GameMatch $match): array => [$match->home_team_id, $match->away_team_id])->values()->all();
    expect($pairs)->toBe([[$d, $a], [$c, $b]]);
});

// Niezmiennik 7 z #215.
it('odrzuca listę, która nie jest zbiorem drużyn turnieju, i nie rusza drabinki', function (Closure $list) {
    $stage = cupWithTeams(4);
    generateBracket($stage)->assertValidResponse(201);
    $before = bracketMatches($stage)->toArray();

    actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/bracket", ['teamIds' => $list($stage), 'thirdPlaceMatch' => false])
        ->assertStatus(422)
        ->assertJsonPath('errors', ['teamIds' => ['Lista musi zawierać każdą drużynę turnieju dokładnie raz.']]);

    expect(bracketMatches($stage)->toArray())->toBe($before);
})->with([
    'brakująca' => fn () => fn (Stage $stage): array => array_slice(seedsOf($stage), 1),
    'obca' => fn () => fn (Stage $stage): array => [...seedsOf($stage), Team::factory()->create()->id],
    'usunięta' => fn () => function (Stage $stage): array {
        $removed = Team::factory()->for($stage->tournament)->create();
        $removed->delete();

        return [...seedsOf($stage), $removed->id];
    },
    'powtórzona' => fn () => fn (Stage $stage): array => [...array_slice(seedsOf($stage), 1), seedsOf($stage)[1]],
    'napisy zamiast liczb' => fn () => fn (Stage $stage): array => array_map(strval(...), seedsOf($stage)),
    'pusta' => fn () => fn (Stage $stage): array => [],
]);

// Niezmiennik 8 z #215.
it('przy meczu rozpoczętym odmawia z 422 i niczego nie zmienia', function (string $status) {
    $stage = cupWithTeams(4);
    generateBracket($stage)->assertValidResponse(201);
    $stage->matches()->orderBy('id')->first()->update(match ($status) {
        'live' => ['status' => 'live', 'home_score' => 1, 'away_score' => 0],
        'finished' => ['status' => 'finished', 'home_score' => 2, 'away_score' => 1],
    });
    $before = bracketMatches($stage)->toArray();

    generateBracket($stage)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Faza ma rozegrane mecze, więc nie można wygenerować drabinki ponownie.']]);

    expect(bracketMatches($stage)->toArray())->toBe($before);
})->with(['live', 'finished']);

it('zastępuje całą poprzednią drabinkę fazy, razem z terminami i obiektami', function () {
    $stage = cupWithTeams(6);
    generateBracket($stage, thirdPlaceMatch: true)->assertValidResponse(201);
    $oldRoundIds = $stage->rounds()->pluck('id');
    $oldMatchIds = $stage->matches()->pluck('id');
    $stage->matches()->first()->update([
        'kickoff_at' => '2026-10-04 10:00:00',
        'venue_id' => Venue::factory()->for($stage->tournament)->create()->id,
    ]);

    generateBracket($stage)
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 3, 'matchesCount' => 5]);

    expect(GameMatch::whereIn('id', $oldMatchIds)->exists())->toBeFalse()
        ->and(Round::whereIn('id', $oldRoundIds)->exists())->toBeFalse()
        ->and($stage->matches()->where(fn ($query) => $query->whereNotNull('kickoff_at')->orWhereNotNull('venue_id'))->exists())->toBeFalse();
});

// Kasowanie pustej drabinki zakładało blokadę szczeliny na końcu `rounds`
// i dwa pierwsze generowania w różnych turniejach kończyły się deadlockiem.
it('przy pierwszym generowaniu nie blokuje kolejek innych faz', function () {
    generateBracket(cupWithTeams(4))->assertValidResponse(201);

    expect(anotherConnectionCanAppendRound())->toBeTrue();
});

// Deadlock przy regeneracji zostaje i ponawia go transakcja. Cztery nieudane
// próby z pięciu — liczba z docblocku `ScheduleGenerator::generate()`.
it('po deadlocku przy regeneracji ponawia transakcję i układa jedną drabinkę', function () {
    outsideTestTransaction(function () {
        $stage = cupWithTeams(6);
        generateBracket($stage)->assertValidResponse(201);
        failWithDeadlock('insert into `matches`', 4);

        generateBracket($stage, thirdPlaceMatch: true)
            ->assertValidResponse(201)
            ->assertJsonPath('data', ['roundsCount' => 3, 'matchesCount' => 6]);

        expect($stage->rounds()->count())->toBe(3)
            ->and($stage->matches()->count())->toBe(6);
    });
});

// Lista z jedną drużyną albo pusta łamie `minItems` w kontrakcie, więc bez
// `assertValidRequest`; odpowiedź ma mówić o liczbie drużyn, a nie o liście.
it('odmawia z 422 pod teams, gdy turniej ma mniej niż dwie drużyny', function (int $teams) {
    $stage = cupWithTeams($teams);

    generateBracket($stage)
        ->assertStatus(422)
        ->assertJsonPath('errors', ['teams' => ['Puchar potrzebuje co najmniej dwóch drużyn.']]);

    expect($stage->rounds()->exists())->toBeFalse();
})->with(['bez drużyn' => 0, 'jedna drużyna' => 1]);

it('odmawia z 422 dla fazy innej niż knockout', function (string $type) {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(4)->for($tournament)->create();
    $stage = Stage::factory()->for($tournament)->create(['type' => $type]);

    generateBracket($stage)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Drabinkę generuje się tylko w fazie pucharowej.']]);

    expect($stage->rounds()->exists())->toBeFalse();
})->with(['league', 'group']);

// Status turnieju nie gra roli (opis trasy w kontrakcie).
it('generuje w turnieju w każdym statusie', function (string $status) {
    generateBracket(cupWithTeams(3, $status))
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 2, 'matchesCount' => 2]);
})->with(Tournament::STATUSES);

it('wymaga thirdPlaceMatch jako wartości logicznej', function (mixed $thirdPlaceMatch) {
    $stage = cupWithTeams(4);

    generateBracket($stage, thirdPlaceMatch: $thirdPlaceMatch)
        ->assertStatus(422)
        ->assertJsonPath('errors', ['thirdPlaceMatch' => ['Wybierz, czy dołożyć mecz o 3. miejsce.']]);

    expect($stage->rounds()->exists())->toBeFalse();
})->with(['brak' => null, 'liczba' => 1, 'napis' => 'true']);

/**
 * Kształt drabinki bez id: runda, numer, drużyny jako seedy i krawędzie
 * wskazane pozycją meczu docelowego. Pozwala porównać odpowiedź API
 * z przykładem z kontraktu, który ma własne id.
 *
 * @param  list<array<string, mixed>>  $matches  mecze w kształcie z kontraktu
 * @param  callable(?int): ?int  $seed  seed drużyny o danym id
 * @return list<array<string, mixed>>
 */
function bracketShape(array $matches, callable $seed): array
{
    $position = [];
    foreach ($matches as $match) {
        $position[$match['id']] = "{$match['round']['name']} {$match['matchNumber']}";
    }

    return collect($matches)
        ->sortBy(fn (array $match): array => [$match['round']['order'], $match['matchNumber']])
        ->map(fn (array $match): array => [
            'round' => $match['round']['name'],
            'matchNumber' => $match['matchNumber'],
            'home' => $seed($match['homeTeam']['id'] ?? null),
            'away' => $seed($match['awayTeam']['id'] ?? null),
            'winnerTo' => $position[$match['winnerToMatchId']] ?? null,
            'loserTo' => $position[$match['loserToMatchId']] ?? null,
            'slot' => $match['advancesToSlot'],
        ])
        ->values()->all();
}

// Przykłady `puchar` (panel i strona publiczna) mają spełniać te same
// niezmienniki co generator (#227, DoD „Kontrakt”), więc test porównuje ich
// kształt z drabinką, którą generator układa dla sześciu drużyn z meczem
// o 3. miejsce; w przykładzie seedy 1–6 to drużyny o id 1–6. Przykład jest
// w trakcie gry, a awans po wyniku (#228) obsadza sloty zasilane krawędzią.
// Generator zostawia je puste, więc z przykładu wypadają drużyny z tych
// slotów, a reszta kształtu ma się zgadzać co do pola.
it('ma przykłady puchar w kształcie drabinki z generatora', function (string $path) {
    $stage = cupWithTeams(6);
    $seeds = seedsOf($stage);
    generateBracket($stage, thirdPlaceMatch: true)->assertValidResponse(201);

    $generated = actingAsOrganizer($stage->tournament->user)
        ->getJson("/api/v1/tournaments/{$stage->tournament_id}/matches?stageId={$stage->id}")
        ->assertOk()
        ->json('data');

    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $example = $spec['paths'][$path]['get']['responses']['200']['content']['application/json']['examples']['puchar']['value']['data'];

    $fed = [];
    foreach ($example as $match) {
        foreach ([$match['winnerToMatchId'], $match['loserToMatchId']] as $target) {
            if ($target !== null) {
                $fed["{$target}.{$match['advancesToSlot']}"] = true;
            }
        }
    }
    $beforeAdvancing = array_map(function (array $match) use ($fed): array {
        foreach (['home', 'away'] as $side) {
            if (isset($fed["{$match['id']}.{$side}"])) {
                $match["{$side}Team"] = null;
            }
        }

        return $match;
    }, $example);

    $generatedSeed = fn (?int $id): ?int => $id === null ? null : array_search($id, $seeds, true) + 1;

    expect(bracketShape($beforeAdvancing, fn (?int $id): ?int => $id))->toBe(bracketShape($generated, $generatedSeed));
})->with(['panel' => '/tournaments/{tournament}/matches', 'strona publiczna' => '/public/t/{slug}/matches']);
