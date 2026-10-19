<?php

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Tabele grup (#259)
|--------------------------------------------------------------------------
|
| Niezmiennik 6 z wkładu #249 w #251: jedna tabela na grupę, w kolejności
| `groups.order`, z samymi drużynami i meczami grupy. Reguły samej tabeli
| (kryteria, punktacja, `live`) pilnuje `StandingsTest` na lidze — kalkulator
| jest ten sam. Funkcje lądują w globalnej przestrzeni nazw Pesta, stąd
| prefiks `groupStandings`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/**
 * Turniej z fazą grupową i jedną wspólną kolejką. Grupy powstają w kolejności
 * tablicy, a `order` dostają z niej, od jedynki — chyba że test poda własny.
 *
 * @param  array<string, list<string>>  $groups  nazwa grupy → nazwy jej drużyn
 */
function groupStandingsTournament(array $groups, array $attributes = []): Tournament
{
    $tournament = Tournament::factory()->create($attributes);
    $stage = Stage::factory()->group()->for($tournament)->create();
    Round::factory()->for($stage)->create();

    $order = 1;
    foreach ($groups as $name => $teamNames) {
        $group = Group::factory()->for($stage)->create(['name' => $name, 'order' => $order++, 'qualifiers' => 1]);

        foreach ($teamNames as $teamName) {
            Team::factory()->for($tournament)->create(['name' => $teamName, 'group_id' => $group->id]);
        }
    }

    return $tournament;
}

function groupStandingsGroup(Tournament $tournament, string $name): Group
{
    return Group::query()->where('tournament_id', $tournament->id)->where('name', $name)->firstOrFail();
}

/** Zakończony mecz grupy drużyny `$home` we wspólnej kolejce fazy. */
function groupStandingsMatch(Tournament $tournament, string $home, string $away, int $homeScore, int $awayScore): GameMatch
{
    $round = Round::query()->whereIn('stage_id', $tournament->stages()->pluck('id'))->firstOrFail();
    $homeTeam = $tournament->teams()->where('name', $home)->firstOrFail();

    return GameMatch::factory()->for($round)->finished($homeScore, $awayScore)->create([
        'group_id' => $homeTeam->group_id,
        'match_number' => (int) GameMatch::where('round_id', $round->id)->max('match_number') + 1,
        'home_team_id' => $homeTeam->id,
        'away_team_id' => $tournament->teams()->where('name', $away)->value('id'),
    ]);
}

function groupStandingsOf(Tournament $tournament): TestResponse
{
    return actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/standings");
}

it('oddaje jedną tabelę na grupę, w kolejności groups.order, z samymi drużynami grupy', function () {
    $tournament = groupStandingsTournament([
        'Grupa A' => ['Wilki Bemowo', 'Orły Bielany'],
        'Grupa B' => ['Sokoły Ursus', 'Żubry Wola', 'Rysie Mokotów'],
    ]);
    // `order` odwrotny do kolejności tworzenia: tabela idzie po `order`, nie po `id`.
    groupStandingsGroup($tournament, 'Grupa A')->update(['order' => 3]);

    $response = groupStandingsOf($tournament)->assertValidResponse(200);

    expect($response->json('data.*.groupName'))->toBe(['Grupa B', 'Grupa A'])
        ->and($response->json('data.0.rows.*.team.name'))->toBe(['Rysie Mokotów', 'Sokoły Ursus', 'Żubry Wola'])
        ->and($response->json('data.1.rows.*.team.name'))->toBe(['Orły Bielany', 'Wilki Bemowo']);
});

it('wypełnia groupId i groupName w tabelach grup oraz stageId i stageName fazy', function () {
    $tournament = groupStandingsTournament(['Grupa A' => ['Wilki Bemowo', 'Orły Bielany']]);
    $group = groupStandingsGroup($tournament, 'Grupa A');

    groupStandingsOf($tournament)
        ->assertValidResponse(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.groupId', $group->id)
        ->assertJsonPath('data.0.groupName', 'Grupa A')
        ->assertJsonPath('data.0.stageId', $group->stage_id)
        ->assertJsonPath('data.0.stageName', 'Faza grupowa');
});

it('w lidze zostawia groupId i groupName jako null', function () {
    $tournament = Tournament::factory()->create();
    Stage::factory()->for($tournament)->create();
    Team::factory()->for($tournament)->create();

    groupStandingsOf($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.groupId', null)
        ->assertJsonPath('data.0.groupName', null);
});

it('liczy tabelę grupy z jej meczów, a wynik meczu innej grupy niczego w niej nie zmienia', function () {
    $tournament = groupStandingsTournament([
        'Grupa A' => ['Wilki Bemowo', 'Orły Bielany'],
        'Grupa B' => ['Sokoły Ursus', 'Żubry Wola'],
    ]);
    groupStandingsMatch($tournament, 'Wilki Bemowo', 'Orły Bielany', 2, 0);

    $before = groupStandingsOf($tournament)->assertValidResponse(200)->json('data.0');
    expect($before['rows'][0])->toMatchArray(['played' => 1, 'won' => 1, 'scoreFor' => 2, 'points' => 3])
        ->and($before['rows'][0]['team']['name'])->toBe('Wilki Bemowo');

    groupStandingsMatch($tournament, 'Sokoły Ursus', 'Żubry Wola', 5, 1);

    $after = groupStandingsOf($tournament)->assertValidResponse(200)->json('data');
    expect($after[0])->toBe($before)
        ->and($after[1]['rows'][0])->toMatchArray(['played' => 1, 'won' => 1, 'scoreFor' => 5, 'points' => 3]);
});

it('forma grupy bierze tylko mecze tej grupy', function () {
    $tournament = groupStandingsTournament([
        'Grupa A' => ['Wilki Bemowo', 'Orły Bielany'],
        'Grupa B' => ['Sokoły Ursus', 'Żubry Wola'],
    ]);
    groupStandingsMatch($tournament, 'Wilki Bemowo', 'Orły Bielany', 2, 0);
    groupStandingsMatch($tournament, 'Sokoły Ursus', 'Żubry Wola', 1, 1);
    groupStandingsMatch($tournament, 'Orły Bielany', 'Wilki Bemowo', 3, 1);

    $response = groupStandingsOf($tournament)->assertValidResponse(200);

    $forms = collect($response->json('data.*.rows.*'))->mapWithKeys(fn (array $row): array => [$row['team']['name'] => $row['form']]);

    expect($forms->all())->toEqual([
        'Wilki Bemowo' => ['win', 'loss'],
        'Orły Bielany' => ['loss', 'win'],
        'Sokoły Ursus' => ['draw'],
        'Żubry Wola' => ['draw'],
    ]);
});

it('daje grupie bez żywych drużyn tabelę bez wierszy, a grupie z mniejszą liczbą drużyn niż qualifiers tabelę z resztą', function () {
    $tournament = groupStandingsTournament([
        'Grupa A' => ['Wilki Bemowo', 'Orły Bielany'],
        'Grupa B' => ['Sokoły Ursus', 'Żubry Wola'],
    ]);
    groupStandingsGroup($tournament, 'Grupa A')->update(['qualifiers' => 2]);
    $tournament->teams()->where('name', 'Wilki Bemowo')->firstOrFail()->delete();
    $tournament->teams()->where('group_id', groupStandingsGroup($tournament, 'Grupa B')->id)->get()
        ->each(fn (Team $team) => $team->delete());

    groupStandingsOf($tournament)
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.groupName', ['Grupa A', 'Grupa B'])
        ->assertJsonPath('data.0.rows.*.team.name', ['Orły Bielany'])
        ->assertJsonPath('data.1.rows', []);
});

it('nie daje tabeli fazie grupowej bez ustalonego składu', function () {
    $tournament = Tournament::factory()->create();
    Stage::factory()->group()->for($tournament)->create();
    Team::factory()->for($tournament)->create();

    groupStandingsOf($tournament)
        ->assertValidResponse(200)
        ->assertExactJson(['data' => []]);
});

it('oddaje tabele grup także na stronie publicznej', function () {
    $tournament = groupStandingsTournament(
        ['Grupa A' => ['Wilki Bemowo', 'Orły Bielany'], 'Grupa B' => ['Sokoły Ursus', 'Żubry Wola']],
        ['status' => 'active'],
    );

    $this->getJson("/api/v1/public/t/{$tournament->slug}/standings")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.groupName', ['Grupa A', 'Grupa B'])
        ->assertJsonPath('data.1.rows.*.team.name', ['Sokoły Ursus', 'Żubry Wola']);
});
