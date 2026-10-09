<?php

use App\Models\Tournament;
use App\Models\User;
use App\Models\Venue;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401 i 403 tej trasy pilnuje `SubtreeAuthorizationTest`, razem z każdą inną
// trasą poddrzewa turnieju. Tu zostaje szczęśliwa ścieżka i izolacja listy.

// Kolejność wstawiania to `stadion`, `Hala`, `Orlik`, `hala`. Sortowanie po
// `id` dałoby `stadion` na początku, a binarne (wielkie litery przed małymi)
// — na końcu. Tylko porównanie bez względu na wielkość liter daje kolejność
// z kontraktu. Dwie „hale" (collation widzi w nich tę samą nazwę) wychodzą
// w kolejności `id`, ale remisu test nie przypina: InnoDB trzyma wiersze
// w kolejności klucza głównego, więc oddaje je tak samo także bez
// `orderBy('id')`.
it('oddaje obiekty po nazwie bez względu na wielkość liter, w kształcie z kontraktu', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $stadium = Venue::factory()->for($tournament)->create(['name' => 'stadion', 'address' => null]);
    $hall = Venue::factory()->for($tournament)->create([
        'name' => 'Hala',
        'address' => 'ul. Sosnkowskiego 3, Warszawa',
    ]);
    $pitch = Venue::factory()->for($tournament)->create(['name' => 'Orlik']);
    $lowercaseHall = Venue::factory()->for($tournament)->create(['name' => 'hala']);

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/venues")
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$hall->id, $lowercaseHall->id, $pitch->id, $stadium->id])
        ->assertJsonPath('data.0', [
            'id' => $hall->id,
            'tournamentId' => $tournament->id,
            'name' => 'Hala',
            'address' => 'ul. Sosnkowskiego 3, Warszawa',
        ])
        ->assertJsonPath('data.3.address', null);
});

// Oba turnieje należą do tego samego organizera, więc policy przepuści
// żądanie. Obce obiekty odsiewa wyłącznie to, że lista idzie przez relację
// turnieju z trasy.
it('nie oddaje obiektów innego turnieju ani usuniętych', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $own = Venue::factory()->for($tournament)->create();
    Venue::factory()->for($tournament)->create()->delete();
    Venue::factory()->for(Tournament::factory()->for($organizer))->create();

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/venues")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$own->id]);
});
