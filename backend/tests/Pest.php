<?php

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
