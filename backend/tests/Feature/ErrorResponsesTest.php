<?php

use App\Models\Tournament;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Exceptions;
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

/*
|--------------------------------------------------------------------------
| Kody spoza ścieżek kontraktu (#76)
|--------------------------------------------------------------------------
|
| 400, 405, 413, 500 i 503 oddaje warstwa frameworka na dowolnym żądaniu,
| więc kontrakt trzyma je we wspólnych `components/responses` i nie powtarza
| przy ścieżkach. Framework wpisuje tu napisy stałe po angielsku, z pominięciem
| translatora. Tekst zawsze z kontraktu, z tego samego powodu co przy 404.
|
| `app.debug` ustawiane jawnie, bo przy `true` framework dokleja `exception`
| i `trace`, a 500 zostaje wtedy celowo nieprzesłonięte.
|
*/

it('mówi przy 405 dokładnie to, co obiecuje kontrakt, i zostawia nagłówek Allow', function () {
    config(['app.debug' => false]);

    $this->getJson('/api/v1/login')
        ->assertMethodNotAllowed()
        ->assertHeader('Allow', 'POST')
        ->assertExactJson(['message' => contractErrorMessage('MethodNotAllowed')]);
});

// `ValidatePostSize` porównuje nagłówek `Content-Length` z `post_max_size`,
// zanim PHP w ogóle przeczyta ciało — wystarczy więc podać długość ponad
// limit, bez wysyłania stu megabajtów.
it('mówi przy 413 dokładnie to, co obiecuje kontrakt', function () {
    config(['app.debug' => false]);

    $this->call('POST', '/api/v1/login', server: [
        'HTTP_ACCEPT' => 'application/json',
        'CONTENT_LENGTH' => PHP_INT_MAX,
    ])
        ->assertStatus(413)
        ->assertExactJson(['message' => contractErrorMessage('PayloadTooLarge')]);
});

it('mówi przy 400 dokładnie to, co obiecuje kontrakt', function () {
    config(['app.debug' => false]);

    // `%C0` to bajt, który nie zaczyna żadnego poprawnego znaku UTF-8.
    $this->getJson('/api/v1/%C0')
        ->assertBadRequest()
        ->assertExactJson(['message' => contractErrorMessage('BadRequest')]);
});

// Klient bez `Accept` też ma dostać JSON (`$rendersJson` w `bootstrap/app.php`).
// Przy 400 to nie jest oczywiste: `Request::is('api/*')` dopasowuje wzorzec do
// *zdekodowanej* ścieżki regexem z flagą `u`, a ten na niepoprawnym UTF-8
// nie dopasowuje niczego — więc bez tego testu wychodziła strona HTML.
it('oddaje 400 jako JSON także bez nagłówka Accept', function () {
    config(['app.debug' => false]);

    $this->get('/api/v1/%C0')
        ->assertBadRequest()
        ->assertHeader('content-type', 'application/json')
        ->assertExactJson(['message' => contractErrorMessage('BadRequest')]);
});

it('mówi przy 503 dokładnie to, co obiecuje kontrakt, i zostawia Retry-After', function () {
    // Sterownik `file` pisze do `storage/framework/down`, który test dzieli
    // z działającym Sailem — położyłby go na czas testu (albo na stałe, gdyby
    // proces padł przed `finally`). `array` żyje tylko w tym procesie.
    config(['app.debug' => false, 'app.maintenance.driver' => 'array']);
    app()->maintenanceMode()->activate(['retry' => 60]);

    try {
        $this->getJson('/api/v1/sports')
            ->assertServiceUnavailable()
            ->assertHeader('Retry-After', '60')
            ->assertExactJson(['message' => contractErrorMessage('ServiceUnavailable')]);
    } finally {
        app()->maintenanceMode()->deactivate();
    }
});

it('mówi przy 500 dokładnie to, co obiecuje kontrakt, i dalej raportuje wyjątek', function () {
    config(['app.debug' => false]);
    Exceptions::fake();
    Route::get('/api/v1/probny-blad', fn () => throw new RuntimeException('szczegół z wnętrza'));

    $this->getJson('/api/v1/probny-blad')
        ->assertInternalServerError()
        ->assertExactJson(['message' => contractErrorMessage('ServerError')]);

    Exceptions::assertReported(RuntimeException::class);
});

it('oddaje to samo 500 przy gołym abort(500) z własnym tekstem', function () {
    config(['app.debug' => false]);
    Route::get('/api/v1/probny-abort', fn () => abort(500, 'Custom boom'));

    $this->getJson('/api/v1/probny-abort')
        ->assertInternalServerError()
        ->assertExactJson(['message' => contractErrorMessage('ServerError')]);
});

// Przy `APP_DEBUG=true` 500 to narzędzie deweloperskie: przesłonięcie nie
// może zabrać klasy wyjątku i śladu, bo tylko po nich widać, co pękło.
it('zostawia przy 500 w trybie debug wyjątek i ślad', function () {
    config(['app.debug' => true]);
    Route::get('/api/v1/probny-blad', fn () => throw new RuntimeException('szczegół z wnętrza'));

    $this->getJson('/api/v1/probny-blad')
        ->assertInternalServerError()
        ->assertJsonPath('message', 'szczegół z wnętrza')
        ->assertJsonPath('exception', RuntimeException::class)
        ->assertJsonStructure(['trace']);
});

// Mapa w `respond()` idzie po statusie, więc 422 omija ją z definicji. Ten
// test pilnuje, żeby tak zostało, gdyby ktoś przepisał 500 na
// `render(Throwable)` — przez niego przechodzi nieprzerobiona
// `ValidationException`. 401 pilnuje test „mówi przy 401…” wyżej.
it('nie zamienia w 500 błędu walidacji', function () {
    config(['app.debug' => false]);

    $this->postJson('/api/v1/login', [])
        ->assertUnprocessable()
        ->assertJsonPath('message', fn (string $message) => str_starts_with($message, 'Pole '))
        ->assertJsonStructure(['message', 'errors' => ['email', 'password']]);
});

// Kod, który sam zbudował odpowiedź i rzucił ją jako `HttpResponseException`,
// dostaje ją bez zmian — mapa przesłania wyłącznie napisy stałe frameworka.
// Rzucona z akcji w ogóle nie dociera do handlera (`Route::run()` ją łapie),
// więc test rzuca ją z middleware'u — to jedyna droga, na której wykluczenie
// w `respond()` cokolwiek zmienia.
it('nie przesłania odpowiedzi z HttpResponseException rzuconej w middleware', function () {
    config(['app.debug' => false]);
    app()->instance('probny-middleware', new class
    {
        public function handle(): never
        {
            throw new HttpResponseException(response()->json(['message' => 'Własny tekst.'], 503));
        }
    });
    Route::get('/api/v1/probna-odpowiedz', fn () => 'nieosiągalne')->middleware('probny-middleware');

    $this->getJson('/api/v1/probna-odpowiedz')
        ->assertServiceUnavailable()
        ->assertExactJson(['message' => 'Własny tekst.']);
});

// `Request::is()` patrzy na ścieżkę zdekodowaną, więc zakodowany prefiks też
// jest `api/*` — surowa ścieżka dołożona dla 400 nie może tego zgubić.
it('oddaje JSON bez nagłówka Accept także przy zakodowanym prefiksie api', function () {
    $this->get('/%61pi/v1/me')
        ->assertUnauthorized()
        ->assertHeader('content-type', 'application/json');
});
