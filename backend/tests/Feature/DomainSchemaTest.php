<?php

use App\Exceptions\FinishedMatchGuardException;
use App\Models\GameMatch;
use App\Models\Group;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Sport;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Database\UniqueConstraintViolationException;

/*
|--------------------------------------------------------------------------
| Schemat domenowy
|--------------------------------------------------------------------------
|
| Ten zestaw nie sprawdza, czy „da się zapisać wiersz". Sprawdza decyzje, które
| zapadły przy projektowaniu schematu i których ani typy, ani sam fakt zapisu
| nie pilnują. Każdy test odpowiada jednej takiej decyzji — jeżeli któryś padnie,
| znaczy że ktoś cofnął ustalenie, prawdopodobnie nie wiedząc o nim.
|
*/

it('buduje pełne drzewo turnieju od organizera po zdarzenie meczowe', function () {
    $tournament = Tournament::factory()->create();
    $stage = Stage::factory()->for($tournament)->create();
    $round = Round::factory()->for($stage)->create();
    $match = GameMatch::factory()->for($round)->create();
    $event = MatchEvent::factory()->for($match, 'match')->create();

    expect($event->match->round->stage->tournament->id)->toBe($tournament->id)
        ->and($event->player->team_id)->toBe($match->home_team_id)
        ->and($match->homeTeam->tournament_id)->toBe($tournament->id)
        ->and($tournament->matches()->count())->toBe(1);
});

it('trzyma zdenormalizowane stage_id meczu zgodne z jego kolejką', function () {
    // Kopia istnieje dla wydajności tabeli liczonej on-read. Rozjazd z `round`
    // dawałby po cichu inną tabelę ligową niż terminarz.
    $match = GameMatch::factory()->create();

    expect($match->stage_id)->toBe($match->round->stage_id);
});

it('odrzuca drużynę przypisaną do grupy z cudzego turnieju', function () {
    // Baza tego nie egzekwuje (powód w migracji `teams`), więc pilnuje tego
    // aplikacja — i właśnie dlatego musi być tu test.
    $ourGroup = Group::factory()->create();
    $foreignGroup = Group::factory()->create();

    $team = Team::factory()->create(['tournament_id' => $ourGroup->tournament_id]);

    expect($team->groupBelongsToSameTournament($ourGroup))->toBeTrue()
        ->and($team->groupBelongsToSameTournament($foreignGroup))->toBeFalse()
        ->and($team->groupBelongsToSameTournament(null))->toBeTrue();
});

it('nie pozwala usunąć drużyny, która rozegrała mecz', function () {
    $match = GameMatch::factory()->finished()->create();
    $team = $match->homeTeam;

    expect(fn () => $team->delete())->toThrow(FinishedMatchGuardException::class);

    // Ani na miękko: rozegrany mecz ma dalej pokazywać, kto w nim grał.
    expect(Team::withTrashed()->find($team->id)->deleted_at)->toBeNull();
});

it('nie pozwala usunąć obiektu, na którym rozegrano mecz', function () {
    $venue = Venue::factory()->create();
    GameMatch::factory()->finished()->create(['venue_id' => $venue->id]);

    expect(fn () => $venue->delete())->toThrow(FinishedMatchGuardException::class);
});

it('nie pozwala usunąć zawodnika ze zdarzeniami w rozegranym meczu', function () {
    $match = GameMatch::factory()->finished()->create();
    $event = MatchEvent::factory()->for($match, 'match')->create();

    expect(fn () => $event->player->delete())->toThrow(FinishedMatchGuardException::class);
});

it('pozwala usunąć drużynę, dopóki jej mecze nie są rozegrane', function () {
    $match = GameMatch::factory()->create(['status' => 'scheduled']);
    $team = $match->homeTeam;

    $team->delete();

    expect(Team::find($team->id))->toBeNull()
        ->and(Team::withTrashed()->find($team->id))->not->toBeNull();
});

it('zeruje obiekt w meczu zamiast kasować mecz, gdy obiekt znika', function () {
    // Mecz bez obiektu jest sensownym stanem; mecz, który zniknął z terminarza
    // przez usunięcie boiska, nie jest.
    $venue = Venue::factory()->create();
    $match = GameMatch::factory()->create(['venue_id' => $venue->id]);

    $venue->forceDelete();

    expect($match->fresh()->venue_id)->toBeNull()
        ->and($match->fresh())->not->toBeNull();
});

it('kasuje całe poddrzewo turnieju, gdy turniej znika', function () {
    $tournament = Tournament::factory()->create();
    $stage = Stage::factory()->for($tournament)->create();
    $round = Round::factory()->for($stage)->create();
    $match = GameMatch::factory()->for($round)->create();
    $event = MatchEvent::factory()->for($match, 'match')->create();
    $venue = Venue::factory()->for($tournament)->create();
    $player = Player::factory()->create(['team_id' => $match->home_team_id]);

    $tournament->delete();

    // Twarda kaskada: soft-delete na drużynach i obiektach dotyczy pomyłek
    // organizera, a nie usunięcia całego turnieju.
    $this->assertDatabaseMissing('stages', ['id' => $stage->id]);
    $this->assertDatabaseMissing('rounds', ['id' => $round->id]);
    $this->assertDatabaseMissing('matches', ['id' => $match->id]);
    $this->assertDatabaseMissing('match_events', ['id' => $event->id]);
    $this->assertDatabaseMissing('venues', ['id' => $venue->id]);
    $this->assertDatabaseMissing('players', ['id' => $player->id]);
    $this->assertDatabaseMissing('teams', ['id' => $match->home_team_id]);
});

it('zwalnia slug po usunięciu turnieju', function () {
    // Turniej nie ma soft-delete właśnie po to: adres /t/{slug} albo działa,
    // albo jest wolny. Stanu pośredniego nie ma.
    $tournament = Tournament::factory()->create(['slug' => 'liga-osiedlowa-2026']);
    $tournament->delete();

    Tournament::factory()->create(['slug' => 'liga-osiedlowa-2026']);

    expect(Tournament::where('slug', 'liga-osiedlowa-2026')->count())->toBe(1);
});

it('zeruje przypisanie do grupy zamiast kasować drużynę, gdy grupa znika', function () {
    $group = Group::factory()->create();
    $team = Team::factory()->inGroup($group)->create();

    $group->delete();

    expect($team->fresh())->not->toBeNull()
        ->and($team->fresh()->group_id)->toBeNull();
});

it('ma sporty w bazie zaraz po migracji, zgodne z kontraktem', function () {
    // Sporty są danymi systemowymi (decyzja #10), więc nie wymagają seedera.
    // Wartości muszą zgadzać się z przykładem `GET /sports` w openapi.yaml —
    // rozjazd oznacza dwie różne prawdy o tym samym sporcie.
    $football = Sport::firstWhere('code', 'football');
    $basketball = Sport::firstWhere('code', 'basketball');

    expect($football->defaultPoints())->toBe(['win' => 3, 'draw' => 1, 'loss' => 0])
        ->and($football->allowsDraw())->toBeTrue()
        ->and($football->eventTypeCodes())->toBe(['goal', 'own_goal', 'yellow_card', 'red_card'])
        ->and($basketball->defaultPoints())->toBe(['win' => 2, 'draw' => 0, 'loss' => 1])
        ->and($basketball->allowsDraw())->toBeFalse()
        ->and($basketball->eventTypeCodes())->toBe(['points', 'foul']);
});

it('kopiuje punktację sportu do turnieju przy zakładaniu', function () {
    $tournament = Tournament::factory()->basketball()->create();

    expect($tournament->points)->toBe(['win' => 2, 'draw' => 0, 'loss' => 1]);
});

it('pilnuje unikalności pozycji meczu w kolejce', function () {
    $match = GameMatch::factory()->create(['match_number' => 1]);

    expect(fn () => GameMatch::factory()->create([
        'round_id' => $match->round_id,
        'match_number' => 1,
    ]))->toThrow(UniqueConstraintViolationException::class);
});

it('utrzymuje krawędzie drabinki i zeruje je, gdy mecz docelowy znika', function () {
    // Generator zapisuje mecze od finału wstecz, więc cel istnieje już
    // w chwili wstawiania wiersza (ADR-0004).
    $stage = Stage::factory()->knockout()->create();
    $finalRound = Round::factory()->for($stage)->create(['name' => 'Finał', 'order' => 2]);
    $semiRound = Round::factory()->for($stage)->create(['name' => 'Półfinały', 'order' => 1]);

    $final = GameMatch::factory()->for($finalRound)->create(['match_number' => 1]);
    $semi = GameMatch::factory()->for($semiRound)->create([
        'match_number' => 1,
        'winner_to_match_id' => $final->id,
        'advances_to_slot' => 'home',
    ]);

    expect($semi->winnerTo->id)->toBe($final->id);

    $final->delete();

    expect($semi->fresh()->winner_to_match_id)->toBeNull()
        ->and($semi->fresh())->not->toBeNull();
});
