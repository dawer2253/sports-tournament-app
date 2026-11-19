<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

it('zmienia nazwę i e-mail konta', function () {
    $user = User::factory()->create(['name' => 'Dawid', 'email' => 'dawid@example.com']);

    actingAsOrganizer($user)
        ->patchJson('/api/v1/me', ['name' => 'Dawid Patko', 'email' => 'dawid.patko@example.com'])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', 'Dawid Patko')
        ->assertJsonPath('data.email', 'dawid.patko@example.com');

    expect($user->refresh())
        ->name->toBe('Dawid Patko')
        ->email->toBe('dawid.patko@example.com');
});

it('zmienia samą nazwę i przepuszcza własny, niezmieniony adres', function () {
    $user = User::factory()->create(['email' => 'dawid@example.com']);

    actingAsOrganizer($user)
        ->patchJson('/api/v1/me', ['name' => 'Nowa nazwa', 'email' => 'dawid@example.com'])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.name', 'Nowa nazwa');
});

it('odrzuca adres zajęty przez inne konto', function () {
    User::factory()->create(['email' => 'zajety@example.com']);
    $user = User::factory()->create(['email' => 'dawid@example.com']);

    actingAsOrganizer($user)
        ->patchJson('/api/v1/me', ['email' => 'zajety@example.com'])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonPath('errors.email.0', 'Pole e-mail jest już zajęte.');

    expect($user->refresh()->email)->toBe('dawid@example.com');
});

it('odmawia zmiany konta bez tokenu', function () {
    $this->patchJson('/api/v1/me', ['name' => 'Dawid Patko'])
        ->assertValidRequest()
        ->assertValidResponse(401);
});

it('zmienia hasło i unieważnia tokeny innych urządzeń', function () {
    $user = User::factory()->create(['password' => 'tajnehaslo123']);
    $laptop = $user->createToken('laptop')->plainTextToken;
    $phone = $user->createToken('phone')->plainTextToken;

    $this->withToken($laptop)
        ->putJson('/api/v1/me/password', [
            'currentPassword' => 'tajnehaslo123',
            'password' => 'nowehaslo456',
            'passwordConfirmation' => 'nowehaslo456',
        ])
        ->assertValidRequest()
        ->assertValidResponse(204);

    expect(Hash::check('nowehaslo456', $user->refresh()->password))->toBeTrue()
        ->and(PersonalAccessToken::findToken($laptop))->not->toBeNull()
        ->and(PersonalAccessToken::findToken($phone))->toBeNull();
});

it('odrzuca zmianę hasła przy złym obecnym haśle', function () {
    $user = User::factory()->create(['password' => 'tajnehaslo123']);

    actingAsOrganizer($user)
        ->putJson('/api/v1/me/password', [
            'currentPassword' => 'zlehaslo',
            'password' => 'nowehaslo456',
            'passwordConfirmation' => 'nowehaslo456',
        ])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('currentPassword');

    expect(Hash::check('tajnehaslo123', $user->refresh()->password))->toBeTrue();
});

it('odrzuca zmianę hasła, gdy powtórzone hasło się nie zgadza', function () {
    $user = User::factory()->create(['password' => 'tajnehaslo123']);

    actingAsOrganizer($user)
        ->putJson('/api/v1/me/password', [
            'currentPassword' => 'tajnehaslo123',
            'password' => 'nowehaslo456',
            'passwordConfirmation' => 'innehaslo456',
        ])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('password');
});

it('odmawia zmiany hasła bez tokenu', function () {
    $this->putJson('/api/v1/me/password', [
        'currentPassword' => 'tajnehaslo123',
        'password' => 'nowehaslo456',
        'passwordConfirmation' => 'nowehaslo456',
    ])
        ->assertValidRequest()
        ->assertValidResponse(401);
});
