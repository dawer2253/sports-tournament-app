<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Spectator\Spectator;

// Każdy test kończy się asercją zgodności z kontraktem. To jedyny mechanizm,
// który wyłapie rozjazd backendu ze specyfikacją, zanim zobaczy go front
// (ADR 0001). Spectator dokłada prefiks `api/v1` sam, z konfiguracji.
beforeEach(function () {
    Spectator::using('openapi.yaml');
});

it('zakłada konto i wydaje token', function () {
    $this->postJson('/api/v1/register', [
        'name' => 'Dawid Patko',
        'email' => 'dawid@example.com',
        'password' => 'tajnehaslo123',
        'passwordConfirmation' => 'tajnehaslo123',
    ])
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data.user.email', 'dawid@example.com');

    expect(User::where('email', 'dawid@example.com')->exists())->toBeTrue();
});

it('odrzuca rejestrację na zajęty adres', function () {
    User::factory()->create(['email' => 'dawid@example.com']);

    $this->postJson('/api/v1/register', [
        'name' => 'Dawid Patko',
        'email' => 'dawid@example.com',
        'password' => 'tajnehaslo123',
        'passwordConfirmation' => 'tajnehaslo123',
    ])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('email');
});

it('odrzuca rejestrację, gdy powtórzone hasło się nie zgadza', function () {
    $this->postJson('/api/v1/register', [
        'name' => 'Dawid Patko',
        'email' => 'dawid@example.com',
        'password' => 'tajnehaslo123',
        'passwordConfirmation' => 'innehaslo123',
    ])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('password');
});

it('loguje przy poprawnym haśle', function () {
    User::factory()->create([
        'email' => 'dawid@example.com',
        'password' => 'tajnehaslo123',
    ]);

    $this->postJson('/api/v1/login', [
        'email' => 'dawid@example.com',
        'password' => 'tajnehaslo123',
    ])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.user.email', 'dawid@example.com');
});

// Kontrakt nie przewiduje przy `/login` odpowiedzi 401 — nieudane logowanie to
// błąd walidacji pola `email`, tak jak w domyślnym zachowaniu Laravela.
it('odrzuca logowanie przy złym haśle jako błąd walidacji', function () {
    User::factory()->create([
        'email' => 'dawid@example.com',
        'password' => 'tajnehaslo123',
    ]);

    $this->postJson('/api/v1/login', [
        'email' => 'dawid@example.com',
        'password' => 'zlehaslo123',
    ])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('email');
});

it('odrzuca logowanie na nieistniejące konto jako błąd walidacji', function () {
    $this->postJson('/api/v1/login', [
        'email' => 'nikt@example.com',
        'password' => 'tajnehaslo123',
    ])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors('email');
});

it('oddaje zalogowanego organizera', function () {
    $user = User::factory()->create(['email' => 'dawid@example.com']);

    actingAsOrganizer($user)
        ->getJson('/api/v1/me')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.email', 'dawid@example.com');
});

it('wylogowuje i unieważnia użyty token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/logout')
        ->assertValidRequest()
        ->assertValidResponse(204);

    expect(PersonalAccessToken::findToken($token))->toBeNull();

    // Aplikacja nie wstaje między żądaniami w obrębie jednego testu, a strażnik
    // trzyma raz rozwiązanego użytkownika w pamięci. Bez tego drugie żądanie
    // dostałoby 200 na nieistniejącym już tokenie i test dowodziłby nieprawdy.
    Auth::forgetGuards();

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertValidRequest()
        ->assertValidResponse(401);
});

it('unieważnia tylko token użyty do wylogowania', function () {
    $user = User::factory()->create();
    $laptop = $user->createToken('laptop')->plainTextToken;
    $phone = $user->createToken('phone')->plainTextToken;

    $this->withToken($laptop)->postJson('/api/v1/logout')->assertNoContent();

    expect(PersonalAccessToken::findToken($phone))->not->toBeNull();
});

it('odmawia dostępu do zasobu chronionego bez tokenu', function () {
    $this->getJson('/api/v1/me')
        ->assertValidRequest()
        ->assertValidResponse(401);
});

it('odmawia dostępu przy zmyślonym tokenie', function () {
    $this->withToken('1|nieistniejacytoken')
        ->getJson('/api/v1/me')
        ->assertValidRequest()
        ->assertValidResponse(401);
});

it('odmawia wylogowania bez tokenu', function () {
    $this->postJson('/api/v1/logout')
        ->assertValidRequest()
        ->assertValidResponse(401);
});

// Zakres #6 obejmuje spójny format błędów, nie tylko 422 i 401. Ścieżki spoza
// kontraktu Spectator z definicji nie zwaliduje, więc sprawdzamy sam kształt:
// backend oddaje wyłącznie JSON, nigdy strony błędu Laravela.
// 403 dochodzi razem z pierwszą policy, czyli w S1 przy zasobach turnieju.
it('oddaje 404 jako JSON w kształcie z kontraktu', function () {
    $this->getJson('/api/v1/nie-ma-takiego-zasobu')
        ->assertNotFound()
        ->assertHeader('content-type', 'application/json')
        ->assertJsonStructure(['message']);
});
