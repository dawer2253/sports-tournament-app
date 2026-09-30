<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Tournament;
use App\Models\Venue;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

it('usuwa obiekt miękko i oddaje 204', function () {
    $venue = Venue::factory()->create();

    actingAsOrganizer($venue->tournament->user)
        ->deleteJson("/api/v1/venues/{$venue->id}")
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

    actingAsOrganizer($venue->tournament->user)
        ->deleteJson("/api/v1/venues/{$venue->id}")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.id', ['Nie można usunąć: obiekt „Boisko Bemowo” ma powiązane rozegrane mecze.']);

    expect($venue->fresh()->deleted_at)->toBeNull();
});

// Na danych demo stoi krok przeciw Laravelowi w ekranie obiektów panelu (#116):
// „Boisko Bemowo" ma rozegrane mecze, „Hala Ursus" żadnego.
it('na danych demo odrzuca Boisko Bemowo, a usuwa Halę Ursus', function () {
    $this->seed();
    $tournament = Tournament::firstWhere('slug', 'liga-osiedlowa-2026');
    $bemowo = $tournament->venues()->where('name', 'Boisko Bemowo')->sole();
    $ursus = $tournament->venues()->where('name', 'Hala Ursus')->sole();

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/venues/{$bemowo->id}")
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('id');

    actingAsOrganizer($tournament->user)
        ->deleteJson("/api/v1/venues/{$ursus->id}")
        ->assertValidResponse(204);

    expect($bemowo->fresh()->deleted_at)->toBeNull()
        ->and($ursus->fresh()->deleted_at)->not->toBeNull();
});
