<?php

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

/**
 * Faza `group` w turnieju z `$count` drużynami. Skład grup układa sam test —
 * to jest przedmiot tego pliku, więc nie ma tu jednego gotowego kształtu.
 *
 * @return array{Stage, Collection<int, Team>}
 */
function groupStageWithTeams(int $count, string $status = 'draft'): array
{
    $tournament = Tournament::factory()->create(['status' => $status]);
    $teams = Team::factory()->count($count)->for($tournament)->create();
    $stage = Stage::factory()->group()->for($tournament)->create();

    return [$stage, $teams];
}

/**
 * @param  list<array{name: string, teamIds: list<int>, qualifiers: int}>  $groups
 */
function putGroups(Stage $stage, array $groups): TestResponse
{
    return actingAsOrganizer($stage->tournament->user)
        ->putJson("/api/v1/stages/{$stage->id}/groups", ['groups' => $groups]);
}

// Niezmiennik 1 z wkładu #249 (#258).
it('zapisuje cały skład grup: order z kolejności ciała i group_id każdej drużyny', function () {
    [$stage, $teams] = groupStageWithTeams(6);
    $ids = $teams->pluck('id')->all();

    putGroups($stage, [
        ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1], $ids[2]], 'qualifiers' => 2],
        ['name' => 'Grupa B', 'teamIds' => [$ids[3], $ids[4], $ids[5]], 'qualifiers' => 1],
    ])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.id', $stage->id)
        ->assertJsonPath('data.type', 'group');

    $saved = $stage->groups()->orderBy('order')->get();
    expect($saved->pluck('name')->all())->toBe(['Grupa A', 'Grupa B'])
        ->and($saved->pluck('order')->all())->toBe([1, 2])
        ->and($saved->pluck('qualifiers')->all())->toBe([2, 1]);

    $byName = $saved->keyBy('name');
    expect($teams[0]->fresh()->group_id)->toBe($byName['Grupa A']->id)
        ->and($teams[2]->fresh()->group_id)->toBe($byName['Grupa A']->id)
        ->and($teams[3]->fresh()->group_id)->toBe($byName['Grupa B']->id)
        ->and($teams[5]->fresh()->group_id)->toBe($byName['Grupa B']->id);
});

it('nadaje order z kolejności grup w ciele, a nie z nazwy', function () {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();

    putGroups($stage, [
        ['name' => 'Grupa B', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 2],
        ['name' => 'Grupa A', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 1],
    ])
        ->assertValidResponse(200)
        ->assertJsonPath('data.groups.0', ['id' => $stage->groups()->where('name', 'Grupa B')->value('id'), 'name' => 'Grupa B', 'order' => 1, 'qualifiers' => 2]);

    expect($stage->groups()->orderBy('order')->pluck('name')->all())->toBe(['Grupa B', 'Grupa A']);
});

it('zastępuje poprzedni skład, nie dokłada nowych grup', function () {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();

    putGroups($stage, [
        ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 1],
        ['name' => 'Grupa B', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 1],
    ])->assertValidResponse(200);
    $old = $stage->groups()->pluck('id');

    putGroups($stage, [
        ['name' => 'Jedyna', 'teamIds' => $ids, 'qualifiers' => 2],
    ])->assertValidResponse(200);

    expect($stage->groups()->pluck('name')->all())->toBe(['Jedyna'])
        ->and(Group::whereIn('id', $old)->exists())->toBeFalse();
});

// Niezmiennik 2 z wkładu #249 (#258).
it('kasuje terminarz fazy grupowej, a fazy pucharowej nie rusza', function () {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();
    $composition = [
        ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 2],
        ['name' => 'Grupa B', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 2],
    ];

    putGroups($stage, $composition)->assertValidResponse(200);
    actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/schedule", ['meetings' => 1])
        ->assertValidResponse(201);

    $knockout = Stage::factory()->knockout()->for($stage->tournament)->create(['order' => 2]);
    $knockoutMatch = GameMatch::factory()->create([
        'round_id' => Round::factory()->for($knockout)->create()->id,
        'home_team_id' => $ids[0],
        'away_team_id' => $ids[1],
    ]);

    $oldRounds = $stage->rounds()->pluck('id')->all();
    expect($oldRounds)->not->toBeEmpty();

    putGroups($stage, $composition)->assertValidResponse(200);

    expect(Round::whereIn('id', $oldRounds)->exists())->toBeFalse()
        ->and($stage->matches()->exists())->toBeFalse()
        ->and($knockoutMatch->fresh())->not->toBeNull()
        ->and($knockout->rounds()->exists())->toBeTrue();
});

// Niezmiennik 3 z wkładu #249 (#258).
it('po meczu rozpoczętym odmawia z 422 i nie rusza składu', function (string $status) {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();

    putGroups($stage, [
        ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 2],
        ['name' => 'Grupa B', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 2],
    ])->assertValidResponse(200);

    actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/schedule", ['meetings' => 1])
        ->assertValidResponse(201);

    $stage->matches()->orderBy('id')->first()->update(match ($status) {
        'live' => ['status' => 'live', 'home_score' => 1, 'away_score' => 0],
        'finished' => ['status' => 'finished', 'home_score' => 2, 'away_score' => 1],
    });

    $beforeGroups = $stage->groups()->orderBy('order')->get()->toArray();
    $beforeTeams = $teams->map(fn (Team $team): ?int => $team->fresh()->group_id)->all();

    putGroups($stage, [
        ['name' => 'Inna', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 1],
        ['name' => 'Nowa', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 1],
    ])
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Faza ma rozegrane mecze, więc skład grup jest zamrożony.']]);

    expect($stage->groups()->orderBy('order')->get()->toArray())->toBe($beforeGroups)
        ->and($teams->map(fn (Team $team): ?int => $team->fresh()->group_id)->all())->toBe($beforeTeams);
})->with(['live', 'finished']);

it('odmawia z 422 dla fazy innej niż grupowa', function (string $state) {
    $tournament = Tournament::factory()->create();
    Team::factory()->count(4)->for($tournament)->create();
    $stage = $state === 'knockout'
        ? Stage::factory()->knockout()->for($tournament)->create()
        : Stage::factory()->for($tournament)->create();

    putGroups($stage, [['name' => 'Grupa A', 'teamIds' => [1, 2], 'qualifiers' => 1]])
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['stage' => ['Skład grup ustala się tylko w fazie grupowej.']]);

    expect($stage->groups()->exists())->toBeFalse();
})->with(['league', 'knockout']);

it('odmawia z 422, gdy lista grup jest pusta', function () {
    [$stage] = groupStageWithTeams(4);

    putGroups($stage, [])
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['groups' => ['Faza grupowa potrzebuje co najmniej jednej grupy.']]);

    expect($stage->groups()->exists())->toBeFalse();
});

it('odmawia z 422, gdy skład nie zawiera każdej drużyny dokładnie raz', function (string $case) {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();
    $foreign = Team::factory()->create()->id;

    $groups = match ($case) {
        // Powtórzona drużyna w drugiej grupie, a czwarta wypadła.
        'powtórzona' => [
            ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 1],
            ['name' => 'Grupa B', 'teamIds' => [$ids[1], $ids[2]], 'qualifiers' => 1],
        ],
        // Drużyna spoza turnieju.
        'obca' => [
            ['name' => 'Grupa A', 'teamIds' => [$ids[0], $foreign], 'qualifiers' => 1],
            ['name' => 'Grupa B', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 1],
        ],
        // Drużyna turnieju w ogóle nie trafiła do składu.
        'brakująca' => [
            ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 1],
        ],
    };

    putGroups($stage, $groups)
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['groups' => ['Skład musi zawierać każdą drużynę turnieju dokładnie raz.']]);

    expect($stage->groups()->exists())->toBeFalse();
})->with(['powtórzona', 'obca', 'brakująca']);

it('odmawia z 422, gdy nazwy grup się powtarzają', function () {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();

    putGroups($stage, [
        ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 1],
        ['name' => 'Grupa A', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 1],
    ])
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['groups.1.name' => ['Nazwy grup w fazie nie mogą się powtarzać.']]);
});

it('odmawia z 422, gdy grupa ma mniej niż dwie drużyny', function () {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();

    putGroups($stage, [
        ['name' => 'Grupa A', 'teamIds' => [$ids[0]], 'qualifiers' => 1],
        ['name' => 'Grupa B', 'teamIds' => [$ids[1], $ids[2], $ids[3]], 'qualifiers' => 1],
    ])
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['groups.0.teamIds' => ['Grupa potrzebuje co najmniej dwóch drużyn.']]);
});

it('odmawia z 422, gdy z grupy wychodzi więcej drużyn, niż w niej gra', function () {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();

    putGroups($stage, [
        ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => 3],
        ['name' => 'Grupa B', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 1],
    ])
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['groups.0.qualifiers' => ['Z grupy nie może wyjść więcej drużyn, niż w niej gra.']]);
});

it('odmawia z 422, gdy suma wychodzących jest mniejsza niż dwa', function () {
    [$stage, $teams] = groupStageWithTeams(4);

    putGroups($stage, [
        ['name' => 'Jedyna', 'teamIds' => $teams->pluck('id')->all(), 'qualifiers' => 1],
    ])
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['groups' => ['Z grup muszą wyjść co najmniej dwie drużyny.']]);
});

it('wymaga qualifiers jako liczby całkowitej co najmniej jeden', function (mixed $qualifiers) {
    [$stage, $teams] = groupStageWithTeams(4);
    $ids = $teams->pluck('id')->all();

    putGroups($stage, [
        ['name' => 'Grupa A', 'teamIds' => [$ids[0], $ids[1]], 'qualifiers' => $qualifiers],
        ['name' => 'Grupa B', 'teamIds' => [$ids[2], $ids[3]], 'qualifiers' => 1],
    ])
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor('groups.0.qualifiers');

    expect($stage->groups()->exists())->toBeFalse();
})->with(['brak' => null, 'zero' => 0, 'napis' => '2', 'logiczna' => true]);
