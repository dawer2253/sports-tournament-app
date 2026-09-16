<?php

use App\Models\Tournament;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Spectator\Spectator;
use Symfony\Component\Yaml\Yaml;

// Każdy test kończy się asercją zgodności z kontraktem. To jedyny mechanizm,
// który wyłapie rozjazd backendu ze specyfikacją, zanim zobaczy go front
// (ADR 0001). Spectator dokłada prefiks `api/v1` sam, z konfiguracji.
beforeEach(function () {
    Spectator::using('openapi.yaml');
});

it('oddaje turnieje zalogowanego organizera w kształcie z kontraktu', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->for($organizer)->create(['name' => 'Liga Osiedlowa 2026']);

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.name', 'Liga Osiedlowa 2026')
        ->assertJsonPath('meta.total', 1);
});

it('nie pokazuje turniejów cudzego organizera', function () {
    Tournament::factory()->for(User::factory())->create();

    actingAsOrganizer()
        ->getJson('/api/v1/tournaments')
        ->assertValidResponse(200)
        ->assertJsonPath('data', [])
        ->assertJsonPath('meta.total', 0);
});

it('bez parametru oddaje wszystkie stany', function () {
    $organizer = User::factory()->create();
    foreach (['draft', 'active', 'finished'] as $status) {
        Tournament::factory()->for($organizer)->create(['status' => $status]);
    }

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments')
        ->assertValidResponse(200)
        ->assertJsonPath('meta.total', 3);
});

it('zawęża listę do jednego stanu', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->for($organizer)->create(['status' => 'active', 'name' => 'W toku']);
    Tournament::factory()->for($organizer)->create(['status' => 'finished']);

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments?status=active')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.name', 'W toku');
});

it('zawęża listę do kilku stanów podanych po przecinku', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->for($organizer)->create(['status' => 'draft']);
    Tournament::factory()->for($organizer)->create(['status' => 'active']);
    Tournament::factory()->for($organizer)->create(['status' => 'finished']);

    $response = actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments?status=draft,active')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('meta.total', 2);

    expect(collect($response->json('data'))->pluck('status')->sort()->values()->all())
        ->toBe(['active', 'draft']);
});

// Sedno ticketu #23 (ADR 0008): filtr zawęża zapytanie, nie pobraną stronę.
it('filtruje przed paginacją, więc meta opisuje zbiór już zawężony', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->for($organizer)->count(3)->create(['status' => 'active']);
    Tournament::factory()->for($organizer)->count(9)->create(['status' => 'finished']);

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments?status=active&perPage=2')
        ->assertValidResponse(200)
        ->assertJsonPath('meta.total', 3)
        ->assertJsonPath('meta.lastPage', 2)
        ->assertJsonPath('meta.perPage', 2)
        ->assertJsonPath('meta.currentPage', 1)
        ->assertJsonCount(2, 'data');
});

it('oddaje pełną stronę, gdy filtr przepuszcza więcej niż perPage', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->for($organizer)->count(5)->create(['status' => 'active']);

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments?status=active&perPage=2&page=2')
        ->assertValidResponse(200)
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.currentPage', 2);
});

it('odrzuca stan spoza enuma', function () {
    actingAsOrganizer()
        ->getJson('/api/v1/tournaments?status=bogus')
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('status');
});

it('odrzuca powtórzony stan', function () {
    actingAsOrganizer()
        ->getJson('/api/v1/tournaments?status=active,active')
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('status');
});

it('odrzuca pusty parametr status', function () {
    actingAsOrganizer()
        ->getJson('/api/v1/tournaments?status=')
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('status');
});

it('wymaga tokenu', function () {
    $this->getJson('/api/v1/tournaments')
        ->assertValidResponse(401);
});

it('oddaje najnowsze turnieje na górze, jak obiecuje kontrakt', function () {
    $organizer = User::factory()->create();
    $older = Tournament::factory()->for($organizer)
        ->create(['name' => 'Starszy', 'created_at' => now()->subDay()]);
    $newer = Tournament::factory()->for($organizer)
        ->create(['name' => 'Nowszy', 'created_at' => now()]);

    expect($newer->created_at)->toBeGreaterThan($older->created_at);

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments')
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.name', 'Nowszy')
        ->assertJsonPath('data.1.name', 'Starszy');
});

/*
 * ADR 0008 odrzucił `explode: true`, bo PHP zwija powtórzony klucz do ostatniej
 * wartości i filtr zawężałby się po cichu. Klient TS wysyła już przecinek, ale
 * curl i ręcznie sklejony link — niekoniecznie, więc backend musi ten kształt
 * odrzucić. Inaczej ADR obiecywałby ochronę, której nie ma.
 */
it('odrzuca powtórzony klucz status zamiast po cichu gubić wartości', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->for($organizer)->create(['status' => 'draft']);
    Tournament::factory()->for($organizer)->create(['status' => 'active']);

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments?status=draft&status=active')
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('status');
});

/*
 * `Tournament::STATUSES` powtarza enum z kontraktu i z migracji. Rozjazd byłby
 * cichy — kontrakt przepuściłby nowy stan, a backend oddałby na niego 422 —
 * więc wiążemy stałą z oboma źródłami naraz.
 */
it('trzyma stany turnieju zgodne z enumem TournamentStatus w kontrakcie', function () {
    // Ścieżkę bierzemy z configu Spectatora, żeby `SPEC_PATH` nie rozjechało
    // tego testu z asercjami zgodności kontraktu.
    $contractPath = config('spectator.sources.local.base_path').'/openapi.yaml';
    $contract = Yaml::parseFile($contractPath);

    expect($contract['components']['schemas']['TournamentStatus']['enum'])
        ->toBe(Tournament::STATUSES);
});

it('trzyma stany turnieju zgodne z enumem kolumny w bazie', function () {
    $column = DB::selectOne(
        'SELECT COLUMN_TYPE AS column_type
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?',
        ['tournaments', 'status'],
    );

    preg_match_all("/'([^']+)'/", $column->column_type, $matches);

    expect($matches[1])->toBe(Tournament::STATUSES);
});
