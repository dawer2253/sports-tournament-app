<?php

use App\Models\Group;
use App\Models\Stage;
use App\Models\Tournament;
use App\Models\User;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401 i 403 tej trasy pilnuje `SubtreeAuthorizationTest`, razem z każdą inną
// trasą poddrzewa turnieju. Tu zostaje szczęśliwa ścieżka i izolacja listy.

// Fazy powstają w kolejności innej niż `order`, więc wynik zgodny z `order`
// nie może wyjść przypadkiem z kolejności wstawiania ani z `id`.
it('oddaje fazy turnieju po order rosnąco, w kształcie z kontraktu', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $playoff = Stage::factory()->knockout()->for($tournament)->create(['order' => 3]);
    $league = Stage::factory()->for($tournament)->create(['order' => 1]);
    $groupStage = Stage::factory()->group()->for($tournament)->create(['order' => 2]);

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/stages")
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$league->id, $groupStage->id, $playoff->id])
        ->assertJsonPath('data.*.order', [1, 2, 3])
        ->assertJsonPath('data.0', [
            'id' => $league->id,
            'type' => 'league',
            'name' => 'Faza ligowa',
            'order' => 1,
            'groups' => [],
        ]);
});

// W v0.1 nie ma endpointu tworzenia grup, więc w praktyce `groups` są puste.
// Grupa z factory sprawdza, że relacja jest naprawdę wczytana i trafia do
// fazy, do której należy, a nie jest wpisaną na sztywno pustą tablicą.
it('oddaje grupy przy fazie, do której należą', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $league = Stage::factory()->for($tournament)->create(['order' => 1]);
    $groupStage = Stage::factory()->group()->for($tournament)->create(['order' => 2]);
    $group = Group::factory()->for($groupStage)->create(['name' => 'Grupa A']);

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/stages")
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.id', $league->id)
        ->assertJsonPath('data.0.groups', [])
        ->assertJsonPath('data.1.groups', [['id' => $group->id, 'name' => 'Grupa A']]);
});

// Oba turnieje należą do tego samego organizera, więc policy przepuści
// żądanie. Obce fazy odsiewa wyłącznie to, że lista idzie przez relację
// turnieju z trasy.
it('nie oddaje faz innego turnieju tego samego organizera', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $own = Stage::factory()->for($tournament)->create();
    Stage::factory()->for(Tournament::factory()->for($organizer))->create();

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/stages")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$own->id]);
});
