<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Czy odpowiedź dla tego żądania ma być JSON-em. Backend oddaje wyłącznie JSON
 * (patrz `AGENTS.md`), ale `expectsJson()` samo nie wystarcza: klient bez
 * nagłówka `Accept` też ma dostać kształt z kontraktu, nie stronę błędu.
 */
$rendersJson = fn (Request $request): bool => $request->is('api/*') || $request->expectsJson();

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
        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($rendersJson) {
            if (! $rendersJson($request)) {
                return null;
            }

            if (config('app.debug')) {
                Log::debug('404: '.$e->getMessage(), ['path' => $request->path()]);
            }

            return response()->json(['message' => 'Nie znaleziono zasobu.'], 404);
        });
    })->create();
