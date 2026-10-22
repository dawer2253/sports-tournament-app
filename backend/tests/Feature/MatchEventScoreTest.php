<?php

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Zdarzenie w meczu trwającym zmienia wynik (#317, ADR-0013)
|--------------------------------------------------------------------------
|
| Zdobycz sportu podbija zapisany wynik meczu `live` w tej samej transakcji,
| samobój liczy się przeciwnikowi, a mecz zakończony wyniku nie rusza.
| Doliczony czas (`addedTime`) jest osobnym polem minuty.
|
| Funkcje niżej lądują w globalnej przestrzeni nazw Pesta, stąd prefiks
| `matchScore`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/**
 * Mecz 1:1 między dwiema drużynami, z zawodnikami po obu stronach.
 *
 * @return array{match: GameMatch, home: Team, away: Team, homePlayer: Player, awayPlayer: Player}
 */
function matchScoreSetup(string $status = 'live', bool $basketball = false): array
{
    $factory = Tournament::factory();
    $tournament = ($basketball ? $factory->basketball() : $factory)->create();
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    $home = Team::factory()->for($tournament)->create();
    $away = Team::factory()->for($tournament)->create();

    $match = GameMatch::factory()->for($round)->create([
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        'status' => $status,
        'home_score' => 1,
        'away_score' => 1,
    ]);

    return [
        'match' => $match,
        'home' => $home,
        'away' => $away,
        'homePlayer' => Player::factory()->for($home)->create(),
        'awayPlayer' => Player::factory()->for($away)->create(),
    ];
}

function matchScorePost(GameMatch $match, array $body): TestResponse
{
    return actingAsOrganizer($match->stage->tournament->user)
        ->postJson("/api/v1/matches/{$match->id}/events", ['minute' => 10, 'playerId' => null, ...$body]);
}

function matchScorePatch(MatchEvent $event, array $body): TestResponse
{
    return actingAsOrganizer($event->match->stage->tournament->user)
        ->patchJson("/api/v1/match-events/{$event->id}", $body);
}

function matchScoreDelete(MatchEvent $event): TestResponse
{
    return actingAsOrganizer($event->match->stage->tournament->user)
        ->deleteJson("/api/v1/match-events/{$event->id}");
}

function matchScoreEvent(GameMatch $match, Team $team, Player $player, string $type = 'goal'): MatchEvent
{
    return MatchEvent::factory()->for($match, 'match')->create([
        'team_id' => $team->id,
        'player_id' => $player->id,
        'type' => $type,
        'minute' => 10,
    ]);
}

/** @return array{int, int} */
function matchScoreOf(GameMatch $match): array
{
    $match->refresh();

    return [$match->home_score, $match->away_score];
}

// --- dodanie -----------------------------------------------------------------

it('podbija wynik gospodarzy bramką w meczu trwającym', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();

    matchScorePost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id])
        ->assertValidResponse(201);

    expect(matchScoreOf($match))->toBe([2, 1]);
});

it('podbija wynik gości bramką gości', function () {
    ['match' => $match, 'away' => $away, 'awayPlayer' => $player] = matchScoreSetup();

    matchScorePost($match, ['type' => 'goal', 'teamId' => $away->id, 'playerId' => $player->id])
        ->assertValidResponse(201);

    expect(matchScoreOf($match))->toBe([1, 2]);
});

it('liczy samobój gospodarza gościom', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();

    matchScorePost($match, ['type' => 'own_goal', 'teamId' => $home->id, 'playerId' => $player->id])
        ->assertValidResponse(201);

    expect(matchScoreOf($match))->toBe([1, 2]);
});

it('liczy wartość rzutu w koszykówce: rzut za 3 to +3', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup(basketball: true);

    matchScorePost($match, ['type' => 'three_pointer', 'teamId' => $home->id, 'playerId' => $player->id])
        ->assertValidResponse(201);

    expect(matchScoreOf($match))->toBe([4, 1]);
});

it('liczy od zera, gdy mecz trwający nie ma jeszcze wyniku', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $match->update(['home_score' => null, 'away_score' => null]);

    matchScorePost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id])
        ->assertValidResponse(201);

    expect(matchScoreOf($match))->toBe([1, 0]);
});

it('nie zmienia wyniku kartką ani faulem', function (string $type, bool $basketball) {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup(basketball: $basketball);

    matchScorePost($match, ['type' => $type, 'teamId' => $home->id, 'playerId' => $player->id])
        ->assertValidResponse(201);

    expect(matchScoreOf($match))->toBe([1, 1]);
})->with([
    'żółta kartka' => ['yellow_card', false],
    'czerwona kartka' => ['red_card', false],
    'faul' => ['foul', true],
]);

it('nie zmienia wyniku meczu zakończonego przy dodaniu, poprawce i usunięciu', function () {
    ['match' => $match, 'home' => $home, 'away' => $away, 'homePlayer' => $homePlayer, 'awayPlayer' => $awayPlayer] = matchScoreSetup('finished');

    $id = matchScorePost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $homePlayer->id])
        ->assertValidResponse(201)
        ->json('data.id');
    $event = MatchEvent::findOrFail($id);

    matchScorePatch($event, ['teamId' => $away->id, 'playerId' => $awayPlayer->id])->assertValidResponse(200);
    matchScoreDelete($event)->assertValidResponse(204);

    expect(matchScoreOf($match))->toBe([1, 1]);
});

// --- usunięcie ---------------------------------------------------------------

it('odejmuje wartość zdarzenia przy usunięciu w meczu trwającym', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $event = matchScoreEvent($match, $home, $player);

    matchScoreDelete($event)->assertValidResponse(204);

    expect(matchScoreOf($match))->toBe([0, 1]);
});

it('nie schodzi z wynikiem poniżej 0', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $match->update(['home_score' => 0, 'away_score' => 0]);
    $event = matchScoreEvent($match, $home, $player);

    matchScoreDelete($event)->assertValidResponse(204);

    expect(matchScoreOf($match))->toBe([0, 0]);
});

it('zdejmuje samobój z wyniku przeciwnika przy usunięciu', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $event = matchScoreEvent($match, $home, $player, 'own_goal');

    matchScoreDelete($event)->assertValidResponse(204);

    expect(matchScoreOf($match))->toBe([1, 0]);
});

// --- poprawka ----------------------------------------------------------------

it('przenosi punkt przy zmianie drużyny', function () {
    ['match' => $match, 'home' => $home, 'away' => $away, 'awayPlayer' => $rival, 'homePlayer' => $player] = matchScoreSetup();
    $event = matchScoreEvent($match, $home, $player);

    matchScorePatch($event, ['teamId' => $away->id, 'playerId' => $rival->id])->assertValidResponse(200);

    expect(matchScoreOf($match))->toBe([0, 2]);
});

it('zdejmuje punkt, gdy bramka zmienia się w kartkę', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $event = matchScoreEvent($match, $home, $player);

    matchScorePatch($event, ['type' => 'yellow_card'])->assertValidResponse(200);

    expect(matchScoreOf($match))->toBe([0, 1]);
});

it('przenosi punkt, gdy bramka zmienia się w samobój', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $event = matchScoreEvent($match, $home, $player);

    matchScorePatch($event, ['type' => 'own_goal'])->assertValidResponse(200);

    expect(matchScoreOf($match))->toBe([0, 2]);
});

it('dodaje punkt, gdy kartka zmienia się w bramkę', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $event = matchScoreEvent($match, $home, $player, 'yellow_card');

    matchScorePatch($event, ['type' => 'goal'])->assertValidResponse(200);

    expect(matchScoreOf($match))->toBe([2, 1]);
});

it('nie rusza wyniku przy zmianie samej minuty, doliczonego czasu i zawodnika', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $other = Player::factory()->for($home)->create();
    $event = matchScoreEvent($match, $home, $player);

    matchScorePatch($event, ['minute' => 45, 'addedTime' => 3])->assertValidResponse(200);
    matchScorePatch($event, ['playerId' => $other->id])->assertValidResponse(200);

    expect(matchScoreOf($match))->toBe([1, 1]);
});

// --- doliczony czas ----------------------------------------------------------

it('zapisuje doliczony czas i oddaje go w zasobie', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();

    matchScorePost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 45, 'addedTime' => 3])
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data.minute', 45)
        ->assertJsonPath('data.addedTime', 3);
});

it('przyjmuje zdarzenie bez addedTime jako null', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();

    matchScorePost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id])
        ->assertValidResponse(201)
        ->assertJsonPath('data.addedTime', null);
});

it('odrzuca doliczony czas spoza 1–30', function (mixed $addedTime) {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();

    matchScorePost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 90, 'addedTime' => $addedTime])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.addedTime.0', 'Doliczony czas to liczba od 1 do 30.');
})->with([0, 31, '3']);

it('odrzuca doliczony czas bez minuty', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();

    matchScorePost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => null, 'addedTime' => 2])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.addedTime.0', 'Doliczony czas wymaga minuty.');

    expect($match->events()->count())->toBe(0);
});

it('układa oś po minucie, potem po doliczonym czasie', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchScoreSetup();
    $added = matchScoreEvent($match, $home, $player)->forceFill(['minute' => 45, 'added_time' => 3]);
    $added->save();
    $plain = matchScoreEvent($match, $home, $player)->forceFill(['minute' => 45]);
    $plain->save();
    $next = matchScoreEvent($match, $home, $player)->forceFill(['minute' => 46]);
    $next->save();
    $earlyAdded = matchScoreEvent($match, $home, $player)->forceFill(['minute' => 45, 'added_time' => 1]);
    $earlyAdded->save();

    $ids = actingAsOrganizer($match->stage->tournament->user)
        ->getJson("/api/v1/matches/{$match->id}/events")
        ->assertValidResponse(200)
        ->json('data.*.id');

    expect($ids)->toBe([$plain->id, $earlyAdded->id, $added->id, $next->id]);
});
