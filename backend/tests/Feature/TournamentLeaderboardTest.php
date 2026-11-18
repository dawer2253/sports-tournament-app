<?php

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Klasyfikacja panelu: GET /tournaments/{tournament}/leaderboard (#333)
|--------------------------------------------------------------------------
|
| Liczy ją ten sam `StatLeaderboard::of` co stronę publiczną, więc reguły
| liczenia pilnuje `PublicTournamentTest`. Tu zostaje to, czym trasa panelu
| się różni: id zamiast sluga, token, szkic i domyślna statystyka sportu.
| 401 i 404 po miękkim usunięciu pilnuje `SubtreeAuthorizationTest`.
|
| Funkcje lądują w globalnej przestrzeni nazw Pesta, stąd prefiks
| `panelLeaderboard` w każdej nazwie.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** Turniej z jedną kolejką i dwiema drużynami: Orły i Sokoły. */
function panelLeaderboardTournament(string $sport = 'football', string $status = 'active'): Tournament
{
    $factory = Tournament::factory();
    $tournament = match ($sport) {
        'basketball' => $factory->basketball(),
        'volleyball' => $factory->volleyball(),
        default => $factory,
    };
    $tournament = $tournament->create(['status' => $status]);
    $stage = Stage::factory()->for($tournament)->create();
    Round::factory()->for($stage)->create(['name' => 'Kolejka 1', 'order' => 1]);
    Team::factory()->for($tournament)->create(['name' => 'Orły Bielany']);
    Team::factory()->for($tournament)->create(['name' => 'Sokoły Ursus']);

    return $tournament;
}

/**
 * Mecz zakończony z podanymi zdarzeniami: `[nazwisko, typ]`, zawodnik Orłów.
 *
 * @param  list<array{0: string, 1: string}>  $events
 */
function panelLeaderboardFinishedMatch(Tournament $tournament, array $events): void
{
    $round = $tournament->stages()->firstOrFail()->rounds()->firstOrFail();
    $orly = $tournament->teams()->where('name', 'Orły Bielany')->firstOrFail();
    $match = GameMatch::factory()->for($round)->create([
        'home_team_id' => $orly->id,
        'away_team_id' => $tournament->teams()->where('name', 'Sokoły Ursus')->value('id'),
        'status' => 'finished',
        'home_score' => 1,
        'away_score' => 0,
    ]);

    foreach ($events as [$name, $type]) {
        $player = Player::firstOrCreate(['team_id' => $orly->id, 'name' => $name]);
        MatchEvent::factory()->create([
            'match_id' => $match->id,
            'team_id' => $orly->id,
            'player_id' => $player->id,
            'type' => $type,
        ]);
    }
}

it('bez stat liczy pierwszą statystykę sportu, w siatkówce punkty, nie bramki', function () {
    $tournament = panelLeaderboardTournament('volleyball');
    panelLeaderboardFinishedMatch($tournament, [['Kamil Lis', 'ace'], ['Kamil Lis', 'block'], ['Ola Kruk', 'attack']]);

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/leaderboard")
        ->assertValidResponse(200)
        ->assertJsonPath('data.stat', 'points')
        ->assertJsonPath('data.label', 'Punkty')
        ->assertJsonPath('data.rows.*.player.name', ['Kamil Lis', 'Ola Kruk'])
        ->assertJsonPath('data.rows.*.value', [2, 1]);
});

it('działa dla turnieju w szkicu, którego strona publiczna nie pokazuje', function () {
    $tournament = panelLeaderboardTournament(status: 'draft');
    panelLeaderboardFinishedMatch($tournament, [['Marek Nowak', 'goal']]);

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/leaderboard")
        ->assertValidResponse(200)
        ->assertJsonPath('data.rows.0.player.name', 'Marek Nowak');

    $this->getJson("/api/v1/public/t/{$tournament->slug}/leaderboard")->assertNotFound();
});

it('ze stat liczy wybraną statystykę z jej etykietą', function () {
    $tournament = panelLeaderboardTournament('basketball');
    panelLeaderboardFinishedMatch($tournament, [['Oskar Dąb', 'three_pointer'], ['Oskar Dąb', 'foul']]);

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/leaderboard?stat=fouls")
        ->assertValidResponse(200)
        ->assertJsonPath('data.stat', 'fouls')
        ->assertJsonPath('data.label', 'Faule')
        ->assertJsonPath('data.rows.0.value', 1);
});

it('stat spoza availableStats sportu turnieju daje 422 pod stat', function () {
    $tournament = panelLeaderboardTournament('basketball');

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/leaderboard?stat=goals")
        ->assertValidResponse(422)
        ->assertOnlyJsonValidationErrors(['stat']);
});

it('cudzy turniej daje 403, zanim padnie 422 za stat', function () {
    $tournament = panelLeaderboardTournament();

    actingAsOrganizer(User::factory()->create())
        ->getJson("/api/v1/tournaments/{$tournament->id}/leaderboard?stat=nieznany")
        ->assertValidResponse(403);
});
