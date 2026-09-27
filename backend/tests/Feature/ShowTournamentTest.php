<?php

use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

it('odmawia szczegółów turnieju bez tokenu', function () {
    $tournament = Tournament::factory()->create();

    $this->getJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidRequest()
        ->assertValidResponse(401);
});

it('oddaje organizerowi jego turniej w kształcie z kontraktu, z liczbą drużyn', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->basketball()->for($organizer)->create([
        'name' => 'Puchar Zimowy',
        'slug' => 'puchar-zimowy',
        'primary_color' => '#1F7A45',
    ]);
    Team::factory()->count(3)->for($tournament)->create();

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.id', $tournament->id)
        ->assertJsonPath('data.slug', 'puchar-zimowy')
        ->assertJsonPath('data.sport', ['id' => $tournament->sport_id, 'code' => 'basketball', 'name' => 'Koszykówka'])
        ->assertJsonPath('data.branding', ['logoUrl' => null, 'primaryColor' => '#1F7A45'])
        ->assertJsonPath('data.teamsCount', 3);
});

// Turniej jest korzeniem własności (decyzja #5). Liczba drużyn to jedyne pole
// liczone z innej tabeli, więc drużyny cudzego turnieju nie mogą się do niej
// doliczyć.
it('liczy wyłącznie drużyny tego turnieju', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    Team::factory()->count(2)->for($tournament)->create();
    Team::factory()->count(4)->for(Tournament::factory()->for($organizer))->create();

    actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}")
        ->assertOk()
        ->assertJsonPath('data.teamsCount', 2);
});

// 403, a nie 404 — tak stanowi kontrakt (`Forbidden`). Panel traktuje oba tak
// samo, więc rozróżnienie jest dla kontraktu, nie dla UI. Tekst odmowy i 404
// dla nieistniejącego turnieju pilnuje `ErrorResponsesTest`, bo oba zdania
// kontrakt obiecuje wspólnie dla wszystkich ścieżek.
it('odmawia cudzego turnieju z 403 i nie oddaje jego danych', function () {
    $owner = User::factory()->create();
    $tournament = Tournament::factory()->for($owner)->create(['name' => 'Cudza Liga']);

    actingAsOrganizer()
        ->getJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidRequest()
        ->assertValidResponse(403)
        ->assertJsonMissingPath('data')
        ->assertDontSee('Cudza Liga');
});
