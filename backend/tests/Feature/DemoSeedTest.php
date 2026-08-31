<?php

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Tournament;

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
        ->and($tournament->venues()->pluck('name')->all())->toBe(['Boisko Bemowo']);
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
    // pokazywałaby dwie sprzeczne prawdy o tym samym meczu.
    $matches = GameMatch::query()->where('status', 'finished')->get();

    foreach ($matches as $match) {
        $goals = fn (int $teamId) => MatchEvent::query()
            ->where('match_id', $match->id)
            ->where('team_id', $teamId)
            ->where('type', 'goal')
            ->count();

        expect($goals($match->home_team_id))->toBe($match->home_score)
            ->and($goals($match->away_team_id))->toBe($match->away_score);
    }
});

it('sieje klasyfikację strzelców zgodną z przykładem kontraktu', function () {
    $topScorers = MatchEvent::query()
        ->where('type', 'goal')
        ->join('players', 'players.id', '=', 'match_events.player_id')
        ->groupBy('players.id', 'players.name')
        ->orderByDesc('value')
        ->orderBy('players.name')
        ->selectRaw('players.name as name, count(*) as value')
        ->get()
        ->take(2)
        ->map(fn ($row) => [$row->name, (int) $row->value])
        ->all();

    expect($topScorers)->toBe([
        ['Marek Nowak', 4],
        ['Adam Zieliński', 2],
    ]);
});

it('nie dubluje danych demo przy powtórnym seedowaniu', function () {
    // `make fresh` robi `migrate:fresh --seed`, ale `db:seed` na stojącej bazie
    // to normalny ruch przy pracy nad seedem — drugi turniej o tym samym slugu
    // wywaliłby się na unikacie.
    $this->seed();

    expect(Tournament::query()->where('slug', 'liga-osiedlowa-2026')->count())->toBe(1)
        ->and(GameMatch::query()->count())->toBe(6);
});
