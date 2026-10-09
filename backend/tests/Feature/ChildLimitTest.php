<?php

use App\Models\Tournament;
use App\Models\Venue;
use App\Rules\ChildLimit;
use Illuminate\Support\Facades\Validator;

// Komunikaty i klucze konkretnych limitów pilnują testy zasobów
// (`CreateTeamTest`, `CreatePlayerTest`, `CreateVenueTest`). Tu idzie samo
// porównanie z maksimum, na niskim limicie zamiast stałej z modelu.

/**
 * @return list<string>
 */
function childLimitErrors(Tournament $tournament, int $max): array
{
    $validator = Validator::make([], []);
    ChildLimit::check($tournament->venues(), $max, 'venues', 'Za dużo obiektów.')($validator);

    return $validator->errors()->get('venues');
}

it('przepuszcza, dopóki dzieci jest mniej niż maksimum', function () {
    $tournament = Tournament::factory()->create();
    Venue::factory()->for($tournament)->count(1)->create();

    expect(childLimitErrors($tournament, 2))->toBe([]);
});

it('dopisuje błąd pod wskazany klucz, gdy dzieci jest tyle co maksimum', function () {
    $tournament = Tournament::factory()->create();
    Venue::factory()->for($tournament)->count(2)->create();

    expect(childLimitErrors($tournament, 2))->toBe(['Za dużo obiektów.']);
});

it('nie liczy dzieci usuniętych miękko', function () {
    $tournament = Tournament::factory()->create();
    Venue::factory()->for($tournament)->count(2)->create()->first()->delete();

    expect(childLimitErrors($tournament, 2))->toBe([]);
});
