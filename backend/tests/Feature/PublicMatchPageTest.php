<?php

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Strona meczu na stronie publicznej (#210)
|--------------------------------------------------------------------------
|
| `GET /public/t/{slug}/matches/{match}`: mecz ze strzelcami, zdarzenia
| z częścią meczu i wynikiem po zdarzeniu oraz wyniki części. Część i wynik
| liczy serwer z ustawienia turnieju (`periods`) i konfiguracji sportu.
| Funkcje lądują w globalnej przestrzeni nazw Pesta, stąd prefiks `matchPage`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/**
 * Opublikowany turniej z jedną kolejką i drużynami Orły (gospodarz) i Sokoły
 * (gość), z podziałem meczu `[count, minutes]`.
 *
 * @param  array{0: int, 1: ?int}|null  $periods
 */
function matchPageTournament(string $sport = 'football', ?array $periods = null, string $status = 'active'): Tournament
{
    $factory = Tournament::factory();
    $tournament = (match ($sport) {
        'basketball' => $factory->basketball(),
        'volleyball' => $factory->volleyball(),
        default => $factory,
    })->create([
        'status' => $status,
        ...($periods === null ? [] : ['period_count' => $periods[0], 'period_minutes' => $periods[1]]),
    ]);
    $stage = Stage::factory()->for($tournament)->create();
    Round::factory()->for($stage)->create(['name' => 'Kolejka 1', 'order' => 1]);
    Team::factory()->for($tournament)->create(['name' => 'Orły Bielany']);
    Team::factory()->for($tournament)->create(['name' => 'Sokoły Ursus']);

    return $tournament;
}

/** Mecz Orły – Sokoły; domyślnie zakończony 0:0. */
function matchPageMatch(Tournament $tournament, array $attributes = []): GameMatch
{
    $round = $tournament->stages()->firstOrFail()->rounds()->firstOrFail();

    return GameMatch::factory()->for($round)->create([
        'match_number' => (int) GameMatch::where('round_id', $round->id)->max('match_number') + 1,
        'home_team_id' => $tournament->teams()->where('name', 'Orły Bielany')->value('id'),
        'away_team_id' => $tournament->teams()->where('name', 'Sokoły Ursus')->value('id'),
        'status' => 'finished',
        'home_score' => 0,
        'away_score' => 0,
        ...$attributes,
    ]);
}

function matchPagePlayer(Tournament $tournament, string $team, string $name): Player
{
    return Player::factory()->create([
        'team_id' => $tournament->teams()->where('name', $team)->value('id'),
        'name' => $name,
    ]);
}

/**
 * Zdarzenia `[zawodnik, typ, minuta]`, zapisane w podanej kolejności (więc
 * z rosnącym `id`). Drużyna zdarzenia to drużyna zawodnika (#188, reguła 7).
 *
 * @param  list<array{0: Player, 1: string, 2: ?int}>  $events
 * @return list<MatchEvent>
 */
function matchPageEvents(GameMatch $match, array $events): array
{
    return array_map(fn (array $event): MatchEvent => MatchEvent::factory()->create([
        'match_id' => $match->id,
        'team_id' => $event[0]->team_id,
        'player_id' => $event[0]->id,
        'type' => $event[1],
        'minute' => $event[2],
    ]), $events);
}

function matchPageGet(Tournament $tournament, int|string $match, array $headers = []): TestResponse
{
    return test()->getJson("/api/v1/public/t/{$tournament->slug}/matches/{$match}", $headers);
}

/** Odpowiedź po walidacji kontraktu, jako tablica `data`. */
function matchPage(Tournament $tournament, GameMatch $match): array
{
    return matchPageGet($tournament, $match->id)->assertValidRequest()->assertValidResponse(200)->json('data');
}

// --- dostęp i walidator HTTP ----------------------------------------------

it('mecz innego turnieju, nieistniejący i z turnieju-szkicu dają ten sam 404', function () {
    $tournament = matchPageTournament();
    $other = matchPageMatch(matchPageTournament());
    $draft = matchPageTournament(status: 'draft');
    $draftMatch = matchPageMatch($draft);

    $missing = matchPageGet($tournament, 999999)->assertNotFound()->assertValidResponse(404);
    $foreign = matchPageGet($tournament, $other->id)->assertNotFound()->assertValidResponse(404);
    $hidden = matchPageGet($draft, $draftMatch->id)->assertNotFound()->assertValidResponse(404);
    $notNumeric = matchPageGet($tournament, 'abc')->assertNotFound();

    expect($foreign->json())->toBe($missing->json())
        ->and($hidden->json())->toBe($missing->json())
        ->and($notNumeric->json())->toBe($missing->json())
        ->and($missing->json('message'))->toBe(contractErrorMessage('NotFound'));
});

it('200 niesie ETag, zgodny If-None-Match daje 304, a nowe zdarzenie zmienia ETag', function () {
    $tournament = matchPageTournament();
    $match = matchPageMatch($tournament);
    $player = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');

    $first = matchPageGet($tournament, $match->id)->assertOk()->assertValidResponse(200);
    $etag = $first->headers->get('ETag');

    expect($etag)->toMatch('/^"[^"]+"$/')
        ->and($first->headers->get('Cache-Control'))->toMatch('/(^|,)\s*no-cache\s*(,|$)/');

    $repeated = matchPageGet($tournament, $match->id, ['If-None-Match' => $etag])->assertStatus(304);
    expect($repeated->getContent())->toBe('');

    matchPageEvents($match, [[$player, 'yellow_card', 10]]);

    expect(matchPageGet($tournament, $match->id)->assertOk()->headers->get('ETag'))->not->toBe($etag);
});

// --- część meczu -------------------------------------------------------------

it('przypisuje część według ustawienia turnieju', function (string $sport, array $periods, array $expected) {
    $tournament = matchPageTournament($sport, $periods);
    $match = matchPageMatch($tournament);
    $player = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $type = $sport === 'basketball' ? 'foul' : 'yellow_card';
    matchPageEvents($match, array_map(fn (array $pair): array => [$player, $type, $pair[0]], $expected));

    $events = matchPage($tournament, $match)['events'];

    expect(array_map(fn (array $event): array => [$event['minute'], $event['period']], $events))->toBe($expected);
})->with([
    '2 × 45' => ['football', [2, 45], [[45, 1], [46, 2], [93, 2], [null, null]]],
    '4 × 10' => ['basketball', [4, 10], [[10, 1], [11, 2], [45, 4], [null, null]]],
    '2 × 20 w koszu' => ['basketball', [2, 20], [[20, 1], [25, 2], [null, null]]],
]);

it('doliczony czas zostaje w części z minuty: 45+3 to 1. połowa, 90+4 to 2.', function () {
    $tournament = matchPageTournament();
    $match = matchPageMatch($tournament);
    $player = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $events = matchPageEvents($match, [[$player, 'yellow_card', 45], [$player, 'yellow_card', 90]]);
    $events[0]->update(['added_time' => 3]);
    $events[1]->update(['added_time' => 4]);

    $page = matchPage($tournament, $match)['events'];

    expect(array_column($page, 'period'))->toBe([1, 2])
        ->and(array_column($page, 'addedTime'))->toBe([3, 4]);
});

it('etykieta części wynika z liczby części, nie ze sportu', function (string $sport, array $periods, string $label) {
    $tournament = matchPageTournament($sport, $periods);
    $match = matchPageMatch($tournament);
    $player = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    matchPageEvents($match, [[$player, $sport === 'basketball' ? 'foul' : 'yellow_card', $periods[1] + 1]]);

    expect(matchPage($tournament, $match)['periods'][0]['label'])->toBe($label);
})->with([
    'kosz w połowach' => ['basketball', [2, 20], '2. połowa'],
    'piłka w tercjach' => ['football', [3, 20], '2. tercja'],
    'kosz w kwartach' => ['basketball', [4, 10], '2. kwarta'],
    'pięć części' => ['football', [5, 10], '2. część'],
]);

it('turniej bez podziału nie ma części, a żadne zdarzenie nie ma numeru części', function () {
    $tournament = matchPageTournament('basketball', [1, null]);
    $match = matchPageMatch($tournament, ['home_score' => 2, 'away_score' => 0]);
    $player = matchPagePlayer($tournament, 'Orły Bielany', 'Kacper Lipa');
    matchPageEvents($match, [[$player, 'two_pointer', 5], [$player, 'foul', 30], [$player, 'foul', null]]);

    $page = matchPage($tournament, $match);

    expect($page['periods'])->toBe([])
        ->and(array_column($page['events'], 'period'))->toBe([null, null, null])
        ->and($page['events'][0]['scoreAfter'])->toBe(['home' => 2, 'away' => 0]);
});

it('zmiana podziału turnieju przelicza części zapisanych zdarzeń przy następnym odczycie', function () {
    $tournament = matchPageTournament('basketball', [4, 10]);
    $match = matchPageMatch($tournament);
    $player = matchPagePlayer($tournament, 'Orły Bielany', 'Kacper Lipa');
    matchPageEvents($match, [[$player, 'foul', 15], [$player, 'foul', 35]]);

    expect(array_column(matchPage($tournament, $match)['events'], 'period'))->toBe([2, 4]);

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", ['periods' => ['count' => 2, 'minutes' => 20]])
        ->assertOk();

    $page = matchPage($tournament->fresh(), $match);

    expect(array_column($page['events'], 'period'))->toBe([1, 2])
        ->and(array_column($page['periods'], 'label'))->toBe(['1. połowa', '2. połowa'])
        ->and(MatchEvent::where('match_id', $match->id)->pluck('minute')->all())->toBe([15, 35]);
});

// --- wynik po zdarzeniu ------------------------------------------------------

it('samobój podnosi wynik przeciwnika, a kartka nie zmienia wyniku', function () {
    $tournament = matchPageTournament();
    $match = matchPageMatch($tournament, ['home_score' => 1, 'away_score' => 2]);
    $home = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $away = matchPagePlayer($tournament, 'Sokoły Ursus', 'Adam Zieliński');
    matchPageEvents($match, [
        [$home, 'goal', 10],
        [$home, 'own_goal', 20],
        [$away, 'yellow_card', 30],
        [$away, 'goal', 40],
        [$away, 'red_card', 50],
    ]);

    expect(array_column(matchPage($tournament, $match)['events'], 'scoreAfter'))->toBe([
        ['home' => 1, 'away' => 0],
        ['home' => 1, 'away' => 1],
        null,
        ['home' => 1, 'away' => 2],
        null,
    ]);
});

it('w koszu rzut dodaje swoją wartość, a faul nie zmienia wyniku', function () {
    $tournament = matchPageTournament('basketball');
    $match = matchPageMatch($tournament, ['home_score' => 5, 'away_score' => 1]);
    $home = matchPagePlayer($tournament, 'Orły Bielany', 'Kacper Lipa');
    $away = matchPagePlayer($tournament, 'Sokoły Ursus', 'Filip Sarna');
    matchPageEvents($match, [
        [$home, 'three_pointer', 1],
        [$away, 'foul', 2],
        [$away, 'free_throw', 3],
        [$home, 'two_pointer', 4],
    ]);

    expect(array_column(matchPage($tournament, $match)['events'], 'scoreAfter'))->toBe([
        ['home' => 3, 'away' => 0],
        null,
        ['home' => 3, 'away' => 1],
        ['home' => 5, 'away' => 1],
    ]);
});

it('suma zdarzeń różna od wyniku meczu daje null we wszystkich scoreAfter i wynikach części', function (int $homeScore, bool $consistent) {
    $tournament = matchPageTournament(periods: [2, 45]);
    $match = matchPageMatch($tournament, ['home_score' => $homeScore, 'away_score' => 1]);
    $home = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $away = matchPagePlayer($tournament, 'Sokoły Ursus', 'Adam Zieliński');
    matchPageEvents($match, [[$home, 'goal', 10], [$away, 'goal', 50], [$home, 'goal', 80]]);

    $page = matchPage($tournament, $match);

    if ($consistent) {
        expect(array_column($page['events'], 'scoreAfter'))->toBe([
            ['home' => 1, 'away' => 0], ['home' => 1, 'away' => 1], ['home' => 2, 'away' => 1],
        ])->and($page['periods'])->toBe([
            ['number' => 1, 'label' => '1. połowa', 'homeScore' => 1, 'awayScore' => 0],
            ['number' => 2, 'label' => '2. połowa', 'homeScore' => 1, 'awayScore' => 1],
        ]);
    } else {
        expect(array_column($page['events'], 'scoreAfter'))->toBe([null, null, null])
            ->and($page['periods'])->toBe([
                ['number' => 1, 'label' => '1. połowa', 'homeScore' => null, 'awayScore' => null],
                ['number' => 2, 'label' => '2. połowa', 'homeScore' => null, 'awayScore' => null],
            ]);
    }
})->with([
    'zgodna' => [2, true],
    'o bramkę za mało w zdarzeniach' => [3, false],
]);

it('zdobycz bez minuty liczy się do zgodności z wynikiem i do scoreAfter, ale nie do żadnej części', function () {
    $tournament = matchPageTournament(periods: [2, 45]);
    $match = matchPageMatch($tournament, ['home_score' => 2, 'away_score' => 0]);
    $home = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    matchPageEvents($match, [[$home, 'goal', null], [$home, 'goal', 30]]);

    $page = matchPage($tournament, $match);

    expect(array_map(fn (array $event): array => [$event['minute'], $event['scoreAfter']], $page['events']))->toBe([
        [30, ['home' => 1, 'away' => 0]],
        [null, ['home' => 2, 'away' => 0]],
    ])->and($page['periods'])->toBe([
        ['number' => 1, 'label' => '1. połowa', 'homeScore' => 1, 'awayScore' => 0],
    ]);
});

// --- lista części, kolejność, stany meczu --------------------------------------

it('periods zawiera tylko części ze zdarzeniami, rosnąco, z etykietą z liczby części', function () {
    $tournament = matchPageTournament('basketball', [4, 10]);
    $match = matchPageMatch($tournament, ['home_score' => 2, 'away_score' => 3]);
    $home = matchPagePlayer($tournament, 'Orły Bielany', 'Kacper Lipa');
    $away = matchPagePlayer($tournament, 'Sokoły Ursus', 'Filip Sarna');
    // Druga kwarta bez zdarzeń; zdarzenia zapisane nie po kolei.
    matchPageEvents($match, [[$away, 'three_pointer', 38], [$home, 'two_pointer', 4], [$away, 'foul', 25]]);

    expect(matchPage($tournament, $match)['periods'])->toBe([
        ['number' => 1, 'label' => '1. kwarta', 'homeScore' => 2, 'awayScore' => 0],
        ['number' => 3, 'label' => '3. kwarta', 'homeScore' => 0, 'awayScore' => 0],
        ['number' => 4, 'label' => '4. kwarta', 'homeScore' => 0, 'awayScore' => 3],
    ]);
});

it('mecz zaplanowany ma puste zdarzenia, części i strzelców', function () {
    $tournament = matchPageTournament();
    $match = matchPageMatch($tournament, ['status' => 'scheduled', 'home_score' => null, 'away_score' => null]);

    $page = matchPage($tournament, $match);

    expect($page['events'])->toBe([])
        ->and($page['periods'])->toBe([])
        ->and($page['scorers'])->toBe([])
        ->and($page['status'])->toBe('scheduled');
});

it('zdarzenia idą w kolejności GET /matches/{match}/events', function () {
    $tournament = matchPageTournament();
    $match = matchPageMatch($tournament);
    $home = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $away = matchPagePlayer($tournament, 'Sokoły Ursus', 'Adam Zieliński');
    matchPageEvents($match, [
        [$home, 'yellow_card', null],
        [$away, 'yellow_card', 70],
        [$home, 'yellow_card', 12],
        [$away, 'red_card', 70],
        [$away, 'yellow_card', null],
    ]);

    $admin = actingAsOrganizer($tournament->user)->getJson("/api/v1/matches/{$match->id}/events")->assertOk()->json('data');
    $public = matchPage($tournament, $match)['events'];

    expect(array_column($public, 'id'))->toBe(array_column($admin, 'id'))
        ->and(array_column($public, 'minute'))->toBe([12, 70, 70, null, null]);
});

it('mecz na żywo ma relację i strzelców z samobójem po stronie przeciwnika', function () {
    $tournament = matchPageTournament(periods: [2, 45]);
    $match = matchPageMatch($tournament, ['status' => 'live', 'home_score' => 1, 'away_score' => 1]);
    $home = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    matchPageEvents($match, [[$home, 'goal', 10], [$home, 'own_goal', 60]]);

    $page = matchPage($tournament, $match);

    expect($page['scorers'])->toHaveCount(2)
        ->and($page['scorers'][1]['ownGoal'])->toBeTrue()
        ->and($page['scorers'][1]['team']['name'])->toBe('Orły Bielany')
        ->and(array_column($page['events'], 'scoreAfter'))->toBe([['home' => 1, 'away' => 0], ['home' => 1, 'away' => 1]]);
});

// Guard nie pozwala usunąć zawodnika z meczem rozpoczętym, ale wiersz może
// powstać poza modelem (jak w `softDeleteTeamLeavingPlayers()`).
it('zawodnik usunięty miękko zostaje w relacji z nazwą', function () {
    $tournament = matchPageTournament();
    $match = matchPageMatch($tournament, ['home_score' => 1]);
    $home = matchPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    matchPageEvents($match, [[$home, 'goal', 10]]);
    Player::withoutEvents(fn () => $home->delete());

    $event = matchPage($tournament, $match)['events'][0];

    expect($event['player']['name'])->toBe('Marek Nowak')
        ->and($event['typeLabel'])->toBe('Bramka');
});

it('liczba zapytań nie rośnie z liczbą zdarzeń', function () {
    $tournament = matchPageTournament('basketball');
    $match = matchPageMatch($tournament);
    $players = [
        matchPagePlayer($tournament, 'Orły Bielany', 'Kacper Lipa'),
        matchPagePlayer($tournament, 'Sokoły Ursus', 'Filip Sarna'),
    ];
    $queries = function () use ($tournament, $match): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        matchPageGet($tournament, $match->id)->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    matchPageEvents($match, [[$players[0], 'two_pointer', 1]]);
    $match->update(['home_score' => 2]);
    $single = $queries();

    foreach (range(2, 21) as $minute) {
        matchPageEvents($match, [[$players[$minute % 2], 'free_throw', $minute], [matchPagePlayer($tournament, 'Orły Bielany', "Gracz {$minute}"), 'foul', $minute]]);
    }

    expect(matchPage($tournament, $match)['events'])->toHaveCount(41)
        ->and($queries())->toBe($single);
});

// #301: w siatkówce wynik to sety, a zdarzenia to wybrane akcje, więc żadne
// nie zmienia wyniku — także wtedy, gdy ich liczba przypadkiem równa się setom.
it('w siatkówce żadne zdarzenie nie zmienia wyniku, a mecz nie ma części', function () {
    $tournament = matchPageTournament('volleyball');
    $match = matchPageMatch($tournament, [
        'home_score' => 1,
        'away_score' => 0,
        'sets' => [['home' => 25, 'away' => 20]],
        'status' => 'live',
    ]);
    matchPageEvents($match, [[matchPagePlayer($tournament, 'Orły Bielany', 'Kamil Lis'), 'ace', null]]);

    $page = matchPage($tournament, $match);

    expect(array_column($page['events'], 'scoreAfter'))->toBe([null])
        ->and($page['periods'])->toBe([])
        ->and($page['sets'])->toBe([['home' => 25, 'away' => 20]])
        ->and($page['scorers'][0]['value'])->toBe(1);
});
