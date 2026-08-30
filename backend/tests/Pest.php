<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
