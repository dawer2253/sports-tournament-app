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

it('nie usuwa obiektu z rozegranym meczem', function () {
    $venue = Venue::factory()->create(['name' => 'Boisko Bemowo']);
    GameMatch::factory()
        ->for(Round::factory()->for(Stage::factory()->for($venue->tournament)))
        ->finished()
        ->create(['venue_id' => $venue->id]);

    deleteVenue($venue)
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: obiekt „Boisko Bemowo” ma powiązane rozegrane mecze.']);

    expect($venue->fresh()->deleted_at)->toBeNull();
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
