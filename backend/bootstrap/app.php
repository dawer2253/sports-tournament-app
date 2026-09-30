<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Czy odpowiedź dla tego żądania ma być JSON-em. Backend oddaje wyłącznie JSON
 * (patrz `AGENTS.md`), ale `expectsJson()` samo nie wystarcza: klient bez
 * nagłówka `Accept` też ma dostać kształt z kontraktu, nie stronę błędu.
 *
 * Prefiks sprawdzany dwa razy. `is()` dopasowuje wzorzec do ścieżki
 * zdekodowanej (więc łapie `/%61pi/...`), ale regexem z flagą `u` — na
 * niepoprawnym UTF-8 (`/api/v1/%C0`, czyli 400) nie dopasowuje niczego i klient
 * bez `Accept` dostawał stronę HTML. Tam ratuje surowa ścieżka.
 */
$rendersJson = fn (Request $request): bool => $request->is('api/*')
    || str_starts_with($request->path(), 'api/')
    || $request->expectsJson();

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        // Kontrakt zakłada `http://localhost:8000/api/v1` (`servers[].url`).
        // `install:api` ustawia samo `api`, wersję dokładamy tutaj.
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Bez tego żądanie bez tokenu i bez `Accept: application/json` kończy
        // się 500, nie 401 z kontraktu. `Authenticate::unauthenticated()`
        // liczy adres przekierowania zachłannie i warunkuje go `expectsJson()`,
        // a nie `shouldRenderJsonWhen()` niżej — więc wchodzi domyślny callback
        // frameworka `fn () => route('login')`, a trasy `login` ten backend nie
        // ma i mieć nie będzie (logowanie to `POST /api/v1/login`, bez nazwy).
        // `null` znaczy „nie przekierowuj", i wtedy handler oddaje JSON-owe 401.
        $middleware->redirectGuestsTo(null);
    })
    ->withExceptions(function (Exceptions $exceptions) use ($rendersJson): void {
        $exceptions->shouldRenderJsonWhen($rendersJson);

        // Kody z jednym zdaniem w kontrakcie: 401 (`Unauthenticated`),
        // 403 (`Forbidden`), 404 (`NotFound`) i te, które warstwa frameworka
        // oddaje na dowolnym żądaniu (#76). Framework ma na nie napisy stałe
        // po angielsku, spoza translatora (`lang/pl` ich nie ruszy), albo —
        // przy 500 ze zwykłego wyjątku — jego wewnętrzny komunikat.
        //
        // `respond()`, a nie `render()`, bo działa na gotowej odpowiedzi według
        // jej statusu. `render()` dla 500 musiałby łapać `Throwable`, a przez
        // niego przechodzą jeszcze nieprzerobione `ValidationException`
        // i `AuthenticationException` — każdy trzeba by wykluczać ręcznie.
        // Po statusie 422 omija mapę sam, nagłówki (`Allow`, `Retry-After`)
        // zostają, a jeden wpis obejmuje każdą drogę do danego kodu: odmowę
        // policy i goły `abort(403)`, wyjątek i `abort(500)`. Przy 404 to trzy
        // teksty spod routera, wyszukania modelu i gołego `abort(404)` oraz
        // czwarta droga, której klasa wyjątku nie złapie: `denyAsNotFound()`
        // z policy `Handler::prepareException()` robi zwykłym
        // `HttpException(404)`, nie `NotFoundHttpException`.
        //
        // Konsekwencja przyjęta świadomie: własny tekst z `abort(4xx/5xx, '...')`
        // czy `Response::deny('...')` zostanie tu skasowany. `Log::debug` jest
        // wtedy **jedynym** śladem po nim — `HttpException`
        // i `ModelNotFoundException` siedzą w `Handler::$internalDontReport`,
        // więc nie trafiają do `laravel.log`. Bez tej linii literówka w URL-u
        // czy powód odmowy przestają być widoczne gdziekolwiek (research §4).
        //
        // Omijamy `HttpResponseException` (dociera tu tylko spod middleware'u,
        // z akcji łapie ją `Route::run()`): tę odpowiedź kod zbudował celowo.
        // Przy `APP_DEBUG` 500 zostaje z `exception` i `trace` (i bez
        // `Log::debug` niżej — tekst i tak jest w odpowiedzi); pozostałe kody
        // je tracą, bo nie niosły nic poza napisem stałym albo tekstem, który
        // i tak ląduje w logu (401 oddawał sam komunikat, research §6). Pułapki
        // i 429: `backend/AGENTS.md`.
        //
        // Teksty są przykładami z `components/responses` — pilnuje tego
        // `ErrorResponsesTest`.
        //
        // **Kolejne kody dokładaj do tej mapy, nie w drugim `respond()`.**
        // `respond()` nie dokłada callbacku, tylko go podmienia
        // (`Handler::respondUsing()` nadpisuje `$finalizeResponseCallback`),
        // więc drugi wyłączyłby po cichu całą mapę.
        /** @var array<int, string> $contractMessageByStatus status HTTP => `message` z kontraktu */
        $contractMessageByStatus = [
            400 => 'Niepoprawny adres URL.',
            401 => 'Wymagane zalogowanie.',
            403 => 'Brak dostępu do zasobu.',
            404 => 'Nie znaleziono zasobu.',
            405 => 'Metoda niedozwolona dla tego zasobu.',
            413 => 'Przesłane dane są za duże.',
            500 => 'Wewnętrzny błąd serwera.',
            503 => 'Usługa chwilowo niedostępna.',
        ];

        $exceptions->respond(function (Response $response, Throwable $e, Request $request) use ($rendersJson, $contractMessageByStatus): Response {
            $status = $response->getStatusCode();

            if (! isset($contractMessageByStatus[$status])
                || $e instanceof HttpResponseException
                || ! $response instanceof JsonResponse
                || ! $rendersJson($request)
                || ($status === 500 && config('app.debug'))) {
                return $response;
            }

            if (config('app.debug')) {
                Log::debug("{$status}: ".$e->getMessage(), ['path' => $request->path()]);
            }

            return $response->setData(['message' => $contractMessageByStatus[$status]]);
        });
    })->create();
