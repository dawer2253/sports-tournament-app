<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\TeamRegistration;
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

it('oddaje daty turnieju z PATCH /tournaments/{tournament} w +00:00', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();

    $response = actingAsOrganizer($organizer)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", ['name' => 'Liga Osiedlowa 2026/27'])
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

// `kickoff_at` to `DATETIME` bez offsetu (ADR-0008), więc zapis w UTC musi
// wyjść z `+00:00`, a nie jako surowy Carbon z `…000000Z`.
it('oddaje termin meczu z GET /tournaments/{tournament}/matches w +00:00', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    GameMatch::factory()->for($round)->create(['kickoff_at' => '2026-10-25 09:00:00']);

    $response = actingAsOrganizer($organizer)
        ->getJson("/api/v1/tournaments/{$tournament->id}/matches")
        ->assertOk()
        ->assertJsonPath('data.0.kickoffAt', '2026-10-25T09:00:00+00:00');

    expectEveryDateInUtc($response, ['data.0.kickoffAt']);
});

it('oddaje termin meczu z PATCH /matches/{match} w +00:00', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    $match = GameMatch::factory()->for($round)->create(['kickoff_at' => '2026-10-25 09:00:00']);

    $response = actingAsOrganizer($organizer)
        ->patchJson("/api/v1/matches/{$match->id}", ['kickoffAt' => '2026-10-25T11:00:00+02:00'])
        ->assertOk()
        ->assertJsonPath('data.kickoffAt', '2026-10-25T09:00:00+00:00');

    expectEveryDateInUtc($response, ['data.kickoffAt']);
});

it('oddaje terminy meczów z terminarza i wyników strony publicznej w +00:00', function (string $path, string $status) {
    $tournament = Tournament::factory()->create(['status' => 'active']);
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    GameMatch::factory()->for($round)->create([
        'kickoff_at' => '2026-10-25 09:00:00',
        'status' => $status,
        'home_score' => $status === 'finished' ? 1 : null,
        'away_score' => $status === 'finished' ? 0 : null,
    ]);

    $response = $this->getJson("/api/v1/public/t/{$tournament->slug}{$path}")
        ->assertOk()
        ->assertJsonPath('data.0.kickoffAt', '2026-10-25T09:00:00+00:00');

    expectEveryDateInUtc($response, ['data.0.kickoffAt']);
})->with([
    'terminarz' => ['/fixtures', 'scheduled'],
    'wyniki' => ['/results', 'finished'],
]);

it('oddaje terminy meczów fazy strony publicznej w +00:00', function () {
    $tournament = Tournament::factory()->create(['status' => 'active']);
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    GameMatch::factory()->for($round)->create(['kickoff_at' => '2026-10-25 09:00:00']);

    $response = $this->getJson("/api/v1/public/t/{$tournament->slug}/matches?stageId={$round->stage_id}")
        ->assertOk()
        ->assertJsonPath('data.0.kickoffAt', '2026-10-25T09:00:00+00:00');

    expectEveryDateInUtc($response, ['data.0.kickoffAt']);
});

it('oddaje termin meczu ze strony meczu w +00:00', function () {
    $tournament = Tournament::factory()->create(['status' => 'active']);
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    $match = GameMatch::factory()->for($round)->create(['kickoff_at' => '2026-10-25 09:00:00']);

    $response = $this->getJson("/api/v1/public/t/{$tournament->slug}/matches/{$match->id}")
        ->assertOk()
        ->assertJsonPath('data.kickoffAt', '2026-10-25T09:00:00+00:00');

    expectEveryDateInUtc($response, ['data.kickoffAt']);
});

it('oddaje start części meczu trwającego w +00:00, w panelu i na stronie publicznej (#297)', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create(['status' => 'active']);
    $round = Round::factory()->for(Stage::factory()->for($tournament))->create();
    GameMatch::factory()->for($round)->live()->create(['kickoff_at' => '2026-10-25 09:00:00', 'live_period' => 2, 'period_started_at' => '2026-10-25 09:55:00']);

    $admin = actingAsOrganizer($organizer)->getJson("/api/v1/tournaments/{$tournament->id}/matches")->assertOk();
    $public = $this->getJson("/api/v1/public/t/{$tournament->slug}/fixtures")->assertOk();

    expectEveryDateInUtc($admin, ['data.0.periodStartedAt']);
    expectEveryDateInUtc($public, ['data.0.periodStartedAt']);
});

it('oddaje termin zapisów w panelu i na stronie publicznej w +00:00', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->openForRegistration()->create(['registration_deadline' => '2099-11-15 17:00:00']);

    $admin = actingAsOrganizer($organizer)->getJson("/api/v1/tournaments/{$tournament->id}")->assertOk();
    $public = $this->getJson("/api/v1/public/t/{$tournament->slug}")->assertOk();

    expectEveryDateInUtc($admin, ['data.registration.deadline']);
    expectEveryDateInUtc($public, ['data.registration.deadline']);
});

it('oddaje daty zgłoszeń z listy i z odrzucenia w +00:00', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->for($organizer)->create();
    TeamRegistration::factory()->rejected()->for($tournament)->create();
    $pending = TeamRegistration::factory()->for($tournament)->create();

    $list = actingAsOrganizer($organizer)->getJson("/api/v1/tournaments/{$tournament->id}/registrations")->assertOk();
    $rejected = actingAsOrganizer($organizer)->postJson("/api/v1/registrations/{$pending->id}/reject")->assertOk();

    expectEveryDateInUtc($list, ['data.0.createdAt', 'data.0.decidedAt', 'data.1.createdAt']);
    expectEveryDateInUtc($rejected, ['data.createdAt', 'data.decidedAt']);
});
