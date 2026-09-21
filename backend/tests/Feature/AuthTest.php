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
        ->assertJsonValidationErrors('email')
        // Panel pokazuje pod formularzem korzeniowe `message`, nie mapę
        // `errors`, więc komunikat musi być po polsku właśnie tam.
        ->assertJsonPath('message', 'Nieprawidłowy e-mail lub hasło.');
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

// Komunikat spod reguły walidacji, a nie spod `auth.failed`: dowodzi, że po
// polsku jest cały `lang/pl`, a nie samo logowanie. Nazwa pola („e-mail", nie
// „email") pochodzi z sekcji `attributes`.
//
// `assertValidRequest()` celowo nie ma: żądanie jest niepełne z założenia, więc
// nie przechodzi walidacji kontraktu po stronie wejścia.
it('tłumaczy błędy walidacji rejestracji na polski', function () {
    $this->postJson('/api/v1/register', [
        'name' => 'Dawid Patko',
        'password' => 'tajnehaslo123',
        'passwordConfirmation' => 'tajnehaslo123',
    ])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.email.0', 'Pole e-mail jest wymagane.');
});

// Przy kilku błędach naraz Laravel skleja korzeniowe `message` z pierwszego
// komunikatu i doklejki „(and :count more errors)" — a ta idzie przez tłumacz
// łańcuchowy, nie przez `lang/pl/validation.php`, więc bez `lang/pl.json`
// zostawała po angielsku w polu, które panel pokazuje organizerowi.
//
// Asercja na pełnym stringu, bo dowodzi całej sklejki, a nie samej doklejki.
// Cena jest taka, że test zależy od kolejności reguł w `RegisterRequest`:
// przestawienie `name` na dalszą pozycję da czerwony test z mylącym
// komunikatem, choć sama odmiana będzie w porządku.
it('odmienia liczbę pozostałych błędów po polsku', function () {
    $this->postJson('/api/v1/register', [])
        ->assertValidResponse(422)
        ->assertJsonPath('message', 'Pole nazwa jest wymagane. (i jeszcze 3 błędy)');
});

// Formę doklejki wybiera wbudowana reguła `pl` Laravela
// (`MessageSelector::getPluralIndex()`), ale tylko wtedy, gdy `pl.json` podaje
// trzy segmenty rozdzielone `|`. Składnię zakresów (`[2,4]`, `[5,*]`) obsługuje
// `extract()`, które zwraca wcześniej i tę regułę wyłącza — wtedy 22–24, 102
// czy 122–124 dostają „błędów" zamiast „błędy".
//
// Pierwszy segment („błąd") jest tu produkcyjnie martwy: `summarize()` sięga po
// ten klucz dopiero od dwóch błędów wzwyż, a indeks 0 wypada wyłącznie dla
// jedynki. Mimo to musi zostać — `choose()` adresuje segmenty indeksem reguły,
// więc przy dwóch `isset($segments[2])` pada i wraca `$segments[0]`. Skasowanie
// go cicho zepsułoby 5, 12 i 111.
//
// Asercja idzie po tłumaczu, nie po HTTP, bo `/register` ma cztery pola i
// doklejka nie wyjdzie dziś poza 3. Próg zaczyna mieć znaczenie przy pierwszej
// regule tablicowej (`players.*.name`), gdzie liczba błędów idzie za długością
// listy — a `pl.json` obowiązuje wtedy bez zmian, globalnie.
it('odmienia doklejkę we wszystkich formach polskiej liczby mnogiej', function (int $count, string $expected) {
    expect(trans_choice('(and :count more errors)', $count, ['count' => $count]))
        ->toBe($expected);
})->with([
    [3, '(i jeszcze 3 błędy)'],
    [5, '(i jeszcze 5 błędów)'],
    [12, '(i jeszcze 12 błędów)'],
    [22, '(i jeszcze 22 błędy)'],
    [102, '(i jeszcze 102 błędy)'],
]);

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
