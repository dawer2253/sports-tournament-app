<?php

use App\Models\GameMatch;
use App\Models\Group;
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
| Strona publiczna turnieju (#206)
|--------------------------------------------------------------------------
|
| Trasy `/public/t/{slug}*` bez autoryzacji. Spectator asertuje samo ciało,
| więc walidator HTTP (ADR-0007) ma tu własne asercje — tak każe
| `backend/AGENTS.md`. Funkcje niżej lądują w globalnej przestrzeni nazw
| Pesta, stąd prefiks `publicPage`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** Ścieżki pod slugiem, które stoją w tym tickecie. */
const PUBLIC_PAGE_ROUTES = ['', '/standings', '/fixtures', '/results', '/leaderboard', '/teams'];

/** Opublikowany turniej z fazą ligową, dwiema kolejkami i dwiema drużynami. */
function publicPageTournament(string $status = 'active', string $sport = 'football', array $attributes = []): Tournament
{
    $factory = Tournament::factory();
    $tournament = match ($sport) {
        'basketball' => $factory->basketball(),
        'volleyball' => $factory->volleyball(),
        default => $factory,
    };
    $tournament = $tournament->create(['status' => $status, ...$attributes]);
    $stage = Stage::factory()->for($tournament)->create(['name' => 'Faza zasadnicza']);
    Round::factory()->for($stage)->create(['name' => 'Kolejka 1', 'order' => 1]);
    Round::factory()->for($stage)->create(['name' => 'Kolejka 2', 'order' => 2]);
    Team::factory()->for($tournament)->create(['name' => 'Orły Bielany']);
    Team::factory()->for($tournament)->create(['name' => 'Sokoły Ursus']);

    return $tournament;
}

/** Mecz Orły – Sokoły w kolejce o podanym `order`. */
function publicPageMatch(Tournament $tournament, int $round, array $attributes = []): GameMatch
{
    $roundModel = $tournament->stages()->firstOrFail()->rounds()->where('order', $round)->firstOrFail();

    return GameMatch::factory()->for($roundModel)->create([
        'match_number' => (int) GameMatch::where('round_id', $roundModel->id)->max('match_number') + 1,
        'home_team_id' => $tournament->teams()->where('name', 'Orły Bielany')->value('id'),
        'away_team_id' => $tournament->teams()->where('name', 'Sokoły Ursus')->value('id'),
        ...$attributes,
    ]);
}

/** Zawodnik drużyny turnieju o podanej nazwie. */
function publicPagePlayer(Tournament $tournament, string $team, string $name): Player
{
    return Player::factory()->create([
        'team_id' => $tournament->teams()->where('name', $team)->value('id'),
        'name' => $name,
    ]);
}

/**
 * Zdarzenia meczu: każda pozycja to `[zawodnik, typ]` albo `[zawodnik, typ,
 * minuta]`; bez minuty zostaje losowa z fabryki. Drużyna zdarzenia to
 * drużyna zawodnika, tak jak przy zapisie przez API (#188, reguła 7).
 *
 * @param  list<array{0: Player, 1: string, 2?: ?int}>  $events
 */
function publicPageEvents(GameMatch $match, array $events): void
{
    foreach ($events as $event) {
        [$player, $type] = $event;

        MatchEvent::factory()->create([
            'match_id' => $match->id,
            'team_id' => $player->team_id,
            'player_id' => $player->id,
            'type' => $type,
            ...(array_key_exists(2, $event) ? ['minute' => $event[2]] : []),
        ]);
    }
}

/**
 * Strzelcy meczu z `/fixtures` albo `/results` jako
 * `[nazwisko, drużyna, value, minutes, ownGoal]`, w kolejności z odpowiedzi.
 */
function publicPageScorers(Tournament $tournament, string $path, GameMatch $match): array
{
    $matches = publicPageGet($tournament->slug, $path)->assertValidResponse(200)->json('data');
    $found = array_values(array_filter($matches, fn (array $candidate): bool => $candidate['id'] === $match->id));

    expect($found)->toHaveCount(1);

    return array_map(fn (array $row): array => [
        $row['player']['name'], $row['team']['name'], $row['value'], $row['minutes'], $row['ownGoal'],
    ], $found[0]['scorers']);
}

/** Klasyfikacja jako `nazwisko => wartość`, w kolejności wierszy z odpowiedzi. */
function publicPageLeaderboard(Tournament $tournament, string $query = ''): array
{
    $rows = publicPageGet($tournament->slug, "/leaderboard{$query}")->assertValidResponse(200)->json('data.rows');

    return array_column(array_map(fn (array $row): array => [$row['player']['name'], $row['value']], $rows), 1, 0);
}

function publicPageGet(string $slug, string $path = '', array $headers = []): TestResponse
{
    return test()->getJson("/api/v1/public/t/{$slug}{$path}", $headers);
}

// --- turniej -----------------------------------------------------------------

it('oddaje turniej opublikowany w kształcie PublicTournament', function (string $status) {
    $tournament = publicPageTournament($status, attributes: ['name' => 'Liga Osiedlowa 2026', 'primary_color' => '#1F7A45']);

    publicPageGet($tournament->slug)
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', 'Liga Osiedlowa 2026')
        ->assertJsonPath('data.slug', $tournament->slug)
        ->assertJsonPath('data.status', $status)
        ->assertJsonPath('data.sport', ['id' => sport('football')->id, 'code' => 'football', 'name' => 'Piłka nożna', 'allowsDraw' => true])
        ->assertJsonPath('data.branding', ['logoUrl' => null, 'primaryColor' => '#1F7A45'])
        ->assertJsonPath('data.stages.*.name', ['Faza zasadnicza'])
        ->assertJsonPath('data.stats', [
            ['code' => 'goals', 'label' => 'Bramki'],
            ['code' => 'yellowCards', 'label' => 'Żółte kartki'],
            ['code' => 'redCards', 'label' => 'Czerwone kartki'],
        ]);
})->with(['active', 'finished']);

// #190, niezmiennik 9: lista statystyk to `availableStats` sportu, w tej samej
// kolejności, z etykietami ze `statLabels` — pierwszy wpis jest domyślny.
it('statystyki turnieju idą w kolejności availableStats sportu, z jego etykietami', function (string $code) {
    $tournament = publicPageTournament(sport: $code);
    $config = sport($code)->config;

    publicPageGet($tournament->slug)
        ->assertValidResponse(200)
        ->assertJsonPath('data.stats.*.code', $config['availableStats'])
        ->assertJsonPath('data.stats.*.label', array_map(fn (string $stat): string => $config['statLabels'][$stat], $config['availableStats']));
})->with(['football', 'basketball']);

it('szkic daje na każdej trasie ten sam 404 co nieznany slug', function (string $path) {
    $draft = publicPageTournament('draft');

    $unknown = publicPageGet('nie-ma-takiego-turnieju', $path)->assertNotFound()->assertValidResponse(404);
    $hidden = publicPageGet($draft->slug, $path)->assertNotFound()->assertValidResponse(404);

    expect($hidden->json())->toBe($unknown->json())
        ->and($hidden->json('message'))->toBe(contractErrorMessage('NotFound'));
})->with(PUBLIC_PAGE_ROUTES);

// --- walidator HTTP (ADR-0007) ------------------------------------------------

it('200 niesie ETag i Cache-Control z no-cache, a zgodny If-None-Match daje 304 z pustym ciałem', function (string $path) {
    $tournament = publicPageTournament();
    publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 2, 'away_score' => 1]);
    publicPageMatch($tournament, 2);

    $first = publicPageGet($tournament->slug, $path)->assertOk()->assertValidResponse(200);
    $etag = $first->headers->get('ETag');

    expect($etag)->toMatch('/^"[^"]+"$/')
        ->and($first->headers->get('Cache-Control'))->toMatch('/(^|,)\s*no-cache\s*(,|$)/');

    $repeated = publicPageGet($tournament->slug, $path, ['If-None-Match' => $etag])->assertStatus(304);

    expect($repeated->getContent())->toBe('')
        ->and($repeated->headers->get('ETag'))->toBe($etag);
})->with(PUBLIC_PAGE_ROUTES);

it('niezgodny If-None-Match daje pełną odpowiedź', function () {
    $tournament = publicPageTournament();

    publicPageGet($tournament->slug, '', ['If-None-Match' => '"nieaktualny"'])
        ->assertOk()
        ->assertJsonPath('data.slug', $tournament->slug);
});

it('404 nie niesie walidatora', function () {
    expect(publicPageGet('nie-ma-takiego-turnieju')->assertNotFound()->headers->has('ETag'))->toBeFalse();
});

it('bez zmiany w danych ETag zostaje, a zapis wyniku zmienia ETag tabeli i wyników', function () {
    $tournament = publicPageTournament();
    $match = publicPageMatch($tournament, 1);
    $etag = fn (string $path): ?string => publicPageGet($tournament->slug, $path)->assertOk()->headers->get('ETag');

    $standings = $etag('/standings');
    $results = $etag('/results');
    expect($etag('/standings'))->toBe($standings)
        ->and($etag('/results'))->toBe($results);

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['status' => 'finished', 'homeScore' => 2, 'awayScore' => 0])
        ->assertOk();

    expect($etag('/standings'))->not->toBe($standings)
        ->and($etag('/results'))->not->toBe($results);
});

// --- tabela ------------------------------------------------------------------

it('tabela niesie allowsDraw sportu i kryteria w kolejności turnieju z etykietami sportu', function () {
    $tournament = publicPageTournament(sport: 'basketball', attributes: ['tiebreakers' => ['points', 'score_diff', 'head_to_head']]);

    publicPageGet($tournament->slug, '/standings')
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.scoreLabel', 'Punkty')
        ->assertJsonPath('data.0.allowsDraw', false)
        ->assertJsonPath('data.0.tiebreakers', [
            ['code' => 'points', 'label' => 'Punkty w tabeli'],
            ['code' => 'score_diff', 'label' => 'Różnica punktów'],
            ['code' => 'head_to_head', 'label' => 'Bezpośredni mecz'],
        ])
        ->assertJsonPath('data.0.rows.*.team.name', ['Orły Bielany', 'Sokoły Ursus']);
});

it('tabela strony publicznej niesie formę jak panel, a drużyna bez meczów ma pustą', function () {
    $tournament = publicPageTournament();
    publicPageMatch($tournament, 2, ['status' => 'finished', 'home_score' => 0, 'away_score' => 1]);
    publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 2, 'away_score' => 2]);
    Team::factory()->for($tournament)->create(['name' => 'Wilki Bemowo']);

    $public = publicPageGet($tournament->slug, '/standings')
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.rows.*.team.name', ['Sokoły Ursus', 'Orły Bielany', 'Wilki Bemowo'])
        ->assertJsonPath('data.0.rows.*.form', [['draw', 'win'], ['draw', 'loss'], []]);

    $panel = actingAsOrganizer($tournament->user)->getJson("/api/v1/tournaments/{$tournament->id}/standings");

    expect($public->json('data.0.rows'))->toBe($panel->json('data.0.rows'));
});

// --- terminarz i wyniki ------------------------------------------------------

it('terminarz ma mecze zaplanowane i trwające, a wyniki wyłącznie zakończone, bez meczów innego turnieju', function () {
    $tournament = publicPageTournament();
    $scheduled = publicPageMatch($tournament, 2, ['kickoff_at' => '2026-10-18 10:00:00']);
    $live = publicPageMatch($tournament, 1, ['kickoff_at' => '2026-10-11 10:00:00', 'status' => 'live', 'home_score' => 1, 'away_score' => 0]);
    $finished = publicPageMatch($tournament, 1, ['kickoff_at' => '2026-10-04 10:00:00', 'status' => 'finished', 'home_score' => 2, 'away_score' => 2]);

    $other = publicPageTournament();
    publicPageMatch($other, 1, ['kickoff_at' => '2026-10-05 10:00:00']);
    publicPageMatch($other, 1, ['kickoff_at' => '2026-10-05 12:00:00', 'status' => 'finished', 'home_score' => 1, 'away_score' => 0]);

    publicPageGet($tournament->slug, '/fixtures')
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$live->id, $scheduled->id])
        ->assertJsonPath('data.*.status', ['live', 'scheduled']);

    publicPageGet($tournament->slug, '/results')
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$finished->id])
        ->assertJsonPath('data.0.homeScore', 2);
});

it('terminarz idzie rosnąco po terminie, a mecz bez terminu stoi na końcu', function () {
    $tournament = publicPageTournament();
    $undatedLater = publicPageMatch($tournament, 2, ['kickoff_at' => null]);
    $undatedEarlier = publicPageMatch($tournament, 1, ['kickoff_at' => null]);
    $late = publicPageMatch($tournament, 1, ['kickoff_at' => '2026-10-18 10:00:00']);
    $early = publicPageMatch($tournament, 2, ['kickoff_at' => '2026-10-11 10:00:00']);

    publicPageGet($tournament->slug, '/fixtures')
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$early->id, $late->id, $undatedEarlier->id, $undatedLater->id])
        ->assertJsonPath('data.3.kickoffAt', null);
});

it('wyniki idą malejąco po terminie, a mecz bez terminu stoi na końcu', function () {
    $tournament = publicPageTournament();
    $finished = ['status' => 'finished', 'home_score' => 1, 'away_score' => 0];
    $undatedEarlier = publicPageMatch($tournament, 1, ['kickoff_at' => null, ...$finished]);
    $undatedLater = publicPageMatch($tournament, 2, ['kickoff_at' => null, ...$finished]);
    $early = publicPageMatch($tournament, 2, ['kickoff_at' => '2026-10-04 10:00:00', ...$finished]);
    $late = publicPageMatch($tournament, 1, ['kickoff_at' => '2026-10-11 10:00:00', ...$finished]);

    publicPageGet($tournament->slug, '/results')
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$late->id, $early->id, $undatedLater->id, $undatedEarlier->id]);
});

// --- klasyfikacja (#190, #207) ------------------------------------------------

it('stat spoza availableStats sportu turnieju daje 422 pod stat', function (string $sport, string $stat) {
    $tournament = publicPageTournament(sport: $sport);

    publicPageGet($tournament->slug, "/leaderboard?stat={$stat}")
        ->assertValidResponse(422)
        ->assertOnlyJsonValidationErrors(['stat']);
})->with([
    'bramki w koszu' => ['basketball', 'goals'],
    'punkty w piłce' => ['football', 'points'],
    'nieznany kod' => ['football', 'assists'],
    'wielkość liter' => ['football', 'Goals'],
]);

it('bez stat oddaje pierwszą statystykę sportu z jej etykietą, a ze stat — wybraną', function () {
    $tournament = publicPageTournament(sport: 'basketball');

    publicPageGet($tournament->slug, '/leaderboard')
        ->assertValidResponse(200)
        ->assertJsonPath('data.stat', 'points')
        ->assertJsonPath('data.label', 'Punkty');

    publicPageGet($tournament->slug, '/leaderboard?stat=fouls')
        ->assertValidResponse(200)
        ->assertJsonPath('data.stat', 'fouls')
        ->assertJsonPath('data.label', 'Faule');
});

it('zdarzenie meczu live nie wchodzi do klasyfikacji, a po zakończeniu meczu wchodzi', function () {
    $tournament = publicPageTournament();
    $scorer = publicPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $match = publicPageMatch($tournament, 1, ['status' => 'live', 'home_score' => 1, 'away_score' => 0]);
    publicPageEvents($match, [[$scorer, 'goal']]);

    expect(publicPageLeaderboard($tournament))->toBe([]);

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 0])
        ->assertOk();

    expect(publicPageLeaderboard($tournament))->toBe(['Marek Nowak' => 1]);
});

it('kosz sumuje value rzutów, a faul liczy się tylko w faulach', function () {
    $tournament = publicPageTournament(sport: 'basketball');
    $shooter = publicPagePlayer($tournament, 'Orły Bielany', 'Oskar Dąb');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 4, 'away_score' => 0]);
    publicPageEvents($match, [[$shooter, 'free_throw'], [$shooter, 'three_pointer'], [$shooter, 'foul']]);

    expect(publicPageLeaderboard($tournament))->toBe(['Oskar Dąb' => 4])
        ->and(publicPageLeaderboard($tournament, '?stat=fouls'))->toBe(['Oskar Dąb' => 1]);
});

it('kartki liczą się sztuką, każda w swojej klasyfikacji', function () {
    $tournament = publicPageTournament();
    $player = publicPagePlayer($tournament, 'Orły Bielany', 'Tomasz Lis');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 0, 'away_score' => 0]);
    publicPageEvents($match, [[$player, 'yellow_card'], [$player, 'yellow_card'], [$player, 'red_card']]);

    expect(publicPageLeaderboard($tournament, '?stat=yellowCards'))->toBe(['Tomasz Lis' => 2])
        ->and(publicPageLeaderboard($tournament, '?stat=redCards'))->toBe(['Tomasz Lis' => 1])
        ->and(publicPageLeaderboard($tournament))->toBe([]);
});

it('samobój nie trafia do żadnej klasyfikacji', function () {
    $tournament = publicPageTournament();
    $player = publicPagePlayer($tournament, 'Sokoły Ursus', 'Tomasz Lis');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 1, 'away_score' => 0]);
    publicPageEvents($match, [[$player, 'own_goal']]);

    foreach (sport('football')->config['availableStats'] as $stat) {
        expect(publicPageLeaderboard($tournament, "?stat={$stat}"))->toBe([]);
    }
});

it('zawodnik bez zdarzeń danej statystyki nie ma wiersza, a turniej bez meczów zakończonych daje pustą listę', function () {
    $tournament = publicPageTournament();
    publicPagePlayer($tournament, 'Orły Bielany', 'Piotr Kowal');
    $carded = publicPagePlayer($tournament, 'Orły Bielany', 'Tomasz Lis');

    publicPageGet($tournament->slug, '/leaderboard')
        ->assertValidResponse(200)
        ->assertJsonPath('data.rows', []);

    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 0, 'away_score' => 0]);
    publicPageEvents($match, [[$carded, 'yellow_card']]);

    expect(publicPageLeaderboard($tournament))->toBe([])
        ->and(publicPageLeaderboard($tournament, '?stat=yellowCards'))->toBe(['Tomasz Lis' => 1]);
});

it('pozycja przy remisie jest dzielona, kolejna ją przeskakuje, a ex aequo idą po id zawodnika', function (array $values, array $positions) {
    $tournament = publicPageTournament();
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => array_sum($values), 'away_score' => 0]);

    // Nazwiska idą odwrotnie do id, a zdarzenia powstają od ostatniego
    // zawodnika, żeby kolejność ex aequo nie wyszła przypadkiem z nazwiska
    // ani z kolejności zapisu.
    $players = [];
    foreach ($values as $index => $value) {
        $players[] = publicPagePlayer($tournament, 'Orły Bielany', 'Zawodnik '.chr(ord('Z') - $index));
    }
    foreach (array_reverse(array_keys($values)) as $index) {
        publicPageEvents($match, array_fill(0, $values[$index], [$players[$index], 'goal']));
    }

    $rows = publicPageGet($tournament->slug, '/leaderboard')->assertValidResponse(200)->json('data.rows');

    expect(array_column($rows, 'value'))->toBe($values)
        ->and(array_column($rows, 'position'))->toBe($positions)
        ->and(array_column(array_column($rows, 'player'), 'id'))->toBe(array_map(fn (Player $player): int => $player->id, $players));
})->with([
    'remis na końcu' => [[4, 2, 1, 1, 1], [1, 2, 3, 3, 3]],
    'remis w środku' => [[4, 2, 2, 2, 1], [1, 2, 2, 2, 5]],
    'remis na czele' => [[3, 3, 1], [1, 1, 3]],
]);

it('zdarzenia z meczów innego turnieju nie wchodzą do klasyfikacji', function () {
    $tournament = publicPageTournament();
    $other = publicPageTournament();
    $outsider = publicPagePlayer($other, 'Orły Bielany', 'Rafał Duda');
    $match = publicPageMatch($other, 1, ['status' => 'finished', 'home_score' => 1, 'away_score' => 0]);
    publicPageEvents($match, [[$outsider, 'goal']]);

    expect(publicPageLeaderboard($tournament))->toBe([])
        ->and(publicPageLeaderboard($other))->toBe(['Rafał Duda' => 1]);
});

it('zdarzenie z meczu zakończonego w drugiej fazie wchodzi do tej samej klasyfikacji', function () {
    $tournament = publicPageTournament();
    $scorer = publicPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    publicPageEvents(publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 1, 'away_score' => 0]), [[$scorer, 'goal']]);

    $playoff = Stage::factory()->for($tournament)->create(['type' => 'knockout', 'name' => 'Faza pucharowa', 'order' => 2]);
    $final = GameMatch::factory()->for(Round::factory()->for($playoff)->create(['name' => 'Finał', 'order' => 1]))->create([
        'home_team_id' => $scorer->team_id,
        'away_team_id' => $tournament->teams()->where('name', 'Sokoły Ursus')->value('id'),
        'status' => 'finished',
        'home_score' => 2,
        'away_score' => 0,
    ]);
    publicPageEvents($final, [[$scorer, 'goal'], [$scorer, 'goal']]);

    expect(publicPageLeaderboard($tournament))->toBe(['Marek Nowak' => 3]);
});

it('zawodnik usunięty miękko zostaje z nazwiskiem, a zdarzenie bez zawodnika nie daje wiersza', function () {
    $tournament = publicPageTournament();
    $gone = publicPagePlayer($tournament, 'Orły Bielany', 'Jakub Wrona');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 2, 'away_score' => 0]);
    publicPageEvents($match, [[$gone, 'goal']]);
    MatchEvent::factory()->create(['match_id' => $match->id, 'team_id' => $gone->team_id, 'player_id' => null, 'type' => 'goal']);
    // Guard nie pozwala usunąć zawodnika ze zdarzeniami w meczu rozegranym,
    // więc stan ustawiamy z pominięciem zdarzeń modelu.
    Player::withoutEvents(fn () => $gone->delete());

    publicPageGet($tournament->slug, '/leaderboard')
        ->assertValidResponse(200)
        ->assertJsonPath('data.rows', [[
            'position' => 1,
            'player' => ['id' => $gone->id, 'name' => 'Jakub Wrona'],
            'team' => ['id' => $gone->team_id, 'name' => 'Orły Bielany', 'logoUrl' => null],
            'value' => 1,
        ]]);
});

it('team w wierszu to drużyna zdarzenia', function () {
    $tournament = publicPageTournament();
    $scorer = publicPagePlayer($tournament, 'Sokoły Ursus', 'Adam Zieliński');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 0, 'away_score' => 1]);
    publicPageEvents($match, [[$scorer, 'goal']]);

    publicPageGet($tournament->slug, '/leaderboard')
        ->assertValidResponse(200)
        ->assertJsonPath('data.rows.0.team.name', 'Sokoły Ursus');
});

it('nowe zdarzenie w meczu zakończonym zmienia ETag klasyfikacji', function () {
    $tournament = publicPageTournament();
    $scorer = publicPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 1, 'away_score' => 0]);
    $etag = fn (): ?string => publicPageGet($tournament->slug, '/leaderboard')->assertOk()->headers->get('ETag');

    $before = $etag();
    publicPageEvents($match, [[$scorer, 'goal']]);

    expect($etag())->not->toBe($before);
});

// --- strzelcy przy meczu (#208) -----------------------------------------------

it('samobój daje osobny wiersz z ownGoal i drużyną strzelca', function () {
    $tournament = publicPageTournament();
    $unlucky = publicPagePlayer($tournament, 'Sokoły Ursus', 'Tomasz Lis');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 1, 'away_score' => 1]);
    publicPageEvents($match, [[$unlucky, 'own_goal', 30], [$unlucky, 'goal', 70]]);

    expect(publicPageScorers($tournament, '/results', $match))->toBe([
        ['Tomasz Lis', 'Sokoły Ursus', 1, [30], true],
        ['Tomasz Lis', 'Sokoły Ursus', 1, [70], false],
    ]);
});

it('kosz sumuje value rzutów zawodnika w jeden wiersz', function () {
    $tournament = publicPageTournament(sport: 'basketball');
    $shooter = publicPagePlayer($tournament, 'Orły Bielany', 'Oskar Dąb');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 5, 'away_score' => 0]);
    publicPageEvents($match, [[$shooter, 'three_pointer', 12], [$shooter, 'two_pointer', 4]]);

    expect(publicPageScorers($tournament, '/results', $match))->toBe([
        ['Oskar Dąb', 'Orły Bielany', 5, [4, 12], false],
    ]);
});

it('zdarzenia spoza statystyki zdobyczy nie dają wierszy', function (string $sport, array $types) {
    $tournament = publicPageTournament(sport: $sport);
    $player = publicPagePlayer($tournament, 'Orły Bielany', 'Tomasz Lis');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 1, 'away_score' => 0]);
    publicPageEvents($match, array_map(fn (string $type): array => [$player, $type, 10], $types));

    expect(publicPageScorers($tournament, '/results', $match))->toBe([]);
})->with([
    'kartki' => ['football', ['yellow_card', 'red_card']],
    'faul' => ['basketball', ['foul']],
]);

it('bramka bez minuty zwiększa value, ale nie trafia do minutes', function () {
    $tournament = publicPageTournament();
    $scorer = publicPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 2, 'away_score' => 0]);
    publicPageEvents($match, [[$scorer, 'goal', null], [$scorer, 'goal', 23]]);

    expect(publicPageScorers($tournament, '/results', $match))->toBe([
        ['Marek Nowak', 'Orły Bielany', 2, [23], false],
    ]);
});

it('wiersze idą po pierwszej minucie, bez minut na końcu, a przy równości po id zawodnika', function () {
    $tournament = publicPageTournament();
    $undatedFirst = publicPagePlayer($tournament, 'Orły Bielany', 'Adam Bez');
    $late = publicPagePlayer($tournament, 'Orły Bielany', 'Jan Późny');
    $tieFirst = publicPagePlayer($tournament, 'Sokoły Ursus', 'Kamil Remis');
    $tieSecond = publicPagePlayer($tournament, 'Orły Bielany', 'Piotr Remis');
    $undatedSecond = publicPagePlayer($tournament, 'Sokoły Ursus', 'Rafał Bez');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 5, 'away_score' => 4]);
    publicPageEvents($match, [
        [$undatedSecond, 'goal', null],
        [$tieSecond, 'goal', 10],
        [$late, 'goal', 40],
        [$tieFirst, 'goal', 70],
        [$tieFirst, 'goal', 10],
        [$undatedFirst, 'goal', null],
        [$late, 'own_goal', 5],
    ]);

    expect(publicPageScorers($tournament, '/results', $match))->toBe([
        ['Jan Późny', 'Orły Bielany', 1, [5], true],
        ['Kamil Remis', 'Sokoły Ursus', 2, [10, 70], false],
        ['Piotr Remis', 'Orły Bielany', 1, [10], false],
        ['Jan Późny', 'Orły Bielany', 1, [40], false],
        ['Adam Bez', 'Orły Bielany', 1, [], false],
        ['Rafał Bez', 'Sokoły Ursus', 1, [], false],
    ]);
});

it('mecz live ma strzelców, a mecz zaplanowany pustą listę', function () {
    $tournament = publicPageTournament();
    $scorer = publicPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $live = publicPageMatch($tournament, 1, ['status' => 'live', 'home_score' => 1, 'away_score' => 0]);
    $scheduled = publicPageMatch($tournament, 2);
    publicPageEvents($live, [[$scorer, 'goal', 23]]);

    expect(publicPageScorers($tournament, '/fixtures', $live))->toBe([['Marek Nowak', 'Orły Bielany', 1, [23], false]])
        ->and(publicPageScorers($tournament, '/fixtures', $scheduled))->toBe([]);
});

it('zdarzenia jednego meczu nie trafiają do innego', function () {
    $tournament = publicPageTournament();
    $first = publicPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $second = publicPagePlayer($tournament, 'Sokoły Ursus', 'Adam Zieliński');
    $finished = ['status' => 'finished', 'home_score' => 1, 'away_score' => 0];
    $early = publicPageMatch($tournament, 1, $finished);
    $later = publicPageMatch($tournament, 2, $finished);
    publicPageEvents($early, [[$first, 'goal', 15]]);
    publicPageEvents($later, [[$second, 'own_goal', 60]]);

    expect(publicPageScorers($tournament, '/results', $early))->toBe([['Marek Nowak', 'Orły Bielany', 1, [15], false]])
        ->and(publicPageScorers($tournament, '/results', $later))->toBe([['Adam Zieliński', 'Sokoły Ursus', 1, [60], true]]);
});

it('strzelec usunięty miękko zostaje z nazwiskiem, a zdarzenie bez zawodnika nie daje wiersza', function () {
    $tournament = publicPageTournament();
    $gone = publicPagePlayer($tournament, 'Orły Bielany', 'Jakub Wrona');
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 2, 'away_score' => 0]);
    publicPageEvents($match, [[$gone, 'goal', 30]]);
    MatchEvent::factory()->create(['match_id' => $match->id, 'team_id' => $gone->team_id, 'player_id' => null, 'type' => 'goal', 'minute' => 10]);
    // Guard nie pozwala usunąć zawodnika ze zdarzeniami w meczu rozegranym,
    // więc stan ustawiamy z pominięciem zdarzeń modelu.
    Player::withoutEvents(fn () => $gone->delete());

    expect(publicPageScorers($tournament, '/results', $match))->toBe([['Jakub Wrona', 'Orły Bielany', 1, [30], false]]);
});

it('liczba zapytań przy liście meczów nie rośnie z liczbą meczów', function () {
    $tournament = publicPageTournament();
    $home = publicPagePlayer($tournament, 'Orły Bielany', 'Marek Nowak');
    $away = publicPagePlayer($tournament, 'Sokoły Ursus', 'Adam Zieliński');
    $addMatch = function () use ($tournament, $home, $away): void {
        $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 1, 'away_score' => 1]);
        publicPageEvents($match, [[$home, 'goal', 20], [$away, 'own_goal', 50]]);
    };
    $queries = function () use ($tournament): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        expect(publicPageGet($tournament->slug, '/results')->assertOk()->json('data.0.scorers'))->not->toBe([]);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $addMatch();
    $single = $queries();
    $addMatch();
    $addMatch();
    $addMatch();

    expect(publicPageGet($tournament->slug, '/results')->json('data'))->toHaveCount(4)
        ->and($queries())->toBe($single);
});

// --- zegar meczu (#297) -----------------------------------------------------------

it('turniej niesie podział meczu, długość meczu i runningClock sportu', function (string $sport, bool $running) {
    $tournament = publicPageTournament(sport: $sport);
    $tournament->update(['period_count' => 2, 'period_minutes' => 30, 'match_duration' => 75]);

    publicPageGet($tournament->slug)
        ->assertValidResponse(200)
        ->assertJsonPath('data.periods', ['count' => 2, 'minutes' => 30])
        ->assertJsonPath('data.matchDuration', 75)
        ->assertJsonPath('data.runningClock', $running);
})->with([
    'piłka' => ['football', true],
    'kosz' => ['basketball', false],
]);

it('turniej niesie format seta: siatkówka kopię z ustawień, piłka null (#302)', function (string $sport, ?array $format) {
    $tournament = publicPageTournament(sport: $sport);

    publicPageGet($tournament->slug)
        ->assertValidResponse(200)
        ->assertJsonPath('data.setFormat', $format);
})->with([
    'piłka' => ['football', null],
    'siatkówka' => ['volleyball', ['setsToWin' => 3, 'setPoints' => 25, 'decidingSetPoints' => 15, 'minLead' => 2]],
]);

it('terminarz, mecze fazy i strona meczu niosą część i start meczu trwającego', function () {
    $tournament = publicPageTournament();
    $match = publicPageMatch($tournament, 1, [
        'status' => 'live', 'home_score' => 1, 'away_score' => 0,
        'live_period' => 2, 'period_started_at' => '2026-09-27 10:55:00', 'on_break' => false,
    ]);
    $stageId = $tournament->stages()->value('id');

    $clock = ['livePeriod' => 2, 'periodStartedAt' => '2026-09-27T10:55:00+00:00', 'onBreak' => false];
    $pick = fn (array $row): array => array_intersect_key($row, $clock);

    expect($pick(publicPageGet($tournament->slug, '/fixtures')->assertValidResponse(200)->json('data.0')))->toBe($clock)
        ->and($pick(publicPageGet($tournament->slug, "/matches?stageId={$stageId}")->assertValidResponse(200)->json('data.0')))->toBe($clock)
        ->and($pick(publicPageGet($tournament->slug, "/matches/{$match->id}")->assertValidResponse(200)->json('data')))->toBe($clock);
});

it('mecz zakończony nie pokazuje części, którą baza pamięta na wypadek powrotu', function () {
    $tournament = publicPageTournament();
    $match = publicPageMatch($tournament, 1, ['status' => 'finished', 'home_score' => 1, 'away_score' => 0, 'live_period' => 2]);

    publicPageGet($tournament->slug, "/matches/{$match->id}")
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', null)
        ->assertJsonPath('data.periodStartedAt', null);
});

it('przerwa zmienia ETag: dawny If-None-Match dostaje 200, nie 304', function () {
    $tournament = publicPageTournament();
    $match = publicPageMatch($tournament, 1);
    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0])
        ->assertOk();
    $etag = publicPageGet($tournament->slug, '/fixtures')->assertOk()->headers->get('ETag');

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['periodRunning' => false])
        ->assertOk();

    publicPageGet($tournament->slug, '/fixtures', ['If-None-Match' => $etag])
        ->assertOk()
        ->assertJsonPath('data.0.onBreak', true);
});

// --- drużyny (#296) ------------------------------------------------------------

/** Nazwy drużyn z `/teams` w kolejności z odpowiedzi. */
function publicPageTeams(Tournament $tournament): array
{
    return array_column(publicPageGet($tournament->slug, '/teams')->assertValidResponse(200)->json('data'), 'name');
}

it('drużyny idą w kształcie TeamSummary, bez liczników, po id', function () {
    $tournament = publicPageTournament();
    [$orly, $sokoly] = $tournament->teams()->orderBy('id')->get()->all();

    publicPageGet($tournament->slug, '/teams')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertExactJson(['data' => [
            ['id' => $orly->id, 'name' => 'Orły Bielany', 'logoUrl' => null],
            ['id' => $sokoly->id, 'name' => 'Sokoły Ursus', 'logoUrl' => null],
        ]]);
});

it('drużyna usunięta i drużyna innego turnieju nie wchodzą', function () {
    $tournament = publicPageTournament();
    Team::factory()->for($tournament)->create(['name' => 'Wilki Bemowo'])->delete();
    Team::factory()->for(publicPageTournament())->create(['name' => 'Żubry Praga']);

    expect(publicPageTeams($tournament))->toBe(['Orły Bielany', 'Sokoły Ursus']);
});

it('w turnieju z grupami wchodzi też drużyna bez grupy', function () {
    $tournament = Tournament::factory()->create(['status' => 'active']);
    $group = Group::factory()->for(Stage::factory()->group()->for($tournament))->create(['name' => 'Grupa A']);
    Team::factory()->for($tournament)->create(['name' => 'Lwy Ochota', 'group_id' => $group->id]);
    Team::factory()->for($tournament)->create(['name' => 'Rysie Wola', 'group_id' => null]);

    expect(publicPageTeams($tournament))->toBe(['Lwy Ochota', 'Rysie Wola']);
});

it('turniej bez drużyn daje pustą listę', function () {
    $tournament = Tournament::factory()->create(['status' => 'active']);

    publicPageGet($tournament->slug, '/teams')->assertValidResponse(200)->assertExactJson(['data' => []]);
});
