<?php

use App\Models\Sport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| Testy funkcjonalne biegną na bazie "testing" (patrz phpunit.xml), którą Sail
| zakłada przy pierwszym starcie kontenera MySQL. RefreshDatabase migruje ją
| przed każdym testem, więc zestaw nie zależy od stanu bazy deweloperskiej.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Helpery
|--------------------------------------------------------------------------
|
| Autoryzacja to token Bearer w nagłówku (kontrakt, `securitySchemes`), więc
| test nie używa `actingAs()` — przechodzi tą samą drogą co panel, przez
| prawdziwy token Sanctuma.
|
*/

function actingAsOrganizer(?User $user = null): TestCase
{
    $user ??= User::factory()->create();

    return test()->withToken($user->createToken('test')->plainTextToken);
}

/**
 * Sporty wstawia migracja (decyzja #10), więc test bierze je z bazy po kodzie,
 * a nie z factory — `SportFactory` celowo nie istnieje.
 */
function sport(string $code): Sport
{
    return Sport::where('code', $code)->firstOrFail();
}

/**
 * Komunikat, który kontrakt obiecuje we wspólnej odpowiedzi błędu
 * (`components/responses/{name}`). Spectator waliduje schemat, nie przykład,
 * więc zgodność tekstu trzeba asertować osobno (klasa błędu z #53). Ścieżka
 * idzie z konfiguracji Spectatora, żeby oba mechanizmy czytały ten sam plik.
 */
function contractErrorMessage(string $response): string
{
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $message = $spec['components']['responses'][$response]['content']['application/json']['example']['message'];

    expect($message)->toBeString()->not->toBeEmpty();

    return $message;
}
