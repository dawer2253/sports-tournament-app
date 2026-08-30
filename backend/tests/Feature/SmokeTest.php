<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Smoke testy środowiska: dowodzą, że kontenery Saila wstały i że aplikacja
// dogaduje się z MySQL-em. Testy endpointów żyją osobno, przy swoich zasobach.

it('odpowiada na health check', function () {
    $this->getJson('/')->assertOk()->assertExactJson(['status' => 'ok']);
});

it('używa MySQL-a, a nie domyślnego SQLite', function () {
    expect(DB::connection()->getDriverName())->toBe('mysql');
});

it('wykonuje zapytanie do bazy', function () {
    expect(DB::select('select 1 as ok')[0]->ok)->toBe(1);
});

it('ma zmigrowaną bazę testową', function () {
    expect(Schema::hasTable('users'))->toBeTrue();
});
