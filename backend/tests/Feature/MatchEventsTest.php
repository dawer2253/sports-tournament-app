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
| Zdarzenia meczu (#200)
|--------------------------------------------------------------------------
|
| Reguły zapisu ustalił #188 (wkład w #191). 401, 403, 404 i jedna zdolność
| `manage` wszystkich czterech tras są w `SubtreeAuthorizationTest`; tutaj
| szczęśliwe ścieżki i niezmienniki 1–9 z DoD #200. Dziesiąty (`GET /sports`
| z `value`) pilnuje `SportsTest`.
|
| Funkcje niżej lądują w globalnej przestrzeni nazw Pesta, stąd prefiks
| `matchEvent`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/**
 * Mecz dwóch drużyn z dwoma zawodnikami każda, w turnieju danego sportu.
 *
 * @return array{match: GameMatch, home: Team, away: Team, homePlayer: Player, awayPlayer: Player}
 */
function matchEventSetup(string $status = 'live', string $sport = 'football'): array
{
    $factory = Tournament::factory();
    $tournament = ($sport === 'basketball' ? $factory->basketball() : $factory)->create();
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    $home = Team::factory()->for($tournament)->create(['name' => 'Wilki Bemowo']);
    $away = Team::factory()->for($tournament)->create(['name' => 'Sokoły Ursus']);

    $match = GameMatch::factory()->for($round)->create([
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
        ...match ($status) {
            'scheduled' => ['status' => 'scheduled', 'home_score' => null, 'away_score' => null],
            default => ['status' => $status, 'home_score' => 1, 'away_score' => 0],
        },
    ]);

    return [
        'match' => $match,
        'home' => $home,
        'away' => $away,
        'homePlayer' => Player::factory()->for($home)->create(['name' => 'Marek Nowak']),
        'awayPlayer' => Player::factory()->for($away)->create(['name' => 'Tomasz Lis']),
    ];
}

function matchEventPost(GameMatch $match, array $body): TestResponse
{
    return actingAsOrganizer($match->stage->tournament->user)
        ->postJson("/api/v1/matches/{$match->id}/events", $body);
}

function matchEventPatch(MatchEvent $event, array $body): TestResponse
{
    return actingAsOrganizer($event->match->stage->tournament->user)
        ->patchJson("/api/v1/match-events/{$event->id}", $body);
}

function matchEventIn(GameMatch $match, Team $team, ?Player $player, string $type = 'goal', ?int $minute = 10): MatchEvent
{
    return MatchEvent::factory()->for($match, 'match')->create([
        'team_id' => $team->id,
        'player_id' => $player?->id,
        'type' => $type,
        'minute' => $minute,
    ]);
}

// --- szczęśliwe ścieżki ------------------------------------------------------

it('dodaje zdarzenie i oddaje je w kształcie z kontraktu', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 63])
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data.team', ['id' => $home->id, 'name' => 'Wilki Bemowo', 'logoUrl' => null])
        ->assertJsonPath('data.player', ['id' => $player->id, 'name' => 'Marek Nowak'])
        ->assertJsonPath('data.type', 'goal')
        ->assertJsonPath('data.typeLabel', 'Bramka')
        ->assertJsonPath('data.minute', 63)
        ->assertJsonMissingPath('data.matchId')
        ->assertJsonMissingPath('data.meta');

    expect($match->events()->count())->toBe(1);
});

it('przyjmuje zdarzenie bez minuty', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => null])
        ->assertValidResponse(201)
        ->assertJsonPath('data.minute', null);
});

it('poprawia zdarzenie częściowo, bez kasowania', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();
    $event = matchEventIn($match, $home, $player, minute: 90);

    matchEventPatch($event, ['minute' => 93])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.id', $event->id)
        ->assertJsonPath('data.minute', 93)
        ->assertJsonPath('data.type', 'goal');
});

it('usuwa zdarzenie', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();
    $event = matchEventIn($match, $home, $player);

    actingAsOrganizer($match->stage->tournament->user)
        ->deleteJson("/api/v1/match-events/{$event->id}")
        ->assertValidResponse(204);

    expect(MatchEvent::find($event->id))->toBeNull();
});

it('nie zmienia wyniku meczu zakończonego przy zapisie zdarzenia', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup('finished');

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 5])
        ->assertValidResponse(201);

    expect($match->fresh()->only(['home_score', 'away_score']))->toBe(['home_score' => 1, 'away_score' => 0]);
});

// --- niezmienniki z #188 -----------------------------------------------------

// 1.
it('odrzuca typ spoza eventTypes sportu, także points w piłce', function (string $type) {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();

    matchEventPost($match, ['type' => $type, 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 5])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.type.0', 'Ten sport nie zna takiego zdarzenia.');

    expect($match->events()->count())->toBe(0);
})->with(['points', 'three_pointer', 'bogus']);

// 2.
it('wymaga zawodnika przy typie z hasPlayer', function () {
    ['match' => $match, 'home' => $home] = matchEventSetup();

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => null, 'minute' => 5])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.playerId.0', 'Wskaż zawodnika.');
});

// 3.
it('odrzuca drużynę spoza meczu pod teamId', function () {
    ['match' => $match] = matchEventSetup();
    $stranger = Team::factory()->for($match->stage->tournament)->create();
    $player = Player::factory()->for($stranger)->create();

    matchEventPost($match, ['type' => 'goal', 'teamId' => $stranger->id, 'playerId' => $player->id, 'minute' => 5])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.teamId.0', 'Ta drużyna nie gra w tym meczu.');

    expect($match->events()->count())->toBe(0);
});

it('odrzuca zawodnika drugiej drużyny tego samego meczu pod playerId', function () {
    ['match' => $match, 'home' => $home, 'awayPlayer' => $rival] = matchEventSetup();

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $rival->id, 'minute' => 5])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.playerId.0', 'Zawodnik nie gra w wybranej drużynie.');

    expect($match->events()->count())->toBe(0);
});

it('odrzuca zawodnika usuniętego miękko pod playerId', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();
    $player->delete();

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 5])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.playerId.0', 'Zawodnik nie gra w wybranej drużynie.');
});

it('odrzuca zawodnika spoza meczu i nie zapisuje zdarzenia', function () {
    ['match' => $match, 'home' => $home] = matchEventSetup();
    $outsider = Player::factory()->create();

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $outsider->id, 'minute' => 5])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('playerId');

    expect($match->events()->count())->toBe(0);
});

// 4.
it('waliduje PATCH po scaleniu: sama zmiana drużyny przy zostawionym zawodniku daje 422', function () {
    ['match' => $match, 'home' => $home, 'away' => $away, 'homePlayer' => $player] = matchEventSetup();
    $event = matchEventIn($match, $home, $player);

    matchEventPatch($event, ['teamId' => $away->id])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.playerId.0', 'Zawodnik nie gra w wybranej drużynie.');

    expect($event->fresh()->team_id)->toBe($home->id);
});

it('przyjmuje PATCH zmieniający drużynę razem z zawodnikiem', function () {
    ['match' => $match, 'home' => $home, 'away' => $away, 'homePlayer' => $player, 'awayPlayer' => $rival] = matchEventSetup();
    $event = matchEventIn($match, $home, $player);

    matchEventPatch($event, ['teamId' => $away->id, 'playerId' => $rival->id])
        ->assertValidResponse(200)
        ->assertJsonPath('data.team.id', $away->id)
        ->assertJsonPath('data.player.id', $rival->id);
});

// 5.
it('odrzuca zapis, poprawkę i usunięcie zdarzenia meczu scheduled pod match', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup('scheduled');

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 5])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.match.0', 'Zdarzenia wpisuje się w meczu trwającym albo zakończonym.');

    // Zdarzenie w meczu zaplanowanym nie powstanie przez API; tu tylko po to,
    // żeby sprawdzić PATCH i DELETE.
    $event = matchEventIn($match, $home, $player);

    matchEventPatch($event, ['minute' => 7])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('match');

    actingAsOrganizer($match->stage->tournament->user)
        ->deleteJson("/api/v1/match-events/{$event->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.match.0', 'Zdarzenia wpisuje się w meczu trwającym albo zakończonym.');

    expect(MatchEvent::find($event->id))->not->toBeNull();
});

it('przyjmuje zapis, poprawkę i usunięcie zdarzenia meczu finished', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup('finished');

    $id = matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 5])
        ->assertValidResponse(201)
        ->json('data.id');

    matchEventPatch(MatchEvent::findOrFail($id), ['minute' => 6])->assertValidResponse(200);

    actingAsOrganizer($match->stage->tournament->user)
        ->deleteJson("/api/v1/match-events/{$id}")
        ->assertValidResponse(204);
});

// 6.
it('blokuje powrót do scheduled meczu, który ma zdarzenia', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();
    $event = matchEventIn($match, $home, $player);

    actingAsOrganizer($match->stage->tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['status' => 'scheduled', 'homeScore' => null, 'awayScore' => null])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.status.0', 'Mecz ma zdarzenia. Usuń je, zanim cofniesz mecz do zaplanowanych.');

    expect($match->fresh()->status)->toBe('live');
    expect(MatchEvent::find($event->id))->not->toBeNull();

    $event->delete();

    actingAsOrganizer($match->stage->tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['status' => 'scheduled', 'homeScore' => null, 'awayScore' => null])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'scheduled');
});

// 7.
it('oddaje listę po minucie rosnąco, bez minuty na końcu, a przy remisie po id', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();
    $noMinute = matchEventIn($match, $home, $player, minute: null);
    $late = matchEventIn($match, $home, $player, minute: 80);
    $tieFirst = matchEventIn($match, $home, $player, minute: 30);
    $tieSecond = matchEventIn($match, $home, $player, minute: 30);
    $early = matchEventIn($match, $home, $player, minute: 2);

    $ids = actingAsOrganizer($match->stage->tournament->user)
        ->getJson("/api/v1/matches/{$match->id}/events")
        ->assertValidResponse(200)
        ->json('data.*.id');

    expect($ids)->toBe([$early->id, $tieFirst->id, $tieSecond->id, $late->id, $noMinute->id]);
});

// 8.
it('bierze typeLabel z konfiguracji sportu: koszykówka oddaje „Rzut za 3”', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup('live', 'basketball');

    matchEventPost($match, ['type' => 'three_pointer', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => 12])
        ->assertValidResponse(201)
        ->assertJsonPath('data.typeLabel', 'Rzut za 3');
});

// 9. Odpowiedź dla cudzego zdarzenia (403, także przed walidacją) sprawdza
// przekrojowo `SubtreeAuthorizationTest` dla wszystkich czterech tras. Tu
// tylko to, czego tamten nie widzi: zdarzenie innego meczu tego samego
// organizera nie miesza się do listy.
it('oddaje wyłącznie zdarzenia wskazanego meczu', function () {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();
    $own = matchEventIn($match, $home, $player);
    $other = GameMatch::factory()->live()->for($match->round)->create([
        'match_number' => 2,
        'home_team_id' => $home->id,
        'away_team_id' => $match->away_team_id,
    ]);
    matchEventIn($other, $home, $player);

    actingAsOrganizer($match->stage->tournament->user)
        ->getJson("/api/v1/matches/{$match->id}/events")
        ->assertValidResponse(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $own->id);
});

// --- typy pól ----------------------------------------------------------------

it('odrzuca minutę spoza 1–150 i liczbę w napisie', function (mixed $minute) {
    ['match' => $match, 'home' => $home, 'homePlayer' => $player] = matchEventSetup();

    matchEventPost($match, ['type' => 'goal', 'teamId' => $home->id, 'playerId' => $player->id, 'minute' => $minute])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.minute.0', 'Minuta to liczba od 1 do 150.');
})->with([0, 151, '12']);
