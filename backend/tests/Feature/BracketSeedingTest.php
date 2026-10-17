<?php

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Schedule\BracketGenerator;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Rozstawienie drabinki playoffu z tabel grup (#260)
|--------------------------------------------------------------------------
|
| Niezmienniki 1–10 z wkładu #250 w #251: propozycja
| `GET /stages/{stage}/bracket/seeding` i walidacja `POST /stages/{stage}/bracket`
| w turnieju z fazą `group`. Niezmiennik 8 (`PATCH /groups/{group}` po starcie
| playoffu) pilnuje `UpdateGroupQualifiersTest`, a niezmiennik 10 (sam puchar)
| — „odrzuca listę, która nie jest zbiorem drużyn turnieju” w
| `GenerateBracketTest`. 401, 403 i 404 nowej trasy pilnuje
| `SubtreeAuthorizationTest`. Funkcje lądują w globalnej przestrzeni nazw
| Pesta, stąd prefiks `seeding`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** Litera grupy po jej `order`: A, B, … */
function seedingLetter(int $order): string
{
    return chr(ord('A') + $order - 1);
}

/**
 * Turniej grupy + playoff: faza `group` z grupami w kolejności tablicy i pusta
 * faza `knockout`. Drużyny grupy nazywają się „{litera} {n}”, więc bez meczów
 * tabela grupy idzie w kolejności `n` (ostatnie kryterium to nazwa).
 *
 * @param  list<int>  $qualifiers  liczba wychodzących z kolejnych grup
 * @param  int|null  $teamsPerGroup  domyślnie o jedną więcej niż wychodzi
 * @return Stage faza `knockout`
 */
function seedingPlayoff(array $qualifiers, ?int $teamsPerGroup = null): Stage
{
    $tournament = Tournament::factory()->create(['status' => 'active']);
    $groupStage = Stage::factory()->group()->for($tournament)->create(['order' => 1]);
    Round::factory()->for($groupStage)->create();

    foreach ($qualifiers as $index => $count) {
        $letter = count($qualifiers) <= 26 ? seedingLetter($index + 1) : 'G'.($index + 1);
        $group = Group::factory()->for($groupStage)->create([
            'name' => "Grupa {$letter}",
            'order' => $index + 1,
            'qualifiers' => $count,
        ]);

        foreach (range(1, $teamsPerGroup ?? $count + 1) as $n) {
            Team::factory()->for($tournament)->create(['name' => "{$letter} {$n}", 'group_id' => $group->id]);
        }
    }

    return Stage::factory()->knockout()->for($tournament)->create(['order' => 2]);
}

function seedingOf(Stage $stage): TestResponse
{
    return actingAsOrganizer($stage->tournament->user)
        ->getJson("/api/v1/stages/{$stage->id}/bracket/seeding");
}

/** @param  list<int>  $teamIds */
function seedingGenerate(Stage $stage, array $teamIds): TestResponse
{
    return actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/bracket", ['teamIds' => $teamIds, 'thirdPlaceMatch' => false]);
}

/** Wspólna kolejka fazy grupowej turnieju fazy `knockout`. */
function seedingGroupRound(Stage $stage): Round
{
    return Round::query()->whereIn('stage_id', $stage->tournament->stages()->where('type', 'group')->pluck('id'))->firstOrFail();
}

/** Drużyna turnieju fazy po nazwie. */
function seedingTeam(Stage $stage, string $name): Team
{
    return $stage->tournament->teams()->where('name', $name)->firstOrFail();
}

/**
 * Etykiety pochodzenia propozycji („1A”) w kolejności rozstawienia.
 *
 * @param  list<array{teamId: int, groupId: int, position: int}>  $seeding
 * @return list<string>
 */
function seedingLabels(array $seeding): array
{
    $orders = Group::query()->whereIn('id', array_column($seeding, 'groupId'))->pluck('order', 'id');

    return array_map(fn (array $seed): string => $seed['position'].seedingLetter($orders[$seed['groupId']]), $seeding);
}

/**
 * Pary 1. rundy w kolejności slotów, jak w tabeli wyników z #250: „1A–2B”,
 * a „wolny los” zamiast rywala spoza listy. Pozycje z generatora.
 *
 * @param  list<string>  $labels  etykiety w kolejności rozstawienia
 * @return list<string>
 */
function seedingFirstRound(array $labels): array
{
    $size = 2;
    while ($size < count($labels)) {
        $size *= 2;
    }

    $slots = array_map(fn (int $seed): string => $labels[$seed - 1] ?? 'wolny los', BracketGenerator::seedPositions($size));

    return array_map(fn (array $pair): string => implode('–', $pair), array_chunk($slots, 2));
}

/**
 * Mecze fazy `knockout` jako id i drużyny, do porównań „przed/po”.
 *
 * @return list<array{id: int, home_team_id: ?int, away_team_id: ?int}>
 */
function seedingBracket(Stage $stage): array
{
    return $stage->matches()->orderBy('id')->get(['id', 'home_team_id', 'away_team_id'])->toArray();
}

// Niezmiennik 1.
it('oddaje qualifiers czołowych drużyn każdej grupy z miejscem w bieżącej tabeli', function () {
    $stage = seedingPlayoff([2, 1], teamsPerGroup: 3);
    // „A 3” wygrywa jedyny mecz grupy A, więc jest pierwsza, a „A 1” — druga.
    GameMatch::factory()->for(seedingGroupRound($stage))->finished(2, 0)->create([
        'group_id' => seedingTeam($stage, 'A 3')->group_id,
        'home_team_id' => seedingTeam($stage, 'A 3')->id,
        'away_team_id' => seedingTeam($stage, 'A 2')->id,
    ]);

    $response = seedingOf($stage)->assertValidRequest()->assertValidResponse(200);

    $groupA = seedingTeam($stage, 'A 1')->group_id;
    $groupB = seedingTeam($stage, 'B 1')->group_id;
    expect($response->json('data'))->toBe([
        ['teamId' => seedingTeam($stage, 'A 3')->id, 'groupId' => $groupA, 'position' => 1],
        ['teamId' => seedingTeam($stage, 'B 1')->id, 'groupId' => $groupB, 'position' => 1],
        ['teamId' => seedingTeam($stage, 'A 1')->id, 'groupId' => $groupA, 'position' => 2],
    ]);
});

// Niezmiennik 3 na tabeli innej niż kolejność nazw: przy jednej grupie
// propozycja to po prostu kolejność bieżącej tabeli.
it('przy jednej grupie oddaje kolejność bieżącej tabeli', function () {
    $stage = seedingPlayoff([3], teamsPerGroup: 4);
    // „A 4” wygrywa z „A 1”, więc tabela to A 4, A 2, A 3, A 1.
    GameMatch::factory()->for(seedingGroupRound($stage))->finished(1, 0)->create([
        'group_id' => seedingTeam($stage, 'A 4')->group_id,
        'home_team_id' => seedingTeam($stage, 'A 4')->id,
        'away_team_id' => seedingTeam($stage, 'A 1')->id,
    ]);

    $seeding = seedingOf($stage)->assertValidResponse(200)->json('data');

    expect(array_column($seeding, 'teamId'))->toBe([
        seedingTeam($stage, 'A 4')->id,
        seedingTeam($stage, 'A 2')->id,
        seedingTeam($stage, 'A 3')->id,
    ])->and(array_column($seeding, 'position'))->toBe([1, 2, 3]);
});

// Niezmienniki 2, 3 i 4: wyniki z tabeli we wkładzie #250, odtworzone
// skryptem odniesienia.
it('układa propozycję według reguły z #250', function (array $qualifiers, array $order, array $firstRound) {
    $stage = seedingPlayoff($qualifiers);

    $seeding = seedingOf($stage)->assertValidResponse(200)->json('data');
    $labels = seedingLabels($seeding);

    expect($labels)->toBe($order)
        ->and(seedingFirstRound($labels))->toBe($firstRound);

    $positions = array_column($seeding, 'position');
    $sorted = $positions;
    sort($sorted);
    expect($positions)->toBe($sorted);

    // Poza jedną grupą żadna para 1. rundy nie łączy drużyn z jednej grupy.
    if (count($qualifiers) > 1) {
        foreach (seedingFirstRound($labels) as $pair) {
            $groups = array_map(fn (string $label): string => substr($label, -1), explode('–', $pair));
            expect($groups[0])->not->toBe($groups[1]);
        }
    }
})->with([
    '2, 2' => [[2, 2], ['1A', '1B', '2A', '2B'], ['1A–2B', '1B–2A']],
    '2, 2, 2' => [[2, 2, 2], ['1A', '1B', '1C', '2C', '2B', '2A'], ['1A–wolny los', '2C–2B', '1B–wolny los', '1C–2A']],
    '2, 2, 2, 2' => [[2, 2, 2, 2], ['1A', '1B', '1C', '1D', '2B', '2A', '2D', '2C'], ['1A–2C', '1D–2B', '1B–2D', '1C–2A']],
    '3, 3, 2' => [[3, 3, 2], ['1A', '1B', '1C', '2A', '2C', '2B', '3A', '3B'], ['1A–3B', '2A–2C', '1B–3A', '1C–2B']],
    '3, 2, 2, 1' => [[3, 2, 2, 1], ['1C', '1D', '1A', '1B', '2A', '2B', '2C', '3A'], ['1C–3A', '1B–2A', '1D–2C', '1A–2B']],
    '4 (jedna grupa)' => [[4], ['1A', '2A', '3A', '4A'], ['1A–4A', '2A–3A']],
    '8 × 2' => [
        array_fill(0, 8, 2),
        ['1A', '1B', '1C', '1D', '1E', '1F', '1G', '1H', '2B', '2A', '2D', '2C', '2F', '2E', '2H', '2G'],
        ['1A–2G', '1H–2B', '1D–2F', '1E–2C', '1B–2H', '1G–2A', '1C–2E', '1F–2D'],
    ],
]);

// Niezmiennik 4, część o połówkach.
it('stawia obie drużyny każdej grupy na przeciwnych połówkach drabinki', function (array $qualifiers) {
    $stage = seedingPlayoff($qualifiers);
    $seeding = seedingOf($stage)->assertValidResponse(200)->json('data');

    $size = 2;
    while ($size < count($seeding)) {
        $size *= 2;
    }
    $halfOf = [];
    foreach (BracketGenerator::seedPositions($size) as $slot => $seed) {
        if ($seed <= count($seeding)) {
            $halfOf[$seed - 1] = intdiv($slot, $size / 2);
        }
    }

    $halves = [];
    foreach ($seeding as $index => $seed) {
        $halves[$seed['groupId']][] = $halfOf[$index];
    }
    foreach ($halves as $groupHalves) {
        sort($groupHalves);
        expect($groupHalves)->toBe([0, 1]);
    }
})->with(['2, 2, 2' => [[2, 2, 2]], '2, 2, 2, 2' => [[2, 2, 2, 2]]]);

// Niezmiennik 5.
it('przy tych samych tabelach oddaje dwa razy tę samą listę', function () {
    $stage = seedingPlayoff([3, 2, 2, 1]);

    expect(seedingOf($stage)->assertOk()->json('data'))->toBe(seedingOf($stage)->assertOk()->json('data'));
});

it('pomija drużynę bez grupy, dodaną po zapisie składu', function () {
    $stage = seedingPlayoff([2, 2]);
    $late = Team::factory()->for($stage->tournament)->create(['group_id' => null]);

    $seeding = seedingOf($stage)->assertValidResponse(200)->json('data');

    expect($seeding)->toHaveCount(4)
        ->and(array_column($seeding, 'teamId'))->not->toContain($late->id);
});

// `MAX_TEAMS` = 128: wszystkie drużyny turnieju wychodzą z grup.
it('liczy propozycję i drabinkę dla 128 drużyn', function (array $qualifiers, int $teamsPerGroup) {
    $stage = seedingPlayoff($qualifiers, $teamsPerGroup);

    $seeding = seedingOf($stage)->assertValidResponse(200)->json('data');

    expect($seeding)->toHaveCount(Tournament::MAX_TEAMS);
    foreach (seedingFirstRound(seedingLabels($seeding)) as $pair) {
        [$home, $away] = explode('–', $pair);
        expect(substr($home, -1))->not->toBe(substr($away, -1));
    }

    seedingGenerate($stage, array_column($seeding, 'teamId'))
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 7, 'matchesCount' => 127]);
})->with([
    '16 grup po 8' => [array_fill(0, 16, 8), 8],
    '4 grupy po 32' => [array_fill(0, 4, 32), 32],
]);

// Niezmiennik 6.
it('generuje drabinkę z podmianą 3. miejsca na 2. z tej samej grupy', function () {
    $stage = seedingPlayoff([2, 2], teamsPerGroup: 3);
    $teamIds = array_column(seedingOf($stage)->json('data'), 'teamId');
    $swapped = array_map(fn (int $id): int => $id === seedingTeam($stage, 'A 2')->id ? seedingTeam($stage, 'A 3')->id : $id, $teamIds);

    seedingGenerate($stage, $swapped)
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data', ['roundsCount' => 2, 'matchesCount' => 3]);

    $inBracket = $stage->matches()->get()->flatMap(fn (GameMatch $match): array => [$match->home_team_id, $match->away_team_id])->filter()->all();
    expect($inBracket)->toContain(seedingTeam($stage, 'A 3')->id)
        ->not->toContain(seedingTeam($stage, 'A 2')->id);
});

// Niezmiennik 6, część o odmowie.
it('odrzuca listę bez qualifiers drużyn z każdej grupy i nie rusza drabinki', function (Closure $list) {
    $stage = seedingPlayoff([2, 2], teamsPerGroup: 3);
    $teamIds = array_column(seedingOf($stage)->json('data'), 'teamId');
    seedingGenerate($stage, $teamIds)->assertValidResponse(201);
    $before = seedingBracket($stage);

    seedingGenerate($stage, $list($stage, $teamIds))
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['teamIds' => ['Lista musi zawierać tyle drużyn z każdej grupy, ile z niej wychodzi.']]);

    expect(seedingBracket($stage))->toBe($before);
})->with([
    'brakująca' => fn (Stage $stage, array $ids): array => array_slice($ids, 1),
    'nadmiar z grupy' => fn (Stage $stage, array $ids): array => [...$ids, seedingTeam($stage, 'A 3')->id],
    'dwie z jednej, jedna z drugiej' => fn (Stage $stage, array $ids): array => array_map(
        fn (int $id): int => $id === seedingTeam($stage, 'B 2')->id ? seedingTeam($stage, 'A 3')->id : $id,
        $ids,
    ),
    'powtórzona' => fn (Stage $stage, array $ids): array => [...array_slice($ids, 0, 3), $ids[0]],
    'drużyna bez grupy' => fn (Stage $stage, array $ids): array => [
        ...array_slice($ids, 0, 3),
        Team::factory()->for($stage->tournament)->create(['group_id' => null])->id,
    ],
    'obca' => fn (Stage $stage, array $ids): array => [...array_slice($ids, 0, 3), Team::factory()->create()->id],
    'cały turniej' => fn (Stage $stage, array $ids): array => $stage->tournament->teams()->pluck('id')->all(),
]);

// Niezmiennik 7.
it('poprawka wyniku meczu grupy po wygenerowaniu drabinki zostawia mecze playoffu', function () {
    $stage = seedingPlayoff([1, 1]);
    $match = GameMatch::factory()->for(seedingGroupRound($stage))->finished(2, 0)->create([
        'group_id' => seedingTeam($stage, 'A 1')->group_id,
        'home_team_id' => seedingTeam($stage, 'A 1')->id,
        'away_team_id' => seedingTeam($stage, 'A 2')->id,
    ]);
    seedingGenerate($stage, array_column(seedingOf($stage)->json('data'), 'teamId'))->assertValidResponse(201);
    $before = seedingBracket($stage);

    actingAsOrganizer($stage->tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['status' => 'finished', 'homeScore' => 0, 'awayScore' => 3])
        ->assertOk();

    // Tabela się odwróciła, a drabinka nie.
    expect(seedingOf($stage)->json('data.0.teamId'))->toBe(seedingTeam($stage, 'A 2')->id)
        ->and(seedingBracket($stage))->toBe($before);
});

// Niezmiennik 9.
it('odmawia pod groups, gdy grupa ma mniej drużyn, niż z niej wychodzi', function () {
    $stage = seedingPlayoff([2, 2], teamsPerGroup: 2);
    $teamIds = array_column(seedingOf($stage)->json('data'), 'teamId');
    seedingTeam($stage, 'B 2')->delete();
    $message = ['groups' => ['Grupa „Grupa B” ma mniej drużyn, niż z niej wychodzi.']];

    seedingOf($stage)->assertValidResponse(422)->assertJsonPath('errors', $message);
    seedingGenerate($stage, array_slice($teamIds, 0, 3))->assertValidResponse(422)->assertJsonPath('errors', $message);

    expect($stage->rounds()->exists())->toBeFalse();
});

it('odmawia pod stage, gdy faza grupowa nie ma składu', function () {
    $tournament = Tournament::factory()->create();
    $teams = Team::factory()->count(4)->for($tournament)->create();
    Stage::factory()->group()->for($tournament)->create(['order' => 1]);
    $stage = Stage::factory()->knockout()->for($tournament)->create(['order' => 2]);
    $message = ['stage' => ['Najpierw ustal skład grup.']];

    seedingOf($stage)->assertValidResponse(422)->assertJsonPath('errors', $message);
    seedingGenerate($stage, $teams->pluck('id')->all())->assertValidResponse(422)->assertJsonPath('errors', $message);

    expect($stage->rounds()->exists())->toBeFalse();
});

it('odmawia propozycji w samym pucharze', function () {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(4)->for($tournament)->create();
    $stage = Stage::factory()->knockout()->for($tournament)->create();

    seedingOf($stage)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Propozycja rozstawienia z grup jest tylko w turnieju z fazą grupową.']]);
});

it('odmawia propozycji dla fazy innej niż knockout', function () {
    $stage = seedingPlayoff([2, 2]);
    $groupStage = $stage->tournament->stages()->where('type', 'group')->firstOrFail();

    seedingOf($groupStage)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Drabinkę generuje się tylko w fazie pucharowej.']]);
});
