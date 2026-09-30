<?php

use App\Models\Player;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use App\Models\Venue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Bootstrap\BootProviders;
use Illuminate\Foundation\Bootstrap\LoadConfiguration;
use Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables;
use Illuminate\Foundation\Bootstrap\RegisterFacades;
use Illuminate\Foundation\Bootstrap\RegisterProviders;
use Illuminate\Routing\Route as RouteDefinition;
use Illuminate\Support\Facades\Route;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Autoryzacja poddrzewa turnieju, przekrojowo
|--------------------------------------------------------------------------
|
| Wzorzec, którego ten test pilnuje, opisuje „Autoryzacja poddrzewa turnieju"
| w `backend/AGENTS.md` (rozstrzygnięcie w #79). Test nie wymienia tras:
| bierze każdą trasę pod `auth:sanctum` z parametrem z poddrzewa prosto
| z routera, więc nowa trasa trafia tu sama, a pominięty `->can(...)` czerwieni
| ją bez dopisywania czegokolwiek.
|
| Testy per endpoint zostają na szczęśliwą ścieżkę i na izolację list.
|
| Stałe i funkcje niżej lądują w globalnej przestrzeni nazw, wspólnej dla
| całego przebiegu Pesta, stąd prefiks `subtree`/`SUBTREE_` w każdej nazwie.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** Parametry, których obecność czyni trasę częścią poddrzewa turnieju. */
const SUBTREE_PARAMETERS = ['tournament', 'team', 'player', 'venue'];

/**
 * Trasy pod `auth:sanctum` bez parametru z poddrzewa. Każda inna trasa pod
 * tokenem musi mieć taki parametr — inaczej strażnik kompletności czerwienieje,
 * bo trasa mogłaby oddawać dane poddrzewa bez sprawdzenia własności.
 */
const SUBTREE_EXCEPTIONS = [
    'POST /logout',
    'GET /me',
    'GET /sports',
    'GET /tournaments',
    'POST /tournaments',
];

/**
 * Parametr trasy → zasób należący do `$owner`. Parametr bez wpisu czerwieni
 * test zamiast go pomijać, więc nowy rodzaj parametru wymaga świadomego
 * dopisania fabryki. Wpis dla obiektu czeka na trasy CRUD — dzięki niemu
 * pierwsza z nich jest sprawdzana od razu, w całości.
 *
 * Trasa z dwoma parametrami dostaje zasoby zbudowane niezależnie od siebie.
 * Wystarcza, dopóki żadna trasa nie ma wiązań zawężonych (`scopeBindings`).
 *
 * @return array<string, Closure(User): Model>
 */
function subtreeFactories(): array
{
    return [
        'tournament' => fn (User $owner): Tournament => Tournament::factory()->for($owner)->create(),
        'team' => fn (User $owner): Team => Team::factory()
            ->for(Tournament::factory()->for($owner))
            ->create(),
        'player' => fn (User $owner): Player => Player::factory()
            ->for(Team::factory()->for(Tournament::factory()->for($owner)))
            ->create(),
        'venue' => fn (User $owner): Venue => Venue::factory()
            ->for(Tournament::factory()->for($owner))
            ->create(),
    ];
}

/**
 * Trasy pod tokenem jako „METODA /ścieżka" (bez prefiksu `api/v1`, jak klucze
 * w kontrakcie). Metoda po metodzie, bez `HEAD`, który router dokłada do
 * każdego `GET`.
 *
 * @param  iterable<RouteDefinition>  $routes
 * @return array<string, array{method: string, route: RouteDefinition}>
 */
function subtreeAuthenticatedRoutes(iterable $routes): array
{
    $found = [];

    foreach ($routes as $route) {
        if (! in_array('auth:sanctum', $route->gatherMiddleware(), true)) {
            continue;
        }

        foreach (array_diff($route->methods(), ['HEAD']) as $method) {
            $found[subtreeRouteLabel($method, $route->uri())] = compact('method', 'route');
        }
    }

    return $found;
}

function subtreeRouteLabel(string $method, string $uri): string
{
    return "{$method} /".preg_replace('#^api/v1/#', '', $uri);
}

function isSubtreeRoute(RouteDefinition $route): bool
{
    return array_intersect($route->parameterNames(), SUBTREE_PARAMETERS) !== [];
}

/**
 * Dataset rozwiązuje się przy zbieraniu testów, zanim `TestCase` postawi
 * aplikację, więc trasy czyta z osobnej instancji. Strażnik kompletności
 * niżej czyta już router aplikacji testowej.
 *
 * Instancja startuje bez `HandleExceptions`: jego handler błędów zostałby
 * zarejestrowany poza jakimkolwiek testem i PHPUnit oznaczyłby jako ryzykowny
 * każdy test w przebiegu, nie tylko te z tego pliku.
 */
dataset('trasy poddrzewa', function () {
    $app = require __DIR__.'/../../bootstrap/app.php';
    $app->bootstrapWith([
        LoadEnvironmentVariables::class,
        LoadConfiguration::class,
        RegisterFacades::class,
        RegisterProviders::class,
        BootProviders::class,
    ]);

    foreach (subtreeAuthenticatedRoutes($app['router']->getRoutes()) as $label => ['method' => $method, 'route' => $route]) {
        if (isSubtreeRoute($route)) {
            yield $label => [$method, $route->uri(), $route->parameterNames()];
        }
    }
});

/**
 * Buduje zasoby dla wszystkich parametrów trasy i podstawia je do ścieżki.
 *
 * @param  list<string>  $parameters
 * @return array{string, array<string, Model>}
 */
function subtreeRequest(string $uri, array $parameters, User $owner): array
{
    $factories = subtreeFactories();
    $models = [];

    foreach ($parameters as $parameter) {
        expect($factories)->toHaveKey(
            $parameter,
            message: "Parametr {{$parameter}} w trasie {$uri} nie ma fabryki w subtreeFactories()."
        );

        $models[$parameter] = $factories[$parameter]($owner);
    }

    $path = preg_replace_callback(
        '/\{(\w+)\??\}/',
        fn (array $match): string => (string) $models[$match[1]]->getRouteKey(),
        $uri,
    );

    return ['/'.$path, $models];
}

// Same odpowiedzi nie odróżnią `->can(...)` od `Gate::authorize` w ciele
// kontrolera: na `GET` i na trasie zapisu, której Form Request przepuszcza
// puste ciało (same pola `sometimes`), oba dają 403. Dlatego wzorzec sprawdza
// się też wprost na trasie. Wystarczy `can` na jednym parametrze z poddrzewa,
// bo zagnieżdżone listy i tworzenie autoryzuje rodzic.
it('autoryzuje middlewarem can na parametrze z poddrzewa, nie w kontrolerze', function (string $method, string $uri, array $parameters) {
    $label = subtreeRouteLabel($method, $uri);
    $route = subtreeAuthenticatedRoutes(Route::getRoutes())[$label]['route'];

    $expected = array_map(
        fn (string $parameter): string => "can:manage,{$parameter}",
        array_intersect($parameters, SUBTREE_PARAMETERS),
    );

    expect(array_intersect($route->gatherMiddleware(), $expected))->not->toBe(
        [],
        "Trasa {$label} nie ma ->can('manage', …) na żadnym parametrze z poddrzewa.",
    );
})->with('trasy poddrzewa');

// Puste ciało przypina kolejność „403 przed 422": trasa zapisu, która
// sprawdzałaby własność w kontrolerze, oddałaby tu błąd walidacji z Form
// Requesta. Dokładne ciało wyklucza wyciek danych zasobu obok komunikatu.
it('odmawia obcemu organizerowi z 403, zanim ruszy walidacja', function (string $method, string $uri, array $parameters) {
    [$path] = subtreeRequest($uri, $parameters, User::factory()->create());

    actingAsOrganizer()
        ->json($method, $path, [])
        ->assertValidResponse(403)
        ->assertExactJson(['message' => contractErrorMessage('Forbidden')]);
})->with('trasy poddrzewa');

it('odmawia bez tokenu z 401', function (string $method, string $uri, array $parameters) {
    [$path] = subtreeRequest($uri, $parameters, User::factory()->create());

    $this->json($method, $path, [])
        ->assertValidResponse(401)
        ->assertExactJson(['message' => contractErrorMessage('Unauthenticated')]);
})->with('trasy poddrzewa');

// Zasób jest cudzy, więc 404 zamiast 403 dowodzi, że wiązanie modelu odpala
// przed `can` i nie widzi usuniętych miękko — oba naraz. Turniej nie ma
// `SoftDeletes`, więc trasy z samym `{tournament}` są tu pomijane z nazwą
// powodu.
it('oddaje 404 dla zasobu usuniętego miękko, także cudzego', function (string $method, string $uri, array $parameters) {
    [, $models] = subtreeRequest($uri, $parameters, User::factory()->create());
    $softDeletable = array_keys(array_filter(
        $models,
        fn (Model $model): bool => in_array(SoftDeletes::class, class_uses_recursive($model), true),
    ));

    if ($softDeletable === []) {
        $this->markTestSkipped("Żaden parametr trasy {$uri} nie wskazuje modelu z SoftDeletes.");
    }

    foreach ($softDeletable as $parameter) {
        [$path, $models] = subtreeRequest($uri, $parameters, User::factory()->create());
        $models[$parameter]->delete();

        actingAsOrganizer()
            ->json($method, $path, [])
            ->assertValidResponse(404)
            ->assertExactJson(['message' => contractErrorMessage('NotFound')]);
    }
})->with('trasy poddrzewa');

it('nie zostawia pod tokenem trasy spoza poddrzewa i spoza listy wyjątków', function () {
    $routes = subtreeAuthenticatedRoutes(Route::getRoutes());

    $unguarded = array_keys(array_filter(
        $routes,
        fn (array $entry, string $label): bool => ! isSubtreeRoute($entry['route']) && ! in_array($label, SUBTREE_EXCEPTIONS, true),
        ARRAY_FILTER_USE_BOTH,
    ));

    expect($unguarded)->toBe([], 'Trasy pod auth:sanctum bez parametru z poddrzewa: dopisz parametr albo wyjątek w SUBTREE_EXCEPTIONS.');

    // Wyjątek po usuniętej trasie to martwy wpis, który po cichu przepuściłby
    // przyszłą trasę o tej samej ścieżce.
    expect(array_diff(SUBTREE_EXCEPTIONS, array_keys($routes)))->toBe([]);
});
