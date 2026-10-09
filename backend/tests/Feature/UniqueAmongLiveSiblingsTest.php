<?php

use App\Models\Player;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
use App\Rules\UniqueAmongLiveSiblings;
use Illuminate\Support\Facades\Validator;

// Zachowanie na trasach pilnują testy zasobów (`CreateTeamTest`,
// `UpdatePlayerTest`…). Tu idzie sama reguła, na tabeli niezależnej od nich.

function passesUniqueAmongLiveSiblings(mixed $value, Tournament $tournament, ?Venue $ignored = null): bool
{
    return Validator::make(
        ['name' => $value],
        ['name' => [UniqueAmongLiveSiblings::rule('venues', 'name', 'tournament_id', $tournament, $ignored)]],
    )->passes();
}

it('odrzuca wartość, którą ma już żywe rodzeństwo', function () {
    $venue = Venue::factory()->create(['name' => 'Hala Ursus']);

    expect(passesUniqueAmongLiveSiblings('Hala Ursus', $venue->tournament))->toBeFalse();
});

it('przepuszcza wartość rodzeństwa usuniętego miękko', function () {
    $venue = Venue::factory()->create(['name' => 'Hala Ursus']);
    $venue->delete();

    expect(passesUniqueAmongLiveSiblings('Hala Ursus', $venue->tournament))->toBeTrue();
});

it('przepuszcza tę samą wartość pod innym rodzicem', function () {
    Venue::factory()->create(['name' => 'Hala Ursus']);

    expect(passesUniqueAmongLiveSiblings('Hala Ursus', Tournament::factory()->create()))->toBeTrue();
});

it('pomija model ignorowany, ale nie jego rodzeństwo', function () {
    $venue = Venue::factory()->create(['name' => 'Hala Ursus']);
    Venue::factory()->for($venue->tournament)->create(['name' => 'Orlik']);

    expect(passesUniqueAmongLiveSiblings('Hala Ursus', $venue->tournament, $venue))->toBeTrue()
        ->and(passesUniqueAmongLiveSiblings('Orlik', $venue->tournament, $venue))->toBeFalse();
});

it('sprawdza wskazaną kolumnę, nie domyślną nazwę pola', function () {
    $player = Player::factory()->create(['number' => 9]);

    $passes = fn (Team $team) => Validator::make(
        ['shirt' => 9],
        ['shirt' => [UniqueAmongLiveSiblings::rule('players', 'number', 'team_id', $team)]],
    )->passes();

    expect($passes($player->team))->toBeFalse()
        ->and($passes(Team::factory()->create()))->toBeTrue();
});
