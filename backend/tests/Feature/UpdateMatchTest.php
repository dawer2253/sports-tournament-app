<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Wpisywanie wyniku, stanu, terminu i obiektu meczu (#176)
|--------------------------------------------------------------------------
|
| Reguły spójności ustalił #159 (tabela stan → wynik, wszystkie błędy pary pod
| `homeScore`), a korektę terminu i obiektu — #158. 401, 403 i jedna zdolność
| `manage` tej trasy są w `SubtreeAuthorizationTest`.
|
| Funkcje niżej lądują w globalnej przestrzeni nazw Pesta, stąd prefiks
| `updateMatch`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** Turniej z fazą ligową i dwiema drużynami. */
function updateMatchLeague(string $sport = 'football', array $attributes = []): Tournament
{
    $factory = Tournament::factory();
    $tournament = (match ($sport) {
        'basketball' => $factory->basketball(),
        'volleyball' => $factory->volleyball(),
        default => $factory,
    })->create($attributes);
    Stage::factory()->for($tournament)->create(['name' => 'Faza zasadnicza']);
    Team::factory()->for($tournament)->create(['name' => 'Wilki Bemowo']);
    Team::factory()->for($tournament)->create(['name' => 'Sokoły Ursus']);

    return $tournament;
}

/** Mecz kolejnej kolejki w turnieju, domyślnie `scheduled` bez wyniku. */
function updateMatchIn(
    Tournament $tournament,
    ?int $homeScore = null,
    ?int $awayScore = null,
    string $status = 'scheduled',
    ?string $kickoff = null,
    ?Venue $venue = null,
): GameMatch {
    $stage = $tournament->stages()->firstOrFail();
    $order = ($stage->rounds()->max('order') ?? 0) + 1;
    $round = Round::factory()->for($stage)->create(['order' => $order, 'name' => "Kolejka {$order}"]);
    $teams = $tournament->teams()->orderBy('id')->get();

    return GameMatch::factory()->for($round)->create([
        'home_team_id' => $teams[0]->id,
        'away_team_id' => $teams[1]->id,
        'home_score' => $homeScore,
        'away_score' => $awayScore,
        'status' => $status,
        'kickoff_at' => $kickoff,
        'venue_id' => $venue?->id,
    ]);
}

function updateMatch(GameMatch $match, array $body): TestResponse
{
    return actingAsOrganizer($match->stage->tournament->user)
        ->patchJson("/api/v1/matches/{$match->id}", $body);
}

/** Tabela turnieju jako surowa odpowiedź, do porównań „przed/po”. */
function updateMatchStandings(Tournament $tournament): array
{
    return actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/standings")
        ->assertValidResponse(200)
        ->json();
}

// --- niezmienniki z #159 -----------------------------------------------------

it('po każdym udanym zapisie mecz jest scheduled wtedy i tylko wtedy, gdy oba wyniki są null', function () {
    $match = updateMatchIn(updateMatchLeague());

    updateMatch($match, ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'live')
        ->assertJsonPath('data.homeScore', 0);

    updateMatch($match, ['status' => 'finished'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'finished');

    // Powrót do scheduled bez jawnego wyczyszczenia wyniku to błąd...
    updateMatch($match, ['status' => 'scheduled'])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('homeScore');

    // ...a z jawnymi `null` przechodzi i faktycznie czyści wynik.
    updateMatch($match, ['status' => 'scheduled', 'homeScore' => null, 'awayScore' => null])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'scheduled')
        ->assertJsonPath('data.homeScore', null)
        ->assertJsonPath('data.awayScore', null);
});

it('przy allowsDraw:true pozwala zakończyć mecz remisem', function () {
    $match = updateMatchIn(updateMatchLeague());

    updateMatch($match, ['status' => 'finished', 'homeScore' => 2, 'awayScore' => 2])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'finished')
        ->assertJsonPath('data.homeScore', 2);
});

it('przy allowsDraw:false remis na finished daje 422 pod homeScore', function () {
    $match = updateMatchIn(updateMatchLeague('basketball'));

    updateMatch($match, ['status' => 'finished', 'homeScore' => 50, 'awayScore' => 50])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('homeScore')
        ->assertJsonPath('errors.homeScore.0', 'Ten sport nie zna remisu, więc mecz zakończony musi mieć zwycięzcę.');
});

it('przy allowsDraw:false przepuszcza ten sam remis na live', function () {
    $match = updateMatchIn(updateMatchLeague('basketball'));

    updateMatch($match, ['status' => 'live', 'homeScore' => 50, 'awayScore' => 50])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'live')
        ->assertJsonPath('data.homeScore', 50);
});

it('{status: scheduled} na meczu z wynikiem daje 422 i zostawia wynik bez zmian', function () {
    $match = updateMatchIn(updateMatchLeague(), 2, 1, 'finished');

    updateMatch($match, ['status' => 'scheduled'])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('homeScore')
        ->assertJsonPath('errors.homeScore.0', 'Mecz zaplanowany nie ma wyniku. Wyczyść oba pola: homeScore i awayScore.');

    expect($match->fresh())->home_score->toBe(2)->away_score->toBe(1)->status->toBe('finished');
});

it('sam kickoffAt nie zmienia wyniku ani stanu', function () {
    $match = updateMatchIn(updateMatchLeague(), 2, 1, 'finished');

    updateMatch($match, ['kickoffAt' => '2026-10-11T10:00:00+00:00'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'finished')
        ->assertJsonPath('data.homeScore', 2)
        ->assertJsonPath('data.awayScore', 1);
});

it('scheduled → finished bez live przechodzi', function () {
    $match = updateMatchIn(updateMatchLeague());

    updateMatch($match, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 0])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'finished');
});

it('zmiana wyniku meczu finished zmienia tabelę, a zmiana wyniku live jej nie zmienia', function () {
    $tournament = updateMatchLeague();
    $match = updateMatchIn($tournament, 2, 1, 'finished');
    $before = updateMatchStandings($tournament);

    updateMatch($match, ['homeScore' => 5, 'awayScore' => 0])->assertValidResponse(200);
    $changed = updateMatchStandings($tournament);
    expect($changed)->not->toBe($before);

    $live = updateMatchIn($tournament);
    updateMatch($live, ['status' => 'live', 'homeScore' => 9, 'awayScore' => 0])->assertValidResponse(200);
    expect(updateMatchStandings($tournament))->toBe($changed);
});

// --- wkład z domknięcia mapy #156 (brakujące asercje decyzji z #159) ---------

it('wpisuje wynik meczowi bez terminu i w turnieju draft', function () {
    $tournament = updateMatchLeague(attributes: ['status' => 'draft']);
    $match = updateMatchIn($tournament);

    expect($match->kickoff_at)->toBeNull();

    updateMatch($match, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 0])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'finished')
        ->assertJsonPath('data.kickoffAt', null);
});

it('odrzuca wynik 1000 albo -1 oraz jeden wynik pusty przy live', function () {
    $match = updateMatchIn(updateMatchLeague());

    updateMatch($match, ['homeScore' => 1000])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('homeScore');

    updateMatch($match, ['awayScore' => -1])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('awayScore');

    updateMatch($match, ['status' => 'live', 'homeScore' => 3])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('homeScore')
        ->assertJsonPath('errors.homeScore.0', 'Mecz trwający albo zakończony potrzebuje obu wyników.');
});

it('karne w meczu ligi dają 422 pod homePenalties, a jawne null przechodzi', function () {
    $match = updateMatchIn(updateMatchLeague());

    updateMatch($match, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 1, 'homePenalties' => 4, 'awayPenalties' => 3])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.homePenalties.0', 'Karne wpisuje się tylko w meczu pucharowym.');

    expect($match->fresh())->home_penalties->toBeNull()->status->toBe('scheduled');

    updateMatch($match, ['status' => 'finished', 'homeScore' => 1, 'awayScore' => 1, 'homePenalties' => null, 'awayPenalties' => null])
        ->assertValidResponse(200)
        ->assertJsonPath('data.homePenalties', null);
});

it('odrzuca nieznany stan meczu', function () {
    $match = updateMatchIn(updateMatchLeague());

    updateMatch($match, ['status' => 'bogus'])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('status');
});

// --- termin i obiekt z #158 --------------------------------------------------

it('wymaga offsetu w kickoffAt i przelicza podany moment na UTC', function () {
    $match = updateMatchIn(updateMatchLeague());

    updateMatch($match, ['kickoffAt' => '2026-10-11T12:00'])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('kickoffAt');

    updateMatch($match, ['kickoffAt' => '2026-10-11T12:00:00+02:00'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.kickoffAt', '2026-10-11T10:00:00+00:00');
});

it('przyjmuje obiekt tego turnieju, a obcy albo null czyści obiekt', function () {
    $tournament = updateMatchLeague();
    $match = updateMatchIn($tournament);
    $venue = Venue::factory()->for($tournament)->create(['name' => 'Boisko A']);

    updateMatch($match, ['venueId' => $venue->id])
        ->assertValidResponse(200)
        ->assertJsonPath('data.venue.id', $venue->id);

    updateMatch($match, ['venueId' => null])
        ->assertValidResponse(200)
        ->assertJsonPath('data.venue', null);
});

it('obiekt z innego turnieju daje 422 pod venueId', function () {
    $match = updateMatchIn(updateMatchLeague());
    $foreign = Venue::factory()->for(Tournament::factory()->create())->create();

    updateMatch($match, ['venueId' => $foreign->id])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('venueId')
        ->assertJsonPath('errors.venueId.0', 'Wybierz obiekt tego turnieju.');
});

it('usunięty obiekt tego turnieju daje 422 pod venueId', function () {
    $tournament = updateMatchLeague();
    $match = updateMatchIn($tournament);
    $venue = Venue::factory()->for($tournament)->create();
    $venue->delete();

    updateMatch($match, ['venueId' => $venue->id])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('venueId')
        ->assertJsonPath('errors.venueId.0', 'Wybierz obiekt tego turnieju.');
});

it('zmiana terminu meczu finished przechodzi', function () {
    $match = updateMatchIn(updateMatchLeague(), 2, 1, 'finished');

    updateMatch($match, ['kickoffAt' => '2026-10-11T10:00:00+00:00'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'finished')
        ->assertJsonPath('data.kickoffAt', '2026-10-11T10:00:00+00:00');
});

// --- część meczu na żywo (#297) ---------------------------------------------

/** Mecz trwający w 1. części, zaczęty przez API o `$at`. */
function updateMatchLiveAt(Tournament $tournament, string $at): GameMatch
{
    $match = updateMatchIn($tournament);
    test()->travelTo($at);
    updateMatch($match, ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0])->assertValidResponse(200);

    return $match;
}

it('scheduled → live zaczyna 1. część w chwili zapisu', function () {
    $match = updateMatchIn(updateMatchLeague());
    $this->travelTo('2026-09-27 10:00:07');

    updateMatch($match, ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', 1)
        ->assertJsonPath('data.periodStartedAt', '2026-09-27T10:00:07+00:00')
        ->assertJsonPath('data.onBreak', false);
});

it('ponowne status: live meczu, który trwa, z innym wynikiem zegara nie rusza', function () {
    $match = updateMatchLiveAt(updateMatchLeague(), '2026-09-27 10:00:00');
    $this->travelTo('2026-09-27 10:20:00');

    updateMatch($match, ['status' => 'live', 'homeScore' => 1, 'awayScore' => 0])
        ->assertValidResponse(200)
        ->assertJsonPath('data.homeScore', 1)
        ->assertJsonPath('data.livePeriod', 1)
        ->assertJsonPath('data.periodStartedAt', '2026-09-27T10:00:00+00:00');
});

it('przerwa zeruje start i zostawia część, a start następnej daje kolejny numer i nowy start', function () {
    $match = updateMatchLiveAt(updateMatchLeague(), '2026-09-27 10:00:00');
    $this->travelTo('2026-09-27 10:47:00');

    updateMatch($match, ['periodRunning' => false])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', 1)
        ->assertJsonPath('data.periodStartedAt', null)
        ->assertJsonPath('data.onBreak', true)
        ->assertJsonPath('data.homeScore', 0);

    $this->travelTo('2026-09-27 11:02:00');

    updateMatch($match, ['livePeriod' => 2, 'periodRunning' => true])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', 2)
        ->assertJsonPath('data.periodStartedAt', '2026-09-27T11:02:00+00:00')
        ->assertJsonPath('data.onBreak', false);
});

it('powrót do scheduled zeruje część i start, a następne live zaczyna od 1. części', function () {
    $match = updateMatchLiveAt(updateMatchLeague(), '2026-09-27 10:00:00');
    updateMatch($match, ['periodRunning' => false])->assertValidResponse(200);
    updateMatch($match, ['livePeriod' => 2, 'periodRunning' => true])->assertValidResponse(200);

    updateMatch($match, ['status' => 'scheduled', 'homeScore' => null, 'awayScore' => null])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', null)
        ->assertJsonPath('data.periodStartedAt', null)
        ->assertJsonPath('data.onBreak', false);

    $this->travelTo('2026-09-27 12:00:00');
    updateMatch($match, ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', 1)
        ->assertJsonPath('data.periodStartedAt', '2026-09-27T12:00:00+00:00');
});

it('finished zeruje start, a powrót do live daje ostatnią część bez zegara, różną od przerwy', function () {
    $match = updateMatchLiveAt(updateMatchLeague(), '2026-09-27 10:00:00');
    $this->travelTo('2026-09-27 10:50:00');
    updateMatch($match, ['periodRunning' => false])->assertValidResponse(200);
    updateMatch($match, ['livePeriod' => 2, 'periodRunning' => true])->assertValidResponse(200);

    updateMatch($match, ['status' => 'finished'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', null)
        ->assertJsonPath('data.periodStartedAt', null)
        ->assertJsonPath('data.onBreak', false);

    $this->travelTo('2026-09-27 12:00:00');

    updateMatch($match, ['status' => 'live'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', 2)
        ->assertJsonPath('data.periodStartedAt', null)
        ->assertJsonPath('data.onBreak', false);
});

it('mecz zakończony bez live po powrocie do live stoi w 1. części bez zegara', function () {
    $match = updateMatchIn(updateMatchLeague(), 1, 0, 'finished');

    updateMatch($match, ['status' => 'live'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', 1)
        ->assertJsonPath('data.periodStartedAt', null)
        ->assertJsonPath('data.onBreak', false);
});

it('część count + 1 w lidze daje 422 pod livePeriod i niczego nie zapisuje', function () {
    $match = updateMatchLiveAt(updateMatchLeague(), '2026-09-27 10:00:00');

    updateMatch($match, ['livePeriod' => 3, 'periodRunning' => true])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('livePeriod');

    expect($match->refresh()->live_period)->toBe(1);
});

it('niepełne albo błędne pola części dają 422 pod livePeriod', function (array $body) {
    $match = updateMatchLiveAt(updateMatchLeague(), '2026-09-27 10:00:00');

    updateMatch($match, $body)
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('livePeriod');
})->with([
    'livePeriod 0' => [['livePeriod' => 0, 'periodRunning' => true]],
    'livePeriod napisem' => [['livePeriod' => '2', 'periodRunning' => true]],
    'livePeriod bez periodRunning' => [['livePeriod' => 2]],
    'livePeriod z periodRunning: false' => [['livePeriod' => 2, 'periodRunning' => false]],
    'periodRunning: true bez livePeriod' => [['periodRunning' => true]],
]);

it('pola części przy meczu innym niż live dają 422 pod livePeriod', function (string $status, array $body) {
    $match = $status === 'scheduled'
        ? updateMatchIn(updateMatchLeague())
        : updateMatchIn(updateMatchLeague(), 1, 0, 'finished');

    updateMatch($match, $body)
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('livePeriod');
})->with([
    'scheduled, przerwa' => ['scheduled', ['periodRunning' => false]],
    'scheduled, start' => ['scheduled', ['livePeriod' => 1, 'periodRunning' => true]],
    'finished, start' => ['finished', ['livePeriod' => 2, 'periodRunning' => true]],
]);

it('liczy zakres części z ustawień turnieju: 4. kwarta przechodzi, 5. daje 422', function () {
    $match = updateMatchLiveAt(updateMatchLeague('basketball'), '2026-09-27 10:00:00');

    foreach ([2, 3, 4] as $period) {
        updateMatch($match, ['livePeriod' => $period, 'periodRunning' => true])->assertValidResponse(200)->assertJsonPath('data.livePeriod', $period);
    }
    updateMatch($match, ['livePeriod' => 5, 'periodRunning' => true])->assertValidResponse(422)->assertJsonValidationErrors('livePeriod');
});

it('start części przyjmuje tylko następny numer: ani przeskok, ani powtórka bieżącej czy wcześniejszej', function (int $period) {
    $match = updateMatchLiveAt(updateMatchLeague('basketball'), '2026-09-27 10:00:00');
    updateMatch($match, ['livePeriod' => 2, 'periodRunning' => true])->assertValidResponse(200);
    $this->travelTo('2026-09-27 10:30:00');

    updateMatch($match, ['livePeriod' => $period, 'periodRunning' => true])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.livePeriod.0', 'Następna część tego meczu to 3.');

    $match->refresh();
    expect($match->live_period)->toBe(2)
        ->and($match->period_started_at->toIso8601String())->toBe('2026-09-27T10:00:00+00:00');
})->with(['przeskok' => 4, 'powtórka bieżącej' => 2, 'wcześniejsza' => 1]);

it('w turnieju bez podziału mecz ma jedną część: bez przerwy i bez 2. części w lidze', function (array $body) {
    $match = updateMatchLiveAt(updateMatchLeague(attributes: ['period_count' => 1, 'period_minutes' => null]), '2026-09-27 10:00:00');

    updateMatch($match, $body)
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('livePeriod');

    expect($match->refresh()->on_break)->toBeFalse();
})->with([
    'przerwa' => [['periodRunning' => false]],
    '2. część' => [['livePeriod' => 2, 'periodRunning' => true]],
]);

it('przerwa po ostatniej części ligi daje 422: po niej mecz się kończy', function () {
    $match = updateMatchLiveAt(updateMatchLeague(), '2026-09-27 10:00:00');
    updateMatch($match, ['livePeriod' => 2, 'periodRunning' => true])->assertValidResponse(200);

    updateMatch($match, ['periodRunning' => false])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.livePeriod.0', 'Przerwa jest tylko po części, która trwa i nie jest ostatnią.');
});

it('przerwa w trakcie przerwy albo po powrocie z finished daje 422, a start następnej części przechodzi', function () {
    $match = updateMatchLiveAt(updateMatchLeague('basketball'), '2026-09-27 10:00:00');
    updateMatch($match, ['periodRunning' => false])->assertValidResponse(200);

    updateMatch($match, ['periodRunning' => false])->assertValidResponse(422)->assertJsonValidationErrors('livePeriod');

    updateMatch($match, ['livePeriod' => 2, 'periodRunning' => true])->assertValidResponse(200);
    updateMatch($match, ['status' => 'finished', 'homeScore' => 40, 'awayScore' => 38])->assertValidResponse(200);
    updateMatch($match, ['status' => 'live'])->assertValidResponse(200)->assertJsonPath('data.livePeriod', 2);

    updateMatch($match, ['periodRunning' => false])->assertValidResponse(422)->assertJsonValidationErrors('livePeriod');
    expect($match->refresh()->on_break)->toBeFalse();

    updateMatch($match, ['livePeriod' => 3, 'periodRunning' => true])
        ->assertValidResponse(200)
        ->assertJsonPath('data.livePeriod', 3)
        ->assertJsonPath('data.onBreak', false);
});

// --- sport z setami (#301) ---------------------------------------------------

/** Mecz siatkówki `scheduled` z pustą listą setów, jak z generatora terminarza. */
function updateMatchVolleyball(array $tournamentAttributes = []): GameMatch
{
    $match = updateMatchIn(updateMatchLeague('volleyball', $tournamentAttributes));
    $match->update(['sets' => []]);

    return $match;
}

/** @param list<array{int, int}> $scores */
function updateMatchSets(array $scores): array
{
    return array_map(fn (array $score): array => ['home' => $score[0], 'away' => $score[1]], $scores);
}

it('w siatkówce zapisuje sety, a wynik to sety wygrane policzone przez serwer', function () {
    $match = updateMatchVolleyball();

    updateMatch($match, ['status' => 'finished', 'sets' => updateMatchSets([[25, 23], [27, 25], [23, 25], [25, 20]])])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.homeScore', 3)
        ->assertJsonPath('data.awayScore', 1)
        ->assertJsonPath('data.sets', updateMatchSets([[25, 23], [27, 25], [23, 25], [25, 20]]));

    expect($match->refresh()->only(['home_score', 'away_score']))->toBe(['home_score' => 3, 'away_score' => 1]);
});

it('w siatkówce odrzuca set spoza reguł pod sets.{n}, a 27:25 i decydujący 15:13 przechodzą', function (array $scores, ?string $key) {
    $response = updateMatch(updateMatchVolleyball(), ['status' => 'finished', 'sets' => updateMatchSets($scores)]);

    $key === null
        ? $response->assertValidResponse(200)
        : $response->assertValidResponse(422)->assertJsonValidationErrors($key);
})->with([
    '25:23 i 27:25' => [[[25, 23], [27, 25], [25, 10]], null],
    'decydujący 15:13' => [[[25, 23], [23, 25], [25, 21], [20, 25], [15, 13]], null],
    '25:24' => [[[25, 24], [25, 10], [25, 10]], 'sets.0'],
    '28:25' => [[[25, 10], [28, 25], [25, 10]], 'sets.1'],
    'decydujący 15:14' => [[[25, 23], [23, 25], [25, 21], [20, 25], [15, 14]], 'sets.4'],
    'bez zwycięzcy' => [[[25, 23], [23, 25]], 'sets'],
    'set po rozstrzygnięciu' => [[[25, 10], [25, 10], [25, 10], [25, 10]], 'sets.3'],
]);

it('w siatkówce przy 2:2 piąty set gra się do 15', function () {
    $match = updateMatchVolleyball();
    $fourSets = [[25, 23], [23, 25], [25, 21], [20, 25]];

    updateMatch($match, ['status' => 'finished', 'sets' => updateMatchSets([...$fourSets, [15, 9]])])
        ->assertValidResponse(200)
        ->assertJsonPath('data.homeScore', 3)
        ->assertJsonPath('data.awayScore', 2);

    updateMatch($match, ['sets' => updateMatchSets([...$fourSets, [25, 9]])])
        ->assertValidResponse(422)
        ->assertJsonPath('errors', ['sets.4' => ['Set nie może skończyć się wynikiem 25:9: gra się do 15 pkt, a od 14:14 na przewagi.']]);
});

it('w siatkówce mecz trwający może mieć niedokończony ostatni set, który nie zmienia wyniku', function () {
    $match = updateMatchVolleyball();

    updateMatch($match, ['status' => 'live', 'sets' => updateMatchSets([[25, 21], [18, 25], [14, 12]])])
        ->assertValidResponse(200)
        ->assertJsonPath('data.homeScore', 1)
        ->assertJsonPath('data.awayScore', 1);

    updateMatch($match, ['sets' => updateMatchSets([[26, 22]])])
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('sets.0');
});

it('w siatkówce mecz do 2 setów kończy się na 2:1', function () {
    $match = updateMatchVolleyball(['set_format' => ['setsToWin' => 2, 'setPoints' => 25, 'decidingSetPoints' => 15, 'minLead' => 2]]);

    updateMatch($match, ['status' => 'finished', 'sets' => updateMatchSets([[25, 20], [20, 25], [15, 12]])])
        ->assertValidResponse(200)
        ->assertJsonPath('data.homeScore', 2)
        ->assertJsonPath('data.awayScore', 1);
});

it('w siatkówce przy przewadze 1 set kończy się na progu: 25:24 przechodzi, 26:24 daje 422', function () {
    $match = updateMatchVolleyball(['set_format' => ['setsToWin' => 3, 'setPoints' => 25, 'decidingSetPoints' => 15, 'minLead' => 1]]);

    updateMatch($match, ['status' => 'finished', 'sets' => updateMatchSets([[25, 24], [25, 24], [25, 24]])])->assertValidResponse(200);
    updateMatch($match, ['sets' => updateMatchSets([[26, 24], [25, 24], [25, 24]])])->assertValidResponse(422)->assertJsonValidationErrors('sets.0');
});

it('w siatkówce stosuje próg seta z turnieju: sety do 21', function () {
    $match = updateMatchVolleyball(['set_format' => ['setsToWin' => 3, 'setPoints' => 21, 'decidingSetPoints' => 15, 'minLead' => 2]]);

    updateMatch($match, ['status' => 'finished', 'sets' => updateMatchSets([[21, 15], [21, 19], [21, 10]])])->assertValidResponse(200);
    updateMatch($match, ['sets' => updateMatchSets([[25, 15], [21, 19], [21, 10]])])->assertValidResponse(422)->assertJsonValidationErrors('sets.0');
});

it('w siatkówce homeScore daje 422 pod homeScore', function () {
    updateMatch(updateMatchVolleyball(), ['status' => 'live', 'homeScore' => 1, 'awayScore' => 0])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.homeScore.0', 'W meczu na sety wynik liczy się z setów.');
});

it('sety w piłce dają 422 pod sets', function () {
    updateMatch(updateMatchIn(updateMatchLeague()), ['status' => 'live', 'homeScore' => 0, 'awayScore' => 0, 'sets' => []])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.sets.0', 'Wyniki setów wpisuje się tylko w sporcie z setami.');
});

it('w siatkówce powrót do scheduled wymaga jawnego sets: [] i czyści wynik', function () {
    $match = updateMatchVolleyball();
    updateMatch($match, ['status' => 'live', 'sets' => updateMatchSets([[25, 20]])])->assertValidResponse(200);

    updateMatch($match, ['status' => 'scheduled'])->assertValidResponse(422)->assertJsonValidationErrors('sets');

    updateMatch($match, ['status' => 'scheduled', 'sets' => []])
        ->assertValidResponse(200)
        ->assertJsonPath('data.homeScore', null)
        ->assertJsonPath('data.awayScore', null)
        ->assertJsonPath('data.sets', []);
});

it('w siatkówce samo przejście scheduled → live daje wynik 0:0 z pustej listy setów', function () {
    updateMatch(updateMatchVolleyball(), ['status' => 'live'])
        ->assertValidResponse(200)
        ->assertJsonPath('data.homeScore', 0)
        ->assertJsonPath('data.awayScore', 0)
        ->assertJsonPath('data.livePeriod', 1);
});
