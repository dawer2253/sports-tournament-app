<?php

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use App\Models\Venue;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`. Decyzje, które
// ten plik przypina, zapadły w #83.

/**
 * Pełne poddrzewo turnieju, z drużyną usuniętą miękko i jej zawodnikiem.
 * Mecz zostaje nierozegrany, bo rozegrany zablokowałby usunięcie.
 *
 * @return array<class-string, list<int>> klasa modelu → id utworzonych wierszy
 */
function tournamentSubtree(Tournament $tournament): array
{
    $stage = Stage::factory()->group()->for($tournament)->create();
    $group = Group::factory()->for($stage)->create();
    $round = Round::factory()->for($stage)->create();
    $team = Team::factory()->for($tournament)->create();
    $player = Player::factory()->for($team)->create();
    $trashedTeam = Team::factory()->for($tournament)->create();
    $trashedPlayer = Player::factory()->for($trashedTeam)->create();
    $trashedTeam->delete();
    $venue = Venue::factory()->for($tournament)->create();
    $match = GameMatch::factory()->for($round)->create([
        'group_id' => $group->id,
        'home_team_id' => $team->id,
        'venue_id' => $venue->id,
    ]);
    $event = MatchEvent::factory()->for($match, 'match')->create([
        'team_id' => $team->id,
        'player_id' => $player->id,
    ]);

    return [
        Stage::class => [$stage->id],
        Group::class => [$group->id],
        Round::class => [$round->id],
        Team::class => [$team->id, $trashedTeam->id, $match->away_team_id],
        Player::class => [$player->id, $trashedPlayer->id],
        Venue::class => [$venue->id],
        GameMatch::class => [$match->id],
        MatchEvent::class => [$event->id],
    ];
}

/**
 * Liczy wiersze z pominięciem soft-deletes — usunięta miękko drużyna też ma
 * zniknąć z bazy.
 *
 * @param  array<class-string, list<int>>  $subtree
 * @return array<class-string, int>
 */
function remainingRows(array $subtree): array
{
    return collect($subtree)
        ->map(fn (array $ids, string $model): int => (new $model)->newQueryWithoutScopes()->whereKey($ids)->count())
        ->all();
}

it('usuwa turniej i oddaje 204, a potem turniej daje 404', function () {
    $tournament = Tournament::factory()->create();

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidRequest()
        ->assertValidResponse(204)
        ->assertNoContent();

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(404);

    expect(Tournament::find($tournament->id))->toBeNull();
});

// Kaskadę robi baza, więc test czyta tabele z pominięciem soft-deletes.
// Turniej tego samego organizera pilnuje, że kaskada nie wychodzi poza
// usuwany turniej.
it('usuwa całe poddrzewo turnieju, także drużyny usunięte miękko, i tylko je', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $other = Tournament::factory()->for($organizer)->create();
    $subtree = tournamentSubtree($tournament);
    $otherSubtree = tournamentSubtree($other);

    actingAsOrganizer($organizer)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(204);

    expect(remainingRows($subtree))->each->toBe(0)
        ->and(remainingRows($otherSubtree))
        ->toBe(array_map(count(...), $otherSubtree))
        ->and($other->fresh())->not->toBeNull();
});

it('zwalnia slug: po usunięciu nowy turniej dostaje ten sam adres', function () {
    $organizer = User::factory()->create();
    $payload = ['name' => 'Liga Osiedlowa 2026', 'sportId' => sport('football')->id, 'format' => 'league'];

    $id = actingAsOrganizer($organizer)
        ->postJson('/api/v1/tournaments', $payload)
        ->assertJsonPath('data.slug', 'liga-osiedlowa-2026')
        ->json('data.id');

    actingAsOrganizer($organizer)
        ->deleteJson("/api/v1/tournaments/{$id}")
        ->assertValidResponse(204);

    actingAsOrganizer($organizer)
        ->postJson('/api/v1/tournaments', $payload)
        ->assertValidResponse(201)
        ->assertJsonPath('data.slug', 'liga-osiedlowa-2026');
});

it('nie usuwa turnieju ani jego poddrzewa, gdy w turnieju rozegrano mecz', function () {
    $tournament = Tournament::factory()->create(['name' => 'Liga Osiedlowa 2026']);
    $subtree = tournamentSubtree($tournament);
    GameMatch::findOrFail($subtree[GameMatch::class][0])->update([
        'status' => 'finished',
        'home_score' => 2,
        'away_score' => 1,
    ]);

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: turniej „Liga Osiedlowa 2026” ma powiązane rozegrane mecze.']);

    expect($tournament->fresh())->not->toBeNull()
        ->and(remainingRows($subtree))->toBe(array_map(count(...), $subtree));
});

it('usuwa turniej ze statusem finished, jeżeli nie rozegrano w nim meczu', function () {
    $tournament = Tournament::factory()->create(['status' => 'finished']);
    GameMatch::factory()->for(Round::factory()->for(Stage::factory()->for($tournament)))->create();

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(204);

    expect(Tournament::find($tournament->id))->toBeNull();
});
