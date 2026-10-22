<?php

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use Database\Seeders\DemoTournamentSeeder;
use Database\Seeders\TeamAdminsSeeder;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\Yaml\Yaml;

/*
|--------------------------------------------------------------------------
| Dane demo
|--------------------------------------------------------------------------
|
| Seed demo jest drugą — obok mocka Prisma — implementacją tych samych danych,
| więc każda wartość niżej jest przepisana z przykładów w `openapi.yaml`
| i rozjazd z nimi jest błędem seedera, nie testu. Dlaczego akurat takie dane,
| tłumaczy docblock `DemoTournamentSeeder`.
|
| Kalkulator tabeli wchodzi w S1 — do tego czasu test pilnuje danych
| wejściowych, z których tabela ma się policzyć.
|
*/

beforeEach(function () {
    $this->seed(DemoTournamentSeeder::class);
});

it('daje Julii i Wojciechowi konta z własnymi kopiami tych samych turniejów co Dawid', function () {
    $this->seed(TeamAdminsSeeder::class);

    $dawid = Tournament::query()->whereRelation('user', 'email', 'dawid@example.com')->count();

    foreach (['julia' => 'julia@example.com', 'wojciech' => 'wojciech@example.com'] as $key => $email) {
        $user = User::firstWhere('email', $email);

        expect($user)->not->toBeNull()
            ->and(Hash::check('tajnehaslo123', $user->password))->toBeTrue()
            ->and(Tournament::where('user_id', $user->id)->count())->toBe($dawid);

        $tournament = Tournament::firstWhere('slug', "liga-osiedlowa-2026-{$key}");

        expect($tournament->user_id)->toBe($user->id)
            ->and($tournament->teams()->count())->toBe(3)
            ->and($tournament->matches()->count())->toBe(6);
    }
});

it('sieje kompletny turniej demo z organizerem, fazą i drużynami', function () {
    $tournament = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');

    expect($tournament)->not->toBeNull()
        ->and($tournament->name)->toBe('Liga Osiedlowa 2026')
        ->and($tournament->status)->toBe('active')
        ->and($tournament->primary_color)->toBe('#1F7A45')
        ->and($tournament->sport->code)->toBe('football')
        ->and($tournament->points)->toBe($tournament->sport->defaultPoints())
        ->and($tournament->tiebreakers)->toBe($tournament->sport->defaultTiebreakers())
        ->and($tournament->user->email)->toBe('dawid@example.com')
        ->and($tournament->stages()->count())->toBe(1)
        ->and($tournament->stages()->first()->type)->toBe('league')
        ->and($tournament->teams()->orderBy('id')->pluck('name')->all())
        ->toBe(['Wilki Bemowo', 'Sokoły Ursus', 'Orły Bielany'])
        ->and($tournament->venues()->orderBy('id')->pluck('name')->all())
        ->toBe(['Boisko Bemowo', 'Hala Ursus']);
});

it('sieje pierwszą rundę rozegraną i rewanże w terminarzu', function () {
    $tournament = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');

    $results = $tournament->matches()
        ->where('matches.status', 'finished')
        ->with(['homeTeam', 'awayTeam'])
        ->orderBy('kickoff_at')
        ->get()
        ->map(fn (GameMatch $match) => sprintf(
            '%s %d:%d %s',
            $match->homeTeam->name, $match->home_score, $match->away_score, $match->awayTeam->name,
        ))
        ->all();

    expect($results)->toBe([
        'Wilki Bemowo 2:1 Sokoły Ursus',
        'Orły Bielany 0:3 Wilki Bemowo',
        'Sokoły Ursus 2:1 Orły Bielany',
    ])
        ->and($tournament->matches()->where('matches.status', 'scheduled')->count())->toBe(2)
        ->and($tournament->matches()->where('matches.status', 'live')->count())->toBe(1)
        ->and($tournament->matches()->whereNull('home_score')->where('matches.status', 'finished')->count())->toBe(0)
        // Ostatnia kolejka jest bez obiektu — `venue` jest w kontrakcie
        // opcjonalne i demo ma pokazywać także ten przypadek.
        ->and($tournament->matches()->whereNull('venue_id')->count())->toBe(1);
});

it('sieje mecz trwający w 2. połowie, zaczętej przed seedowaniem, jak przykład pilka terminarza (#297)', function () {
    $live = Tournament::firstWhere('slug', 'liga-osiedlowa-2026')
        ->matches()
        ->where('matches.status', 'live')
        ->with(['round', 'homeTeam', 'awayTeam'])
        ->sole();

    expect([$live->round->order, $live->homeTeam->name, $live->home_score, $live->away_score, $live->awayTeam->name])
        ->toBe([4, 'Sokoły Ursus', 1, 0, 'Wilki Bemowo'])
        ->and($live->live_period)->toBe(2)
        ->and($live->on_break)->toBeFalse()
        ->and($live->period_started_at->isPast())->toBeTrue()
        // Tuż po seedowaniu 2. połowa trwa ok. 20 minut, więc tablica pokazuje ok. 66′.
        ->and((int) $live->period_started_at->diffInMinutes(now()))->toBe(20);

    $this->getJson('/api/v1/public/t/liga-osiedlowa-2026/fixtures')
        ->assertOk()
        ->assertJsonPath('data.0.livePeriod', 2)
        ->assertJsonPath('data.0.scorers.0.minutes', [['minute' => 38, 'addedTime' => null]]);
});

it('sieje zdarzenia meczowe zgodne z wynikami', function () {
    // Klasyfikacja strzelców liczy się ze zdarzeń, a tabela z wyniku meczu.
    // Gdyby seed dawał inną liczbę bramek niż wynik, strona publiczna
    // pokazywałaby dwie sprzeczne prawdy o tym samym meczu. Samobój należy do
    // drużyny strzelca, a bramkę daje przeciwnikowi (#188, reguła 9).
    $matches = Tournament::firstWhere('slug', 'liga-osiedlowa-2026')
        ->matches()
        ->where('matches.status', 'finished')
        ->get();

    foreach ($matches as $match) {
        $count = fn (int $teamId, string $type) => MatchEvent::query()
            ->where('match_id', $match->id)
            ->where('team_id', $teamId)
            ->where('type', $type)
            ->count();
        $goals = fn (int $teamId, int $opponentId) => $count($teamId, 'goal') + $count($opponentId, 'own_goal');

        expect($goals($match->home_team_id, $match->away_team_id))->toBe($match->home_score)
            ->and($goals($match->away_team_id, $match->home_team_id))->toBe($match->away_score);
    }

    // Seed pokazuje samobój, więc panel ma go na czym wyświetlić.
    expect(MatchEvent::query()->where('type', 'own_goal')->count())->toBe(1);
});

it('sieje zdarzenia meczu 1 dokładnie takie, jak przykład pilka w kontrakcie', function () {
    // Spectator waliduje schemat, nie przykład (`backend/AGENTS.md`), więc
    // zgodność z przykładem sprawdzamy wprost. Bez `id` drużyn, zawodników
    // i zdarzeń: autoinkrement w bazie testowej nie zeruje się między testami.
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $promised = $spec['paths']['/matches/{match}/events']['get']['responses']['200']['content']['application/json']['examples']['pilka']['value']['data'];

    $tournament = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');
    $match = $tournament->matches()->where('rounds.order', 1)->join('rounds', 'rounds.id', '=', 'matches.round_id')->select('matches.*')->firstOrFail();

    $withoutIds = fn (array $events): array => array_map(fn (array $event): array => [
        'team' => $event['team']['name'],
        'player' => $event['player']['name'],
        'type' => $event['type'],
        'typeLabel' => $event['typeLabel'],
        'minute' => $event['minute'],
    ], $events);

    $actual = actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/matches/{$match->id}/events")
        ->assertOk()
        ->json('data');

    expect($withoutIds($actual))->toBe($withoutIds($promised));
});

it('sieje rzuty koszykarskie, których value sumuje się do wyniku meczu', function () {
    // Klasyfikacja „Punkty” to suma `value` rzutów (#190), a tabela liczy się
    // z wyniku. API zgodności nie wymaga, ale demo bez niej wyglądałoby na
    // zepsute.
    $tournament = Tournament::firstWhere('slug', 'liga-koszykowki-2026');
    $values = collect($tournament->sport->config['eventTypes'])
        ->where('stat', 'points')
        ->pluck('value', 'code');
    $matches = $tournament->matches()->where('matches.status', 'finished')->get();

    expect($matches)->toHaveCount(2);

    foreach ($matches as $match) {
        $points = fn (int $teamId) => MatchEvent::query()
            ->where('match_id', $match->id)
            ->where('team_id', $teamId)
            ->whereIn('type', $values->keys())
            ->get()
            ->sum(fn (MatchEvent $event) => $values[$event->type]);

        expect($points($match->home_team_id))->toBe($match->home_score)
            ->and($points($match->away_team_id))->toBe($match->away_score);

        // Każdy zawodnik należy do drużyny swojego zdarzenia (#188, reguła 7).
        expect($match->events()->with('player')->get()->every(
            fn (MatchEvent $event) => $event->player->team_id === $event->team_id,
        ))->toBeTrue();
    }

    expect(MatchEvent::query()->whereIn('match_id', $matches->pluck('id'))->where('type', 'foul')->count())->toBeGreaterThan(0);
});

it('sieje klasyfikację zgodną z przykładem kontraktu', function (string $slug, string $example) {
    // Porównujemy komplet wierszy, nie czołówkę: obcięcie przepuściłoby
    // zdarzenie dorzucone komukolwiek dalej w stawce. Bez `id`, bo
    // autoinkrement w bazie testowej nie zeruje się między testami — kolejność
    // ex aequo po `player.id` i tak widać w kolejności nazwisk.
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $promised = $spec['paths']['/public/t/{slug}/leaderboard']['get']['responses']['200']['content']['application/json']['examples'][$example]['value']['data'];

    $withoutIds = fn (array $leaderboard): array => [
        'stat' => $leaderboard['stat'],
        'label' => $leaderboard['label'],
        'rows' => array_map(fn (array $row): string => "{$row['position']}. {$row['player']['name']} ({$row['team']['name']}) {$row['value']}", $leaderboard['rows']),
    ];

    $actual = $this->getJson("/api/v1/public/t/{$slug}/leaderboard")->assertOk()->json('data');

    expect($withoutIds($actual))->toBe($withoutIds($promised));
})->with([
    'piłka' => ['liga-osiedlowa-2026', 'pilka'],
    'koszykówka' => ['liga-koszykowki-2026', 'koszykowka'],
]);

it('liga koszykówki daje w klasyfikacji punktów sumę równą sumie wyników meczów', function () {
    $tournament = Tournament::firstWhere('slug', 'liga-koszykowki-2026');
    $scored = $tournament->matches()->where('matches.status', 'finished')->get()
        ->sum(fn (GameMatch $match): int => $match->home_score + $match->away_score);

    $rows = $this->getJson('/api/v1/public/t/liga-koszykowki-2026/leaderboard?stat=points')->assertOk()->json('data.rows');

    expect($scored)->toBeGreaterThan(0)
        ->and(array_sum(array_column($rows, 'value')))->toBe($scored);
});

it('sieje mecze o terminach zgodnych z kontraktem', function () {
    // Aplikacja stoi na UTC i tak samo pisze terminy kontrakt. Test pilnuje
    // chwili, nie zapisu: rozjazd o dwie godziny pokazywałby inną godzinę meczu
    // na stronie niż na mocku. Druga asercja zostaje mimo zgodnego już zapisu,
    // bo trzyma widoczny związek z południem czasu polskiego — godziną, na
    // którą mecz jest naprawdę umówiony i którą zobaczy kibic.
    $first = Tournament::firstWhere('slug', 'liga-osiedlowa-2026')
        ->matches()
        ->orderBy('kickoff_at')
        ->first();

    expect($first->kickoff_at->toIso8601String())->toBe('2026-09-06T10:00:00+00:00')
        ->and($first->kickoff_at->equalTo(new DateTimeImmutable('2026-09-06T12:00:00+02:00')))->toBeTrue();
});

it('nie dubluje danych demo przy powtórnym seedowaniu', function () {
    // `make fresh` robi `migrate:fresh --seed`, ale `db:seed` na stojącej bazie
    // to normalny ruch przy pracy nad seedem — drugi turniej o tym samym slugu
    // wywaliłby się na unikacie.
    $this->seed(DemoTournamentSeeder::class);

    $demo = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');

    // Poddrzewo powstaje od nowa pod nowymi id (autoinkrement, patrz docblock
    // seedera), więc pilnujemy, że stare nie zostało obok: po jednej fazie
    // na turniej, a w turnieju z grupami dwie (3 + 2 kolejki, 12 + 4 mecze);
    // turniej z zapisami ma fazę bez kolejek, a liga siatkówki (#301) trzy
    // kolejki po dwa mecze.
    expect(Tournament::query()->where('slug', 'liga-osiedlowa-2026')->count())->toBe(1)
        ->and(Stage::query()->count())->toBe(7)
        ->and(Round::query()->count())->toBe(19)
        ->and(GameMatch::query()->count())->toBe(36)
        ->and($demo->matches()->count())->toBe(6);
});

it('sieje ligę koszykówki zgodną z przykładem koszykowka', function () {
    $tournament = Tournament::firstWhere('slug', 'liga-koszykowki-2026');

    expect($tournament)->not->toBeNull()
        ->and($tournament->sport->code)->toBe('basketball')
        ->and($tournament->status)->toBe('active')
        ->and($tournament->points)->toBe($tournament->sport->defaultPoints())
        ->and($tournament->user->email)->toBe('dawid@example.com')
        ->and($tournament->stages()->first()->type)->toBe('league')
        ->and($tournament->teams()->orderBy('id')->pluck('name')->all())->toBe(['Żubry Wola', 'Rysie Mokotów'])
        ->and($tournament->matches()->where('matches.status', 'finished')->count())->toBe(2);

    // Tabelę liczy kalkulator, więc zgodność z przykładem `koszykowka`
    // (`scoreFor` 168:141, punkty 4 i 2) jest wynikiem danych seeda,
    // a nie przepisaną liczbą.
    $standings = actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/standings")
        ->assertOk();

    expect($standings->json('data.0.scoreLabel'))->toBe('Punkty')
        ->and($standings->json('data.0.rows.*.team.name'))->toBe(['Żubry Wola', 'Rysie Mokotów'])
        ->and($standings->json('data.0.rows.*.played'))->toBe([2, 2])
        ->and($standings->json('data.0.rows.*.scoreFor'))->toBe([168, 141])
        ->and($standings->json('data.0.rows.*.scoreAgainst'))->toBe([141, 168])
        ->and($standings->json('data.0.rows.*.points'))->toBe([4, 2]);
});

it('nie dubluje ligi koszykówki przy powtórnym seedowaniu', function () {
    $this->seed(DemoTournamentSeeder::class);

    expect(Tournament::query()->where('slug', 'liga-koszykowki-2026')->count())->toBe(1)
        ->and(Tournament::firstWhere('slug', 'liga-koszykowki-2026')->stages()->count())->toBe(1);
});

it('odrzuca remis na meczu finished z seeda koszykarskiego pod homeScore', function () {
    $tournament = Tournament::firstWhere('slug', 'liga-koszykowki-2026');
    $match = $tournament->matches()->where('matches.status', 'finished')->firstOrFail();

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", ['status' => 'finished', 'homeScore' => 80, 'awayScore' => 80])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('homeScore');
});

// Od kiedy organizer może założyć turniej przez API, baza deweloperska ma
// turnieje spoza demo — także założone, zanim ktokolwiek uruchomił seed, więc
// zajmujące najniższe id. Demo nadawało kiedyś fazie, kolejkom i meczom id
// 1–6 na sztywno i padało wtedy na duplikacie klucza.
//
// `beforeEach` zasiał już demo, więc test najpierw je usuwa (zapytaniem, bo
// guard rozegranych meczów słusznie nie pozwala skasować modelu; poddrzewo
// schodzi kaskadą). Id są wymuszone, bo autoinkrement w bazie testowej nie
// wraca do jedynki między testami i bez tego kolizja by się nie pojawiła.
it('sieje demo obok turnieju organizera, który zajął najniższe id', function () {
    Tournament::query()->where('slug', 'liga-osiedlowa-2026')->delete();

    $other = Tournament::factory()->create(['slug' => 'turniej-organizera']);
    $stage = Stage::factory()->for($other)->create(['id' => 1]);
    $round = Round::factory()->for($stage)->create(['id' => 1]);
    [$home, $away] = Team::factory()->count(2)->for($other)->create();
    GameMatch::factory()->create([
        'id' => 1,
        'stage_id' => $stage->id,
        'round_id' => $round->id,
        'home_team_id' => $home->id,
        'away_team_id' => $away->id,
    ]);

    $this->seed(DemoTournamentSeeder::class);

    $demo = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');

    expect($demo->matches()->count())->toBe(6)
        ->and($demo->stages()->count())->toBe(1)
        ->and($other->stages()->pluck('id')->all())->toBe([1])
        ->and($other->matches()->pluck('matches.id')->all())->toBe([1]);
});

/**
 * Mecze fazy jako napisy bez id: krawędź wskazuje mecz docelowy jego
 * pozycją (`runda.numer`), bo id w bazie testowej nie wracają do jedynki.
 *
 * @param  list<array<string, mixed>>  $matches  `Match` z kontraktu
 * @return list<string>
 */
function demoSeedCupMatches(array $matches): array
{
    $position = fn (?int $id): string => $id === null ? '–' : (function () use ($matches, $id): string {
        $target = collect($matches)->firstWhere('id', $id);

        return "{$target['round']['order']}.{$target['matchNumber']}";
    })();

    return collect($matches)
        ->sortBy(fn (array $match): string => sprintf('%02d.%02d', $match['round']['order'], $match['matchNumber']))
        ->map(fn (array $match): string => implode(' | ', [
            "{$match['round']['name']} ({$match['round']['order']}) {$match['matchNumber']}",
            ($match['homeTeam']['name'] ?? '–').' – '.($match['awayTeam']['name'] ?? '–'),
            "{$match['status']} ".json_encode([$match['homeScore'], $match['awayScore'], $match['homePenalties'], $match['awayPenalties']]),
            (string) $match['kickoffAt'],
            "zwycięzca → {$position($match['winnerToMatchId'])}, przegrany → {$position($match['loserToMatchId'])}, {$match['advancesToSlot']}",
        ]))
        ->values()
        ->all();
}

it('sieje puchar zgodny z przykładem puchar meczów fazy', function () {
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $promised = $spec['paths']['/public/t/{slug}/matches']['get']['responses']['200']['content']['application/json']['examples']['puchar']['value']['data'];

    $tournament = Tournament::firstWhere('slug', 'puchar-osiedlowy-2026');
    $stage = $tournament->stages()->sole();

    $actual = $this->getJson("/api/v1/public/t/puchar-osiedlowy-2026/matches?stageId={$stage->id}")->assertOk()->json('data');

    expect($tournament->name)->toBe('Puchar Osiedlowy 2026')
        ->and($tournament->status)->toBe('active')
        ->and($tournament->sport->code)->toBe('football')
        ->and($stage->type)->toBe('knockout')
        ->and($tournament->teams()->count())->toBe(6)
        ->and(demoSeedCupMatches($actual))->toBe(demoSeedCupMatches($promised))
        ->and(MatchEvent::query()->whereIn('match_id', array_column($actual, 'id'))->count())->toBe(0);
});

it('nie dubluje pucharu przy powtórnym seedowaniu', function () {
    $this->seed(DemoTournamentSeeder::class);

    $tournament = Tournament::firstWhere('slug', 'puchar-osiedlowy-2026');

    expect(Tournament::query()->where('slug', 'puchar-osiedlowy-2026')->count())->toBe(1)
        ->and($tournament->stages()->count())->toBe(1)
        ->and($tournament->teams()->count())->toBe(6)
        ->and($tournament->matches()->count())->toBe(6);
});

/**
 * Przykład `grupy` z kontraktu dla publicznej trasy: `data` odpowiedzi.
 *
 * @return array<int|string, mixed>
 */
function demoSeedGroupsExample(string $path): array
{
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');

    return $spec['paths'][$path]['get']['responses']['200']['content']['application/json']['examples']['grupy']['value']['data'];
}

/**
 * Mecze listy (`/fixtures`, `/results`) jako napisy bez id: grupa idzie nazwą
 * z faz turnieju, a krawędzi drabinki nie ma, bo lista nie niesie meczów, na
 * które wskazują — te sprawdza test drabinki.
 *
 * @param  list<array<string, mixed>>  $matches  `PublicMatch` z kontraktu
 * @param  list<array<string, mixed>>  $stages  `PublicTournament.stages`
 * @return list<string>
 */
function demoSeedGroupListMatches(array $matches, array $stages): array
{
    $groupNames = collect($stages)->flatMap(fn (array $stage): array => $stage['groups'])->pluck('name', 'id');

    return array_map(fn (array $match): string => implode(' | ', [
        "{$match['round']['name']} {$match['matchNumber']}",
        $match['groupId'] === null ? 'playoff' : $groupNames[$match['groupId']],
        ($match['homeTeam']['name'] ?? '–').' – '.($match['awayTeam']['name'] ?? '–'),
        "{$match['status']} ".json_encode([$match['homeScore'], $match['awayScore']]),
        (string) $match['kickoffAt'],
    ]), $matches);
}

/**
 * Tabele grup jako napisy bez id drużyn.
 *
 * @param  list<array<string, mixed>>  $tables  `StandingTable` z kontraktu
 * @return list<string>
 */
function demoSeedGroupTables(array $tables): array
{
    return collect($tables)->flatMap(fn (array $table): array => array_map(
        fn (array $row): string => sprintf(
            '%s/%s %d. %s %d %d-%d-%d %d:%d %d',
            $table['stageName'], $table['groupName'], $row['position'], $row['team']['name'],
            $row['played'], $row['won'], $row['drawn'], $row['lost'], $row['scoreFor'], $row['scoreAgainst'], $row['points'],
        ),
        $table['rows'],
    ))->all();
}

it('sieje turniej z grupami i playoffem zgodny z przykładem grupy turnieju', function () {
    $promised = demoSeedGroupsExample('/public/t/{slug}');

    $actual = $this->getJson('/api/v1/public/t/grupy-osiedlowe-2026')->assertOk()->json('data');

    $shape = fn (array $stages): array => array_map(fn (array $stage): array => [
        $stage['type'], $stage['name'], $stage['order'],
        array_map(fn (array $group): array => [$group['name'], $group['order'], $group['qualifiers']], $stage['groups']),
    ], $stages);

    expect($actual['name'])->toBe('Grupy Osiedlowe 2026')
        ->and($actual['sport']['code'])->toBe($promised['sport']['code'])
        ->and($shape($actual['stages']))->toBe($shape($promised['stages']))
        ->and(Tournament::firstWhere('slug', 'grupy-osiedlowe-2026')->teams()->whereNull('group_id')->count())->toBe(0);
});

it('sieje dwie tabele grup zgodne z przykładem grupy tabel', function () {
    $tables = $this->getJson('/api/v1/public/t/grupy-osiedlowe-2026/standings')->assertOk()->json('data');
    $stages = $this->getJson('/api/v1/public/t/grupy-osiedlowe-2026')->json('data.stages');

    expect(demoSeedGroupTables($tables))->toBe(demoSeedGroupTables(demoSeedGroupsExample('/public/t/{slug}/standings')))
        ->and(array_column($tables, 'groupId'))->toBe(array_column($stages[0]['groups'], 'id'));
});

it('sieje mecze grup z groupId i playoff zgodne z przykładami grupy terminarza i wyników', function () {
    $stages = $this->getJson('/api/v1/public/t/grupy-osiedlowe-2026')->json('data.stages');
    $fixtures = $this->getJson('/api/v1/public/t/grupy-osiedlowe-2026/fixtures')->assertOk()->json('data');
    $results = $this->getJson('/api/v1/public/t/grupy-osiedlowe-2026/results')->assertOk()->json('data');
    $promisedStages = demoSeedGroupsExample('/public/t/{slug}')['stages'];

    expect(demoSeedGroupListMatches($fixtures, $stages))
        ->toBe(demoSeedGroupListMatches(demoSeedGroupsExample('/public/t/{slug}/fixtures'), $promisedStages))
        ->and(demoSeedGroupListMatches($results, $stages))
        ->toBe(demoSeedGroupListMatches(demoSeedGroupsExample('/public/t/{slug}/results'), $promisedStages))
        ->and(collect($results)->whereNotNull('groupId')->count())->toBe(12);
});

it('sieje drabinkę playoffu zgodną z przykładem grupy meczów fazy', function () {
    $stage = Tournament::firstWhere('slug', 'grupy-osiedlowe-2026')->stages()->where('type', 'knockout')->sole();

    $actual = $this->getJson("/api/v1/public/t/grupy-osiedlowe-2026/matches?stageId={$stage->id}")->assertOk()->json('data');

    expect(demoSeedCupMatches($actual))->toBe(demoSeedCupMatches(demoSeedGroupsExample('/public/t/{slug}/matches')));
});

it('nie dubluje turnieju z grupami przy powtórnym seedowaniu', function () {
    $this->seed(DemoTournamentSeeder::class);

    $tournament = Tournament::firstWhere('slug', 'grupy-osiedlowe-2026');

    expect(Tournament::query()->where('slug', 'grupy-osiedlowe-2026')->count())->toBe(1)
        ->and($tournament->stages()->count())->toBe(2)
        ->and($tournament->stages()->where('type', 'group')->sole()->groups()->count())->toBe(2)
        ->and($tournament->teams()->count())->toBe(8)
        ->and($tournament->teams()->whereNull('group_id')->count())->toBe(0)
        ->and($tournament->matches()->count())->toBe(16);
});

// --- liga siatkówki (#301) ---------------------------------------------------

function demoSeedVolleyballExample(string $path): array
{
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');

    return $spec['paths'][$path]['get']['responses']['200']['content']['application/json']['examples']['siatkowka']['value']['data'];
}

/**
 * Mecze siatkówki jako napisy bez id: para, stan, sety wygrane i wyniki setów.
 *
 * @param  list<array<string, mixed>>  $matches
 * @return list<string>
 */
function demoSeedVolleyballMatches(array $matches): array
{
    return array_map(fn (array $match): string => implode(' | ', [
        "{$match['round']['name']} {$match['matchNumber']}",
        "{$match['homeTeam']['name']} – {$match['awayTeam']['name']}",
        "{$match['status']} ".json_encode([$match['homeScore'], $match['awayScore']]),
        implode(', ', array_map(fn (array $set): string => "{$set['home']}:{$set['away']}", $match['sets'])),
        (string) $match['kickoffAt'],
    ]), $matches);
}

/**
 * Wiersze tabeli siatkówki jako napisy bez id drużyn.
 *
 * @param  array<string, mixed>  $table
 * @return list<string>
 */
function demoSeedVolleyballRows(array $table): array
{
    return array_map(fn (array $row): string => sprintf(
        '%d. %s %d %d-%d sety %d:%d punkty w setach %d:%d pkt %d',
        $row['position'], $row['team']['name'], $row['played'], $row['won'], $row['lost'],
        $row['scoreFor'], $row['scoreAgainst'], $row['rallyPointsFor'], $row['rallyPointsAgainst'], $row['points'],
    ), $table['rows']);
}

it('sieje ligę siatkówki z tabelą zgodną z przykładem siatkowka: stosunek setów rozdziela Czaple i Mewy', function () {
    $tables = $this->getJson('/api/v1/public/t/liga-siatkowki-2026/standings')->assertOk()->json('data');
    $promised = demoSeedVolleyballExample('/public/t/{slug}/standings');

    expect(demoSeedVolleyballRows($tables[0]))->toBe(demoSeedVolleyballRows($promised[0]))
        ->and($tables[0]['scoreLabel'])->toBe('Sety')
        ->and($tables[0]['rallyPointsLabel'])->toBe('Punkty w setach')
        ->and(array_column($tables[0]['rows'], 'points'))->toBe([5, 3, 3, 1])
        ->and(array_column(array_column($tables[0]['rows'], 'team'), 'name'))
        ->toBe(['Orlęta Wawer', 'Czaple Ursynów', 'Mewy Żoliborz', 'Jaskółki Targówek']);
});

it('sieje mecze siatkówki zgodne z przykładami siatkowka wyników i terminarza', function () {
    $results = $this->getJson('/api/v1/public/t/liga-siatkowki-2026/results')->assertOk()->json('data');
    $fixtures = $this->getJson('/api/v1/public/t/liga-siatkowki-2026/fixtures')->assertOk()->json('data');

    expect(demoSeedVolleyballMatches($results))->toBe(demoSeedVolleyballMatches(demoSeedVolleyballExample('/public/t/{slug}/results')))
        ->and(demoSeedVolleyballMatches($fixtures))->toBe(demoSeedVolleyballMatches(demoSeedVolleyballExample('/public/t/{slug}/fixtures')));
});

it('sieje zdarzenia meczu 3 siatkówki zgodne z przykładem siatkowka strony meczu', function () {
    $tournament = Tournament::firstWhere('slug', 'liga-siatkowki-2026');
    $match = $tournament->matches()->where('matches.status', 'finished')->where('home_score', 3)->where('away_score', 2)->firstOrFail();
    $promised = demoSeedVolleyballExample('/public/t/{slug}/matches/{match}');

    $page = $this->getJson("/api/v1/public/t/liga-siatkowki-2026/matches/{$match->id}")->assertOk()->json('data');
    $events = fn (array $events): array => array_map(
        fn (array $event): string => "{$event['team']['name']} {$event['player']['name']} {$event['type']} ".json_encode($event['scoreAfter']),
        $events,
    );

    expect($events($page['events']))->toBe($events($promised['events']))
        ->and($page['sets'])->toBe($promised['sets'])
        ->and($page['periods'])->toBe([]);
});

it('nie dubluje ligi siatkówki przy powtórnym seedowaniu', function () {
    $this->seed(DemoTournamentSeeder::class);

    expect(Tournament::query()->where('slug', 'liga-siatkowki-2026')->count())->toBe(1)
        ->and(Tournament::firstWhere('slug', 'liga-siatkowki-2026')->matches()->count())->toBe(6);
});

it('sieje turniej z otwartymi zapisami i zgłoszeniami zgodnymi z przykładem listy zgłoszeń', function () {
    $tournament = Tournament::firstWhere('slug', 'liga-letnia-2026');

    expect($tournament)->not->toBeNull()
        ->and($tournament->user->email)->toBe('dawid@example.com')
        ->and($tournament->acceptsRegistrations())->toBeTrue()
        ->and($tournament->registration_deadline->isFuture())->toBeTrue()
        ->and($tournament->teams()->pluck('name')->all())->toBe(['Żubry Targówek'])
        ->and($tournament->teams()->sole()->players()->pluck('name')->all())->toBe(['Tomasz Zieliński']);

    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $example = $spec['paths']['/tournaments/{tournament}/registrations']['get']['responses']['200']['content']['application/json']['example']['data'];
    $withoutIds = fn (array $rows): array => array_map(
        fn (array $row): array => array_intersect_key($row, array_flip(['teamName', 'status', 'contact', 'players'])),
        $rows,
    );

    $response = actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/registrations")
        ->assertOk();

    expect($withoutIds($response->json('data')))->toBe($withoutIds($example));

    $this->getJson('/api/v1/public/t/liga-letnia-2026')
        ->assertOk()
        ->assertJsonPath('data.registration.open', true);
});

it('nie dubluje zgłoszeń ani drużyn turnieju z zapisami przy powtórnym seedowaniu', function () {
    $this->seed(DemoTournamentSeeder::class);

    $tournament = Tournament::firstWhere('slug', 'liga-letnia-2026');

    expect(Tournament::query()->where('slug', 'liga-letnia-2026')->count())->toBe(1)
        ->and($tournament->registrations()->count())->toBe(4)
        ->and($tournament->registrations()->where('status', 'pending')->count())->toBe(2)
        ->and($tournament->teams()->withTrashed()->count())->toBe(1)
        ->and($tournament->stages()->count())->toBe(1);
});
