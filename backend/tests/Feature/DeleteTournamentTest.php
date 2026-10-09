<?php

use App\Exceptions\PublicFileCleanupException;
use App\Models\GameMatch;
use App\Models\Group;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use App\Models\Venue;
use Database\Factories\GameMatchFactory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Storage;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401 i 403 tej trasy pilnuje `SubtreeAuthorizationTest`. Jego przypadek 404
// (zasób usunięty miękko) trasę pomija, bo turniej nie ma `SoftDeletes`, więc
// 404 sprawdza ten plik. Decyzje, które ten plik przypina, zapadły w #83.

/**
 * Pełne poddrzewo turnieju, z drużyną usuniętą miękko i jej zawodnikiem.
 * Mecz domyślnie zostaje nierozegrany, bo rozegrany blokuje usunięcie.
 *
 * Funkcje tego pliku lądują w globalnej przestrzeni nazw Pesta, stąd prefiks
 * `tournamentDeletion` w każdej nazwie.
 *
 * @return array<class-string, list<int>> klasa modelu → id utworzonych wierszy
 */
function tournamentDeletionSubtree(Tournament $tournament, bool $withFinishedMatch = false): array
{
    $stage = Stage::factory()->group()->for($tournament)->create();
    $group = Group::factory()->for($stage)->create();
    $round = Round::factory()->for($stage)->create();
    $team = Team::factory()->for($tournament)->create();
    $player = Player::factory()->for($team)->create();
    $trashedTeam = Team::factory()->for($tournament)->create();
    $trashedPlayer = Player::factory()->for($trashedTeam)->create();
    $trashedTeam->delete();
    $venue = Venue::factory()->for($tournament)->create();
    $match = GameMatch::factory()
        ->for($round)
        ->when($withFinishedMatch, fn (GameMatchFactory $factory) => $factory->finished())
        ->create([
            'group_id' => $group->id,
            'home_team_id' => $team->id,
            'venue_id' => $venue->id,
        ]);
    $event = MatchEvent::factory()->for($match, 'match')->create([
        'team_id' => $team->id,
        'player_id' => $player->id,
    ]);

    return [
        Stage::class => [$stage->id],
        Group::class => [$group->id],
        Round::class => [$round->id],
        Team::class => [$team->id, $trashedTeam->id, $match->away_team_id],
        Player::class => [$player->id, $trashedPlayer->id],
        Venue::class => [$venue->id],
        GameMatch::class => [$match->id],
        MatchEvent::class => [$event->id],
    ];
}

/**
 * Liczy wiersze z pominięciem soft-deletes — usunięta miękko drużyna też ma
 * zniknąć z bazy.
 *
 * @param  array<class-string, list<int>>  $subtree
 * @return array<class-string, int>
 */
function tournamentDeletionRowsLeft(array $subtree): array
{
    return collect($subtree)
        ->map(fn (array $ids, string $model): int => (new $model)->newQueryWithoutScopes()->whereKey($ids)->count())
        ->all();
}

/** @param  array<class-string, list<int>>  $subtree */
function expectTournamentDeletionSubtreeIntact(array $subtree): void
{
    expect(tournamentDeletionRowsLeft($subtree))->toBe(array_map(count(...), $subtree));
}

/**
 * Logo turnieju i herby dwóch drużyn, z których jedna jest potem usunięta
 * miękko. Wgrane przez API, żeby pliki leżały tam, gdzie kładzie je upload.
 * Zwraca katalog turnieju na dysku `public`.
 */
function tournamentDeletionFiles(Tournament $tournament): string
{
    $upload = fn (string $uri) => actingAsOrganizer($tournament->user)
        ->post($uri, ['logo' => UploadedFile::fake()->image('logo.png', 128, 128)], multipartHeaders())
        ->assertValidRequest()
        ->assertValidResponse(200);

    $teams = Team::factory()->for($tournament)->count(2)->create();
    $upload("/api/v1/tournaments/{$tournament->id}/logo");
    $teams->each(fn (Team $team) => $upload("/api/v1/teams/{$team->id}/logo"));
    $teams->last()->delete();

    $directory = "tournaments/{$tournament->id}";
    expect(Storage::disk('public')->allFiles($directory))->toHaveCount(3);

    return $directory;
}

it('usuwa turniej i oddaje 204, a potem turniej daje 404', function () {
    $tournament = Tournament::factory()->create();

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidRequest()
        ->assertValidResponse(204)
        ->assertNoContent();

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(404);

    expect(Tournament::find($tournament->id))->toBeNull();
});

// Panel traktuje 404 przy usuwaniu jak sukces (#83), np. po drugim kliknięciu
// albo gdy turniej usunięto w innej karcie — więc drugie usunięcie ma dać
// zwykłe 404 z kontraktu, a nie 500.
it('oddaje 404, gdy turniej już usunięto', function () {
    $tournament = Tournament::factory()->create();

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(204);

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidRequest()
        ->assertValidResponse(404)
        ->assertExactJson(['message' => contractErrorMessage('NotFound')]);
});

// Kaskadę robi baza, więc test czyta tabele z pominięciem soft-deletes.
// Turniej tego samego organizera pilnuje, że kaskada nie wychodzi poza
// usuwany turniej.
it('usuwa całe poddrzewo turnieju, także drużyny usunięte miękko, i tylko je', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $otherTournament = Tournament::factory()->for($organizer)->create();
    $subtree = tournamentDeletionSubtree($tournament);
    $otherSubtree = tournamentDeletionSubtree($otherTournament);

    actingAsOrganizer($organizer)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(204);

    expect(tournamentDeletionRowsLeft($subtree))->each->toBe(0)
        ->and($otherTournament->fresh())->not->toBeNull();
    expectTournamentDeletionSubtreeIntact($otherSubtree);
});

it('zwalnia slug: po usunięciu nowy turniej dostaje ten sam adres', function () {
    $organizer = User::factory()->create();
    $payload = ['name' => 'Liga Osiedlowa 2026', 'sportId' => sport('football')->id, 'format' => 'league'];

    $id = actingAsOrganizer($organizer)
        ->postJson('/api/v1/tournaments', $payload)
        ->assertJsonPath('data.slug', 'liga-osiedlowa-2026')
        ->json('data.id');

    actingAsOrganizer($organizer)
        ->deleteJson("/api/v1/tournaments/{$id}")
        ->assertValidResponse(204);

    actingAsOrganizer($organizer)
        ->postJson('/api/v1/tournaments', $payload)
        ->assertValidResponse(201)
        ->assertJsonPath('data.slug', 'liga-osiedlowa-2026');
});

it('nie usuwa turnieju ani jego poddrzewa, gdy w turnieju rozegrano mecz', function () {
    $tournament = Tournament::factory()->create(['name' => 'Liga Osiedlowa 2026']);
    $subtree = tournamentDeletionSubtree($tournament, withFinishedMatch: true);

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: turniej „Liga Osiedlowa 2026” ma powiązane rozegrane mecze.']);

    expect($tournament->fresh())->not->toBeNull();
    expectTournamentDeletionSubtreeIntact($subtree);
});

it('usuwa turniej ze statusem finished, jeżeli nie rozegrano w nim meczu', function () {
    $tournament = Tournament::factory()->create(['status' => 'finished']);
    GameMatch::factory()->for(Round::factory()->for(Stage::factory()->for($tournament)))->create();

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(204);

    expect(Tournament::find($tournament->id))->toBeNull();
});

// Pełny cykl z #83: katalog turnieju znika w całości, razem z herbem drużyny
// usuniętej wcześniej miękko, a katalog innego turnieju zostaje.
it('kasuje katalog turnieju z logo i herbami, także drużyny usuniętej miękko', function () {
    fakePublicDisk();
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $otherTournament = Tournament::factory()->for($organizer)->create();
    $directory = tournamentDeletionFiles($tournament);
    $otherDirectory = tournamentDeletionFiles($otherTournament);

    actingAsOrganizer($organizer)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(204);

    Storage::disk('public')->assertMissing($directory);
    expect(Storage::disk('public')->allFiles($otherDirectory))->toHaveCount(3);
});

it('nie rusza katalogu turnieju, którego nie można usunąć', function () {
    fakePublicDisk();
    $tournament = Tournament::factory()->create();
    $directory = tournamentDeletionFiles($tournament);
    tournamentDeletionSubtree($tournament, withFinishedMatch: true);

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(422);

    expect(Storage::disk('public')->allFiles($directory))->toHaveCount(3);
});

it('zgłasza nieudane skasowanie katalogu do report() i oddaje 204', function () {
    fakePublicDisk();
    Exceptions::fake();
    $tournament = Tournament::factory()->create();
    $directory = tournamentDeletionFiles($tournament);
    failDeletionsOnPublicDisk();

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(204);

    expect(Tournament::find($tournament->id))->toBeNull();
    Exceptions::assertReported(fn (PublicFileCleanupException $e): bool => str_contains($e->getMessage(), "„{$directory}”"));
});
