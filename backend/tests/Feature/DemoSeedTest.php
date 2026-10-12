<?php

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
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
    $this->seed();
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
        ->and($tournament->matches()->where('matches.status', 'scheduled')->count())->toBe(3)
        ->and($tournament->matches()->whereNull('home_score')->where('matches.status', 'finished')->count())->toBe(0)
        // Ostatnia kolejka jest bez obiektu — `venue` jest w kontrakcie
        // opcjonalne i demo ma pokazywać także ten przypadek.
        ->and($tournament->matches()->whereNull('venue_id')->count())->toBe(1);
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

it('sieje klasyfikację strzelców zgodną z przykładem kontraktu', function () {
    // Kalkulator klasyfikacji wchodzi w S1 — tu liczy się tylko to, że dane
    // wejściowe dają dokładnie tę klasyfikację, co przykład
    // `GET /public/t/{slug}/top-scorers`. Endpoint nie ma parametru `limit`,
    // więc porównujemy komplet strzelców, nie czołówkę: obcięcie do dwóch
    // przepuściłoby bramkę dorzuconą komukolwiek dalej w stawce.
    // Porządek jest ten z kontraktu (`StatLeaderboardRow.position`): malejąco
    // po bramkach, a przy remisie rosnąco po `player.id`. Sortujemy tu sami,
    // bo kolejność wierszy z bazy jest nieokreślona, a to właśnie ona odróżnia
    // klasyfikację od worka liczb.
    $goals = MatchEvent::query()
        ->where('type', 'goal')
        ->with('player')
        ->get()
        ->groupBy(fn (MatchEvent $event) => $event->player_id)
        ->map(fn ($events, $playerId) => [
            'name' => $events->first()->player->name,
            'goals' => $events->count(),
            'playerId' => $playerId,
        ])
        ->sortBy([['goals', 'desc'], ['playerId', 'asc']])
        ->map(fn (array $row) => "{$row['name']} {$row['goals']}")
        ->values()
        ->all();

    expect($goals)->toBe([
        'Marek Nowak 3',
        'Adam Zieliński 2',
        'Jakub Wrona 1',
        'Tomasz Lis 1',
        'Rafał Duda 1',
    ]);
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
    $this->seed();

    $demo = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');

    // Poddrzewo powstaje od nowa pod nowymi id (autoinkrement, patrz docblock
    // seedera), więc pilnujemy, że stare nie zostało obok: po jednej fazie
    // i po dwa rozegrane mecze na turniej.
    expect(Tournament::query()->where('slug', 'liga-osiedlowa-2026')->count())->toBe(1)
        ->and(Stage::query()->count())->toBe(2)
        ->and(Round::query()->count())->toBe(8)
        ->and(GameMatch::query()->count())->toBe(8)
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
    $this->seed();

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

    $this->seed();

    $demo = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');

    expect($demo->matches()->count())->toBe(6)
        ->and($demo->stages()->count())->toBe(1)
        ->and($other->stages()->pluck('id')->all())->toBe([1])
        ->and($other->matches()->pluck('matches.id')->all())->toBe([1]);
});
