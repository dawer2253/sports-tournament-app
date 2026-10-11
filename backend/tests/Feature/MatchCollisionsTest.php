<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use App\Models\Venue;
use Spectator\Spectator;
use Symfony\Component\Yaml\Yaml;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** Mecz w swoim własnym wierszu.

 * `$home`/`$away` to id drużyn; `null` oznacza slot drabinki bez drużyny.
 */
function matchAt(Stage $stage, ?int $home, ?int $away, ?string $kickoff, ?int $venueId = null, string $status = 'scheduled'): GameMatch
{
    $order = ($stage->rounds()->max('order') ?? 0) + 1;
    $round = Round::factory()->for($stage)->create(['order' => $order, 'name' => "Kolejka {$order}"]);

    return GameMatch::factory()->for($round)->create([
        'home_team_id' => $home,
        'away_team_id' => $away,
        'kickoff_at' => $kickoff,
        'venue_id' => $venueId,
        'status' => $status,
    ]);
}

/**
 * Kolizje z `GET /tournaments/{tournament}/matches`, po `id` meczu.
 *
 * @return array<int, list<array{type: string, matchId: int}>>
 */
function collisionsOf(Tournament $tournament): array
{
    $response = actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/matches?perPage=200")
        ->assertValidResponse(200);

    return collect($response->json('data'))->mapWithKeys(
        fn (array $match): array => [$match['id'] => $match['collisions']],
    )->all();
}

function collisionTournament(string $code = 'football'): Tournament
{
    $tournament = $code === 'football'
        ? Tournament::factory()->create()
        : Tournament::factory()->basketball()->create();

    return $tournament;
}

it('jest symetryczna', function () {
    $tournament = collisionTournament();
    $stage = Stage::factory()->for($tournament)->create();
    $team = Team::factory()->for($tournament)->create();
    $other = Team::factory()->for($tournament)->create();
    $third = Team::factory()->for($tournament)->create();

    $a = matchAt($stage, $team->id, $other->id, '2026-09-06 10:00:00');
    $b = matchAt($stage, $team->id, $third->id, '2026-09-06 10:30:00');

    $collisions = collisionsOf($tournament);

    expect($collisions[$a->id])->toBe([['type' => 'team', 'matchId' => $b->id]])
        ->and($collisions[$b->id])->toBe([['type' => 'team', 'matchId' => $a->id]]);
});

it('nie liczy stykających się okien', function () {
    $tournament = collisionTournament();
    $stage = Stage::factory()->for($tournament)->create();
    $team = Team::factory()->for($tournament)->create();
    $other = Team::factory()->for($tournament)->create();
    $third = Team::factory()->for($tournament)->create();

    // matchDuration = 60: 10:00–11:00 i 11:00–12:00 stykają się, nie nakładają.
    $a = matchAt($stage, $team->id, $other->id, '2026-09-06 10:00:00');
    $b = matchAt($stage, $team->id, $third->id, '2026-09-06 11:00:00');

    $collisions = collisionsOf($tournament);

    expect($collisions[$a->id])->toBe([])
        ->and($collisions[$b->id])->toBe([]);
});

it('liczy kolizję boiska dla tego samego obiektu', function () {
    $tournament = collisionTournament();
    $stage = Stage::factory()->for($tournament)->create();
    $venue = Venue::factory()->for($tournament)->create();
    $a = matchAt($stage, null, null, '2026-09-06 10:00:00', $venue->id);
    $b = matchAt($stage, null, null, '2026-09-06 10:30:00', $venue->id);

    $collisions = collisionsOf($tournament);

    expect($collisions[$a->id])->toBe([['type' => 'venue', 'matchId' => $b->id]])
        ->and($collisions[$b->id])->toBe([['type' => 'venue', 'matchId' => $a->id]]);
});

it('nie liczy meczu bez terminu ani kolizji venue bez obiektu', function () {
    $tournament = collisionTournament();
    $stage = Stage::factory()->for($tournament)->create();
    $team = Team::factory()->for($tournament)->create();
    $other = Team::factory()->for($tournament)->create();

    $a = matchAt($stage, $team->id, $other->id, '2026-09-06 10:00:00');
    $undated = matchAt($stage, $team->id, $other->id, null);
    $noVenue = matchAt($stage, $team->id, $other->id, '2026-09-06 10:30:00');

    $collisions = collisionsOf($tournament);

    expect($collisions[$undated->id])->toBe([])
        ->and($collisions[$a->id])->toBe([['type' => 'team', 'matchId' => $noVenue->id]]);
});

it('liczy mecz finished i mecz innej fazy tego samego turnieju, a cudzego turnieju nie', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $league = Stage::factory()->for($tournament)->create();
    $cup = Stage::factory()->knockout()->for($tournament)->create(['order' => 2]);
    $team = Team::factory()->for($tournament)->create();
    $other = Team::factory()->for($tournament)->create();
    $third = Team::factory()->for($tournament)->create();

    $finished = matchAt($league, $team->id, $other->id, '2026-09-06 10:00:00', status: 'finished');
    $crossStage = matchAt($cup, $team->id, $third->id, '2026-09-06 10:30:00');

    // Inny turniej tego samego organizera: nie może wejść do kolizji.
    $foreign = Tournament::factory()->for($organizer)->basketball()->create();
    matchAt(Stage::factory()->for($foreign)->create(), null, null, '2026-09-06 10:15:00', Venue::factory()->for($foreign)->create()->id);

    $collisions = collisionsOf($tournament);

    expect($collisions[$finished->id])->toBe([['type' => 'team', 'matchId' => $crossStage->id]])
        ->and($collisions[$crossStage->id])->toBe([['type' => 'team', 'matchId' => $finished->id]]);
});

it('trzyma kolizję poza schematem publicznym', function () {
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $schemas = $spec['components']['schemas'];

    $adminItems = $spec['paths']['/tournaments/{tournament}/matches']['get']['responses']['200']['content']['application/json']['schema']['properties']['data']['items'];
    $publicItems = $spec['paths']['/public/t/{slug}/matches']['get']['responses']['200']['content']['application/json']['schema']['properties']['data']['items'];

    expect($adminItems['$ref'])->toBe('#/components/schemas/AdminMatch')
        ->and($schemas['AdminMatch']['allOf'][1]['properties'])->toHaveKey('collisions')
        ->and($publicItems['$ref'])->toBe('#/components/schemas/Match')
        ->and($schemas['Match']['properties'])->not->toHaveKey('collisions');
});
