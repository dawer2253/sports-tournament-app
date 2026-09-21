<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
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

        // Kontrakt ma na 404 jedno zdanie (`components/responses/NotFound`,
        // użyte 22 razy), a framework ma na tę odpowiedź trzy różne teksty:
        // „The route ... could not be found." spod routera, „No query results
        // for model [App\Models\Tournament] 7" spod wyszukania modelu i pusty
        // string spod gołego `abort(404)`. Wszystkie po angielsku, żaden nie
        // idzie przez `lang/pl`, a `convertExceptionToArray()` przepuszcza
        // komunikat każdego wyjątku HTTP także produkcyjnie — czyli nazwa klasy
        // Eloquenta trafiłaby na ekran odwiedzającego stronę publiczną.
        //
        // Tutaj, odwrotnie niż w #53, to backend dogania przykład: rzeczywistość
        // jest gorsza od kontraktu, a nie lepsza. Jedno przesłonięcie zamyka
        // wszystkie warianty, bo `Handler::prepareException()` opakowuje
        // `ModelNotFoundException` w ten sam `NotFoundHttpException` co router.
        //
        // Cena: w dev znika „The route ... could not be found.", czytelne przy
        // literówce w URL-u. Świadomie, bo inaczej kontrakt byłby prawdziwy
        // tylko produkcyjnie, a testy asertowałyby co innego niż dostaje klient.
        // Oryginalny wyjątek zostaje w `storage/logs/laravel.log`.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($rendersJson) {
            if (! $rendersJson($request)) {
                return null;
            }

            return response()->json(['message' => 'Nie znaleziono zasobu.'], 404);
        });
    })->create();
