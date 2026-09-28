<?php

use App\Models\Tournament;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Kształt odpowiedzi błędnych
|--------------------------------------------------------------------------
|
| Zakres #6 obejmuje spójny format błędów, nie tylko 422 i 401. Rodzina siedzi
| osobno od `AuthTest`, bo dotyczy tego, jak backend przerabia wyjątki na
| odpowiedzi, a nie autoryzacji. 403 siedzi tu razem z 404, bo oba teksty
| obiecuje kontrakt wspólnie dla wszystkich ścieżek.
|
| Ścieżek spoza kontraktu Spectator z definicji nie zwaliduje, więc asercje idą
| na treści. `assertJsonStructure(['message'])` tu nie wystarcza: goły
| `abort(404)` oddaje `{"message": ""}`, co strukturę przechodzi, a klientowi
| nie mówi nic.
|
*/

it('oddaje 404 jako JSON w kształcie z kontraktu', function () {
    $this->getJson('/api/v1/nie-ma-takiego-zasobu')
        ->assertNotFound()
        ->assertHeader('content-type', 'application/json')
        ->assertJsonPath('message', 'Nie znaleziono zasobu.');
});

// Drugi wariant 404 — jest trasa, nie ma modelu spod jej parametru. Kontrakt
// ma na wszystkie ścieżki jedną odpowiedź `NotFound`, więc oba warianty muszą
// mówić to samo zdanie; bez tego przykład w kontrakcie jest prawdziwy tylko
// dla części z nich. Wszystkie ścieżki zasobów niosą parametr (`{tournament}`,
// `{team}`, `{player}`, `{venue}`), więc to jest wariant, który wychodzi
// najczęściej.
it('oddaje to samo 404, gdy trasa istnieje, a model spod parametru nie', function () {
    Spectator::using('openapi.yaml');

    actingAsOrganizer()
        ->getJson('/api/v1/tournaments/999999')
        ->assertValidResponse(404)
        ->assertJsonPath('message', 'Nie znaleziono zasobu.');
});

// Dwa testy wyżej powtarzają zdanie z kontraktu jako literał, więc rozejście
// się backendu z `openapi.yaml` byłoby dla nich niewidoczne — a to dokładnie
// klasa błędu z #53. Ten test czyta przykład ze speca i porównuje go
// z odpowiedzią, czyli pilnuje tego, czego Spectator nie pilnuje: on waliduje
// schemat (`message: { type: string }`), więc przechodzi mu dowolny tekst.
it('mówi przy 404 dokładnie to, co obiecuje kontrakt', function () {
    $promised = contractErrorMessage('NotFound');

    $this->getJson('/api/v1/nie-ma-takiego-zasobu')
        ->assertNotFound()
        ->assertJsonPath('message', $promised);
});

// Przesłonięcie kasuje oryginalny komunikat, a `laravel.log` go nie dostaje:
// `HttpException` i `ModelNotFoundException` są w `Handler::$internalDontReport`,
// więc 404 nigdy nie była raportowana. `Log::debug` jest jedynym jej śladem
// i bez tego testu nikt by nie zauważył, że zniknął — odpowiedź dla klienta
// wygląda przecież tak samo.
//
// `app.debug` ustawiane jawnie, a nie brane z `.env`, żeby test znaczył to samo
// u każdego i w CI.
it('zostawia w dev ślad po oryginalnym komunikacie 404', function () {
    config(['app.debug' => true]);
    Log::spy();

    $this->getJson('/api/v1/nie-ma-takiego-zasobu')->assertNotFound();

    Log::shouldHaveReceived('debug')
        ->withArgs(fn (string $message, array $context = []) => str_contains($message, 'nie-ma-takiego-zasobu'))
        ->once();
});

it('nie loguje 404 poza trybem debug', function () {
    config(['app.debug' => false]);
    Log::spy();

    $this->getJson('/api/v1/nie-ma-takiego-zasobu')->assertNotFound();

    Log::shouldNotHaveReceived('debug');
});

// 401 i 403 frameworka to napisy stałe poza translatorem, więc `lang/pl` ich
// nie tłumaczy — po polsku mówią wyłącznie dzięki przesłonięciu
// w `bootstrap/app.php`. Tekst czytany z kontraktu, bo Spectator przepuszcza
// dowolny `message` (klasa błędu z #53). Dotyczy to obu testów niżej.
it('mówi przy 403 dokładnie to, co obiecuje kontrakt', function () {
    $promised = contractErrorMessage('Forbidden');

    $foreign = Tournament::factory()->create();

    actingAsOrganizer()
        ->getJson("/api/v1/tournaments/{$foreign->id}")
        ->assertForbidden()
        ->assertJsonPath('message', $promised);
});

it('mówi przy 401 dokładnie to, co obiecuje kontrakt', function () {
    $promised = contractErrorMessage('Unauthenticated');

    $this->getJson('/api/v1/me')
        ->assertUnauthorized()
        ->assertJsonPath('message', $promised);
});

// Odmowa policy i goły `abort(403)` to dwa różne wyjątki: pierwszy framework
// zamienia w `AccessDeniedHttpException`, drugi zostaje zwykłym
// `HttpException(403)`. Przesłonięcie łapiące tylko ten pierwszy przeszłoby
// test policy wyżej, a `abort(403)` mówiłby po angielsku albo własnym tekstem.
// Trasa jest doraźna, bo w `app/` nie ma dziś żadnego `abort(403)`.
it('oddaje to samo 403 przy gołym abort z własnym tekstem', function () {
    Route::get('/api/v1/probna-odmowa', fn () => abort(403, 'Custom deny'));

    $this->getJson('/api/v1/probna-odmowa')
        ->assertForbidden()
        ->assertJsonPath('message', contractErrorMessage('Forbidden'));
});
