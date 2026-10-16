<?php

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

/**
 * Faza grupowa z grupami po `$teamsPerGroup` drużyn i podanymi `qualifiers`,
 * w kolejności tablicy.
 *
 * @param  list<int>  $qualifiers
 * @return list<Group>
 */
function qualifiersGroups(array $qualifiers, int $teamsPerGroup = 3): array
{
    $tournament = Tournament::factory()->create(['status' => 'active']);
    $stage = Stage::factory()->group()->for($tournament)->create();

    $groups = [];
    foreach ($qualifiers as $index => $count) {
        $group = Group::factory()->for($stage)->create([
            'name' => 'Grupa '.chr(ord('A') + $index),
            'order' => $index + 1,
            'qualifiers' => $count,
        ]);
        Team::factory()->count($teamsPerGroup)->for($tournament)->create(['group_id' => $group->id]);
        $groups[] = $group;
    }

    return $groups;
}

function patchQualifiers(Group $group, mixed $qualifiers): TestResponse
{
    return actingAsOrganizer($group->tournament->user)
        ->patchJson("/api/v1/groups/{$group->id}", ['qualifiers' => $qualifiers]);
}

/** Faza `knockout` turnieju grupy z jednym meczem w podanym statusie. */
function qualifiersKnockoutMatch(Group $group, string $status): GameMatch
{
    $stage = Stage::factory()->knockout()->for($group->tournament)->create(['order' => 2]);
    $factory = GameMatch::factory()->for(Round::factory()->for($stage));

    return ($status === 'scheduled' ? $factory : $factory->started($status))->create();
}

it('zmienia liczbę wychodzących z grupy i oddaje grupę', function () {
    [$group, $other] = qualifiersGroups([1, 1]);

    patchQualifiers($group, 3)
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertExactJson(['data' => ['id' => $group->id, 'name' => 'Grupa A', 'order' => 1, 'qualifiers' => 3]]);

    expect($group->fresh()->qualifiers)->toBe(3)
        ->and($other->fresh()->qualifiers)->toBe(1);
});

it('zmienia liczbę wychodzących po meczu rozpoczętym fazy grupowej, dopóki playoff nie gra', function () {
    [$group] = qualifiersGroups([2, 2]);
    GameMatch::factory()->finished()->for(Round::factory()->for($group->stage))->create(['group_id' => $group->id]);
    qualifiersKnockoutMatch($group, 'scheduled');

    patchQualifiers($group, 1)->assertValidResponse(200);

    expect($group->fresh()->qualifiers)->toBe(1);
});

it('odmawia, gdy faza pucharowa ma mecz rozpoczęty, i niczego nie zmienia', function (string $status) {
    [$group] = qualifiersGroups([2, 2]);
    qualifiersKnockoutMatch($group, $status);

    patchQualifiers($group, 1)
        ->assertValidResponse(422)
        ->assertExactJson([
            'message' => 'Faza pucharowa ma rozegrane mecze, więc liczby wychodzących z grup nie można zmienić.',
            'errors' => ['stage' => ['Faza pucharowa ma rozegrane mecze, więc liczby wychodzących z grup nie można zmienić.']],
        ]);

    expect($group->fresh()->qualifiers)->toBe(2);
})->with(['live', 'finished']);

it('odmawia wyjścia większego niż liczba żywych drużyn grupy', function () {
    [$group] = qualifiersGroups([2, 2]);

    patchQualifiers($group, 4)
        ->assertValidResponse(422)
        ->assertExactJson([
            'message' => 'Z grupy nie może wyjść więcej drużyn, niż w niej gra.',
            'errors' => ['qualifiers' => ['Z grupy nie może wyjść więcej drużyn, niż w niej gra.']],
        ]);

    // Drużyna usunięta miękko nie gra, więc z trzech zostają dwie.
    $group->teams()->firstOrFail()->delete();

    patchQualifiers($group, 3)->assertValidResponse(422)->assertJsonValidationErrors('qualifiers');

    expect($group->fresh()->qualifiers)->toBe(2);
});

it('odmawia, gdy suma wychodzących w fazie spadłaby poniżej dwóch', function () {
    [$group] = qualifiersGroups([2]);

    patchQualifiers($group, 1)
        ->assertValidResponse(422)
        ->assertExactJson([
            'message' => 'Z grup muszą wyjść co najmniej dwie drużyny.',
            'errors' => ['qualifiers' => ['Z grup muszą wyjść co najmniej dwie drużyny.']],
        ]);

    expect($group->fresh()->qualifiers)->toBe(2);
});

it('liczy sumę z pozostałych grup fazy', function () {
    [$group] = qualifiersGroups([2, 1]);

    patchQualifiers($group, 1)->assertValidResponse(200);
});

it('odrzuca wartość, która nie jest liczbą całkowitą co najmniej 1', function (mixed $qualifiers) {
    [$group] = qualifiersGroups([2, 2]);

    patchQualifiers($group, $qualifiers)
        ->assertStatus(422)
        ->assertJsonValidationErrors('qualifiers');

    expect($group->fresh()->qualifiers)->toBe(2);
})->with([
    'zero' => [0],
    'ujemna' => [-1],
    'napis' => ['2'],
    'logiczna' => [true],
    'null' => [null],
]);
