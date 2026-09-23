<?php

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Symfony\Component\Yaml\Yaml;

/*
|--------------------------------------------------------------------------
| Kształt odpowiedzi błędnych
|--------------------------------------------------------------------------
|
| Zakres #6 obejmuje spójny format błędów, nie tylko 422 i 401. Rodzina siedzi
| osobno od `AuthTest`, bo dotyczy tego, jak backend przerabia wyjątki na
| odpowiedzi, a nie autoryzacji — tu dojdzie też 403 razem z pierwszą policy
| (S1, przy zasobach turnieju).
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
// dla części z nich. To jest wariant, który wyjdzie domyślnie w S1: wszystkie
// ścieżki zasobów niosą parametr (`{tournament}`, `{team}`, `{player}`,
// `{venue}`).
//
// Trasa jest doraźna, bo `routes/api.php` ma dziś same cztery ścieżki
// autoryzacji, więc asercji Spectatora nie ma i mieć nie może — kontrakt takiej
// ścieżki nie zna. **Kiedy w S1 wejdzie pierwsza prawdziwa ścieżka z parametrem
// (np. `GET /tournaments/{tournament}`), przepnij ten test na nią i dołóż
// `assertValidResponse(404)`** — atrapa ma zniknąć razem z powodem, dla którego
// powstała.
it('oddaje to samo 404, gdy trasa istnieje, a model spod parametru nie', function () {
    Route::get('/api/v1/probny-zasob/{id}', fn (string $id) => User::findOrFail($id));

    $this->getJson('/api/v1/probny-zasob/999999')
        ->assertNotFound()
        ->assertJsonPath('message', 'Nie znaleziono zasobu.');
});

// Dwa testy wyżej powtarzają zdanie z kontraktu jako literał, więc rozejście
// się backendu z `openapi.yaml` byłoby dla nich niewidoczne — a to dokładnie
// klasa błędu z #53. Ten test czyta przykład ze speca i porównuje go
// z odpowiedzią, czyli pilnuje tego, czego Spectator nie pilnuje: on waliduje
// schemat (`message: { type: string }`), więc przechodzi mu dowolny tekst.
//
// Ścieżka do kontraktu idzie z konfiguracji Spectatora, żeby oba mechanizmy
// czytały ten sam plik.
it('mówi przy 404 dokładnie to, co obiecuje kontrakt', function () {
    $spec = Yaml::parseFile(
        config('spectator.sources.local.base_path').'/openapi.yaml'
    );

    $promised = $spec['components']['responses']['NotFound']['content']['application/json']['example']['message'];

    expect($promised)->toBeString()->not->toBeEmpty();

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
