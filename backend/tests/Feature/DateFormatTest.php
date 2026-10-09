<?php

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Testing\TestResponse;

/*
|--------------------------------------------------------------------------
| Format dat w odpowiedziach (ADR-0008, #141)
|--------------------------------------------------------------------------
|
| „Konwencje" w kontrakcie obiecują `+00:00` przy każdej dacie, a Spectator
| tego nie złapie: surowy Carbon w zasobie wychodzi jako `…000000Z`, czyli też
| poprawny `date-time`. Test chodzi więc po całym ciele odpowiedzi i bierze
| każdy napis, który wygląda na datę, a nie listę znanych pól — data dopisana
| do zasobu trafia pod asercję sama.
|
*/

/**
 * Wszystkie napisy w ciele, które zaczynają się jak data ISO 8601, z kropkową
 * ścieżką do każdego z nich.
 *
 * @return array<string, string>
 */
function dateLikeStringsIn(TestResponse $response): array
{
    return collect(Arr::dot($response->json()))
        ->filter(fn ($value) => is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}T/', $value))
        ->all();
}

/**
 * @param  list<string>  $expectedPaths  pola, które muszą się znaleźć, żeby
 *                                       test nie przeszedł na pustym zbiorze
 */
function expectEveryDateInUtc(TestResponse $response, array $expectedPaths): void
{
    $dates = dateLikeStringsIn($response);

    expect(array_keys($dates))->toContain(...$expectedPaths);

    foreach ($dates as $path => $value) {
        expect($value)->toMatch(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/',
            "{$path} = {$value} nie ma formatu z „Konwencji” kontraktu",
        );
    }
}

it('oddaje daty konta z GET /me w +00:00', function () {
    $response = actingAsOrganizer()->getJson('/api/v1/me')->assertOk();

    expectEveryDateInUtc($response, ['data.createdAt']);
});

it('oddaje daty turnieju z GET /tournaments/{tournament} w +00:00', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();

    $response = actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}")
        ->assertOk();

    expectEveryDateInUtc($response, ['data.createdAt', 'data.updatedAt']);
});

it('oddaje daty turniejów z listy GET /tournaments w +00:00', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->count(2)->for($organizer)->create();

    $response = actingAsOrganizer($organizer)->getJson('/api/v1/tournaments')->assertOk();

    expectEveryDateInUtc($response, [
        'data.0.createdAt', 'data.0.updatedAt',
        'data.1.createdAt', 'data.1.updatedAt',
    ]);
});
