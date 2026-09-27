<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Czy odpowiedź dla tego żądania ma być JSON-em. Backend oddaje wyłącznie JSON
 * (patrz `AGENTS.md`), ale `expectsJson()` samo nie wystarcza: klient bez
 * nagłówka `Accept` też ma dostać kształt z kontraktu, nie stronę błędu.
 *
 * Prefiks sprawdzany na surowej ścieżce, a nie przez `$request->is('api/*')`:
 * `is()` dopasowuje wzorzec do ścieżki zdekodowanej, regexem z flagą `u`,
 * więc na niepoprawnym UTF-8 (`/api/v1/%C0`, czyli 400) nie dopasowuje niczego
 * i klient bez `Accept` dostawał stronę HTML.
 */
$rendersJson = fn (Request $request): bool => str_starts_with($request->path(), 'api/') || $request->expectsJson();

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

        // Kontrakt ma na 404 jedno zdanie (`components/responses/NotFound`),
        // a framework ma na tę odpowiedź trzy różne teksty — spod routera,
        // spod wyszukania modelu i pusty string spod gołego `abort(404)` —
        // wszystkie po angielsku i wszystkie widoczne dla klienta także
        // produkcyjnie. Jedno przesłonięcie zamyka komplet, bo
        // `Handler::prepareException()` opakowuje `ModelNotFoundException`
        // w ten sam `NotFoundHttpException` co router.
        //
        // Konsekwencja przyjęta świadomie: własny tekst z `abort(404, '...')`
        // zostanie tu skasowany — 404 mówi w tym API jednym zdaniem, bo tak
        // stanowi kontrakt.
        //
        // `Log::debug` jest **jedynym** śladem po oryginalnym komunikacie.
        // Wbrew intuicji nie ma go w `laravel.log`: `HttpException`
        // i `ModelNotFoundException` siedzą w `Handler::$internalDontReport`,
        // więc żadna 404 nie jest raportowana — ani przed tą zmianą, ani po
        // niej. Bez tej linii literówka w URL-u przestaje być widoczna
        // gdziekolwiek.
        //
        // Pełne uzasadnienie i pomiary:
        // docs/research/komunikaty-bledow-frameworka-a-kontrakt.md §4.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($rendersJson): ?JsonResponse {
            if (! $rendersJson($request)) {
                return null;
            }

            if (config('app.debug')) {
                Log::debug('404: '.$e->getMessage(), ['path' => $request->path()]);
            }

            return response()->json(['message' => 'Nie znaleziono zasobu.'], 404);
        });

        // 401 z tego samego powodu co 404: kontrakt ma na niego jedno polskie
        // zdanie (`Unauthenticated`), a framework wpisuje `Unauthenticated.`
        // jako napis stały, z pominięciem translatora — `lang/pl` go nie ruszy.
        // Przesłonięcie niczego nie ukrywa: `Handler::unauthenticated()`
        // i tak oddawał sam komunikat, bez `exception` i `trace`, także przy
        // `APP_DEBUG` (docs/research/komunikaty-bledow-frameworka-a-kontrakt.md §6).
        $exceptions->render(function (AuthenticationException $e, Request $request) use ($rendersJson): ?JsonResponse {
            if (! $rendersJson($request)) {
                return null;
            }

            return response()->json(['message' => 'Wymagane zalogowanie.'], 401);
        });

        // Pozostałe kody z jednym zdaniem w kontrakcie: 403 (`Forbidden`) i te,
        // które oddaje warstwa frameworka na dowolnym żądaniu (#76). Framework
        // ma na nie napisy stałe po angielsku, spoza translatora.
        //
        // `respond()`, a nie `render()`, bo działa na gotowej odpowiedzi według
        // jej statusu. `render()` dla 500 musiałby łapać `Throwable`, a przez
        // niego przechodzą jeszcze nieprzerobione `ValidationException`
        // i `AuthenticationException` (`Handler::render()` zamienia je
        // w odpowiedzi dopiero po callbackach) — każdy trzeba by wykluczać
        // ręcznie. Tu 422 i 401 mają swój status, więc omijają mapę same.
        // Po drodze zostają nagłówki: `Allow` przy 405, `Retry-After` przy 503.
        //
        // 403 z mapy obejmuje i odmowę policy, i goły `abort(403)` — to dwa
        // różne wyjątki (`AccessDeniedHttpException` i zwykły
        // `HttpException(403)`), ale ten sam status. 500 obejmuje zarówno
        // wyjątek spoza `HttpException`, jak i `abort(500)`.
        //
        // Ta sama konsekwencja co przy 404: własny tekst z `abort(403, '...')`,
        // `Response::deny('...')` czy `abort(500, '...')` zostanie tu
        // skasowany. Raportowanie się nie zmienia — `respond()` dotyka tylko
        // odpowiedzi, wyjątek trafia do logu jak dotąd.
        //
        // Przy `APP_DEBUG` 500 zostaje nietknięte, z `exception` i `trace`:
        // to narzędzie deweloperskie, a jedyną treścią niesioną przez te
        // pozostałe kody i tak był napis stały.
        //
        // 429 celowo brak: limitera nie ma, więc kontrakt o nim milczy.
        // Dochodzi tutaj razem z pierwszym `throttle` (framework: `Too Many
        // Attempts.`). Teksty muszą być równe przykładom z
        // `components/responses` — pilnuje tego `ErrorResponsesTest`.
        $messages = [
            400 => 'Niepoprawny adres URL.',          // BadRequest
            403 => 'Brak dostępu do zasobu.',         // Forbidden
            405 => 'Metoda niedozwolona dla tego zasobu.', // MethodNotAllowed
            413 => 'Przesłane dane są za duże.',      // PayloadTooLarge
            500 => 'Wewnętrzny błąd serwera.',        // ServerError
            503 => 'Usługa chwilowo niedostępna.',    // ServiceUnavailable
        ];

        $exceptions->respond(function (Response $response, Throwable $e, Request $request) use ($rendersJson, $messages): Response {
            $status = $response->getStatusCode();

            if (! isset($messages[$status])
                || ! $response instanceof JsonResponse
                || ! $rendersJson($request)
                || ($status === 500 && config('app.debug'))) {
                return $response;
            }

            return $response->setData(['message' => $messages[$status]]);
        });
    })->create();
