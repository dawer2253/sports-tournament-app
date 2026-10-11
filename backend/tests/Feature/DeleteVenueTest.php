<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

/**
 * Ląduje w globalnej przestrzeni nazw, wspólnej dla całego przebiegu Pesta,
 * stąd nazwa, której nie użyje inny plik.
 */
function deleteVenue(Venue $venue): TestResponse
{
    return actingAsOrganizer($venue->tournament->user)
        ->deleteJson("/api/v1/venues/{$venue->id}");
}

it('usuwa obiekt miękko i oddaje 204', function () {
    $venue = Venue::factory()->create();

    deleteVenue($venue)
        ->assertValidRequest()
        ->assertValidResponse(204);

    expect(Venue::withTrashed()->findOrFail($venue->id)->trashed())->toBeTrue();
});

it('nie usuwa obiektu z meczem rozegranym albo trwającym i nie odpina go od meczów', function (string $status) {
    $venue = Venue::factory()->create(['name' => 'Boisko Bemowo']);
    $round = Round::factory()->for(Stage::factory()->for($venue->tournament))->create();
    GameMatch::factory()->for($round)->played($status)->create(['venue_id' => $venue->id]);
    $scheduled = GameMatch::factory()->for($round)->create(['match_number' => 2, 'venue_id' => $venue->id]);

    deleteVenue($venue)
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: obiekt „Boisko Bemowo” ma rozegrane lub trwające mecze.']);

    expect($venue->fresh()->deleted_at)->toBeNull()
        ->and($scheduled->fresh()->venue_id)->toBe($venue->id);
})->with(['live', 'finished']);

// Mecz na innym obiekcie stoi obok, żeby odpięcie szło po obiekcie, a nie
// po turnieju. W meczach usuniętego obiektu zmienia się tylko `venue_id`.
it('odpina obiekt od meczów scheduled, a reszty meczu nie rusza', function () {
    $venue = Venue::factory()->create();
    $other = Venue::factory()->for($venue->tournament)->create();
    $round = Round::factory()->for(Stage::factory()->for($venue->tournament))->create();
    $matches = GameMatch::factory()->count(2)->for($round)
        ->sequence(['match_number' => 1], ['match_number' => 2])
        ->create(['venue_id' => $venue->id]);
    $elsewhere = GameMatch::factory()->for($round)->create(['match_number' => 3, 'venue_id' => $other->id]);
    $columns = ['round_id', 'match_number', 'home_team_id', 'away_team_id', 'status', 'kickoff_at'];

    deleteVenue($venue)->assertValidResponse(204);

    foreach ($matches as $match) {
        $after = $match->fresh();
        expect($after->venue_id)->toBeNull()
            ->and($after->only($columns))->toEqual($match->only($columns));
    }
    expect(GameMatch::where('venue_id', $venue->id)->exists())->toBeFalse()
        ->and($elsewhere->fresh()->venue_id)->toBe($other->id);
});

// Na danych demo stoi krok przeciw Laravelowi w ekranie obiektów panelu (#116):
// „Boisko Bemowo" ma rozegrane mecze, „Hala Ursus" żadnego.
it('na danych demo odrzuca Boisko Bemowo, a usuwa Halę Ursus', function () {
    $this->seed();
    $tournament = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');
    $pitchWithMatches = $tournament->venues()->where('name', 'Boisko Bemowo')->sole();
    $hallWithoutMatches = $tournament->venues()->where('name', 'Hala Ursus')->sole();

    deleteVenue($pitchWithMatches)
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('id');

    deleteVenue($hallWithoutMatches)->assertValidResponse(204);

    expect($pitchWithMatches->fresh()->deleted_at)->toBeNull()
        ->and($hallWithoutMatches->fresh()->deleted_at)->not->toBeNull();
});
