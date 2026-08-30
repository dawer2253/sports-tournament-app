# Sanctum, Spectator i prefiks `/api/v1`

Badanie na potrzeby ticketu
[#6 „S0: Sanctum (Bearer) + prefiks /api/v1 + Spectator w Pest"](https://github.com/dawer2253/sports-tournament-app/issues/6).
Dotyczy dwóch rzeczy naraz: sposobu, w jaki testy Pest mają dowodzić zgodności
backendu z [`packages/api-contract/openapi.yaml`](../../packages/api-contract/openapi.yaml)
(kontrakt ma `servers[].url` z prefiksem `/api/v1`, a klucze w `paths:` są bez
prefiksu, np. `/login`, `/me`, `/tournaments`), oraz zakresu tego, co realnie
załatwia `php artisan install:api` w środowisku opisanym w
[`docs/BACKEND.md`](../BACKEND.md). Data: 31 sierpnia 2026. Źródła: wyłącznie kod
źródłowy pakietów, ich README i konfiguracja oraz dokumentacja Laravela, bez
blogów i tutoriali.

## 1. Streszczenie

**Spectator nie czyta `servers[].url`.** Słowo `servers` nie występuje nigdzie w
katalogu `src/` pakietu. Dopasowanie idzie wyłącznie po kluczach z `paths:`,
porównywanych z URI trasy Laravela. Wobec tego `$this->postJson('/api/v1/login')`
przy specu z kluczem `/login` **nie przejdzie** `assertValidRequest()`: middleware
rzuci `InvalidPathException` z komunikatem `Path [POST /api/v1/login] not found in spec.`,
a ten sam wyjątek zostanie zapisany również jako błąd walidacji odpowiedzi, więc
`assertValidResponse()` też padnie. **Rozwiązanie jest wbudowane i nie wymaga
ruszania kontraktu:** klucz konfiguracyjny `spectator.path_prefix` (albo
`Spectator::withPathPrefix('api/v1')`), który Spectator dokleja do każdej ścieżki
ze speca przed porównaniem. Kompatybilność jest w porządku: aktualne wydanie
v3.0.4 wymaga PHP `^8.3` i `laravel/framework: >=12.0`, a jego macierz CI jawnie
testuje Laravel `13.*` na PHP 8.3, 8.4 i 8.5. Szukanie alternatyw dla Spectatora
nie jest potrzebne.

**`php artisan install:api` sam instaluje Sanctuma.** Komenda woła
`composer require laravel/sanctum:^4.0`, publikuje migrację i konfigurację
pakietu, kopiuje `routes/api.php` ze stuba, odkomentowuje wpis `api:` w
`bootstrap/app.php` i pyta, czy odpalić migracje. Osobne `composer require
laravel/sanctum` jest zbędne. Po komendzie w czystym trybie tokenowym zostaje do
zrobienia **jedna rzecz**: dodanie traitu `Laravel\Sanctum\HasApiTokens` do modelu
`User` (komenda sama o tym przypomina w output). `config/auth.php` nie wymaga
zmian, bo guard `sanctum` jest wstrzykiwany w runtime przez
`SanctumServiceProvider::register()`. `EnsureFrontendRequestsAreStateful` i
`$middleware->statefulApi()` dotyczą wyłącznie trybu SPA na cookies i w trybie
Bearer nie są potrzebne. Dokumentacja Sanctuma dla 13.x nie różni się w tym
miejscu od 12.x ani 11.x.

## 2. Spectator: jak dopasowuje ścieżkę

Badana wersja: tag `v3.0.4` z 24 sierpnia 2026, identyczny z gałęzią `master`
(porównanie `v3.0.4...master` przez API GitHuba zwraca `status: identical`,
`ahead_by: 0`). Cytaty pochodzą z
[hotmeteor/spectator](https://github.com/hotmeteor/spectator).

### 2.1. Algorytm dopasowania

Całość siedzi w [`src/Middleware.php`](https://github.com/hotmeteor/spectator/blob/master/src/Middleware.php),
metoda `Middleware::pathItem()`, wołana z `Middleware::handle()`.

Kolejność kroków:

1. `handle()` wychodzi natychmiast, jeżeli nie ustawiono speca (`Spectator::using()`),
   czyli middleware jest bierny w zwykłych testach funkcjonalnych.
2. `pathItem()` bierze **URI trasy Laravela**, nie URL żądania:
   `$requestPath = Str::start($route->uri(), '/')`. Dla trasy zarejestrowanej pod
   `Route::prefix('api/v1')` daje to `/api/v1/login`, razem z prefiksem i z
   placeholderami parametrów w postaci `{tournament}`.
3. Dla każdego klucza `$path` z `$openapi->paths` liczy
   `$resolvedPath = $this->resolvePath($path)`. To jest jedyne miejsce, w którym
   wchodzi prefiks:

   ```php
   protected function resolvePath(string $path): string
   {
       $separator = '/';

       $parts = array_filter(array_map(function ($part) use ($separator) {
           return trim($part, $separator);
       }, [$this->spectator->getPathPrefix(), $path]));

       return $separator.implode($separator, $parts);
   }
   ```

   Czyli prefiks jest **doklejany do ścieżki ze speca**, a nie obcinany z żądania
   (README pakietu opisuje to jako „strips it before matching", ale kod robi
   operację odwrotną, o identycznym skutku). `trim($part, '/')` zdejmuje ukośniki
   z obu stron, więc wartość prefiksu może być zapisana jako `v1`, `/v1`, `v1/`
   albo `/api/v2/` i wynik jest ten sam.
4. Pierwsze kryterium to **porównanie napisów**: `if ($resolvedPath === $requestPath)`.
   Trafienie ustawia `$pathMatches = true`, a jeżeli metoda HTTP występuje w
   `$pathItem->getOperations()`, metoda zwraca `[$resolvedPath, $pathItem]` i
   kończy pracę.
5. Drugie kryterium to **dopasowanie po wzorcach**, dla przypadków, w których
   nazwa parametru w specu różni się od nazwy parametru w trasie. Spectator
   kompiluje trasę do wyrażenia Symfony (`$route->toSymfonyRoute()->compile()->getRegex()`,
   z tymczasowo wyzerowanym `$route->wheres`) i sprawdza
   `Str::match($pathMatchRegex, $resolvedPath)`. Dodatkowo zamienia w ścieżce ze
   speca każde `{...}` na `.+` i konfrontuje to z faktycznym URL-em żądania
   (`$request->path()`). Trafienie zapisuje jako `$partialMatch` i zwraca dopiero
   po przejściu całej pętli.
6. Brak trafienia kończy się wyjątkiem:

   ```php
   throw $pathMatches
       ? throw new InvalidPathException("[{$requestMethod}] not a valid method for [{$requestPath}].", 405)
       : new InvalidPathException("Path [{$requestMethod} {$requestPath}] not found in spec.", 404);
   ```

   Czyli 405, gdy ścieżka pasuje, ale metoda nie, i 404, gdy nie pasuje nic.

`handle()` łapie `InvalidPathException` i wpisuje ten sam obiekt w **oba** sloty:
`captureRequestValidation($exception)` oraz `captureResponseValidation($exception)`,
po czym przepuszcza żądanie dalej. Dopiero potem
[`src/Assertions.php`](https://github.com/hotmeteor/spectator/blob/master/src/Assertions.php)
w `assertValidRequest()` i `assertValidResponse()` sprawdza, czy odpowiedni slot
jest pusty, i `InvalidPathException` jest na liście typów, które wywalają obie te
asercje.

Uwaga poboczna: walidacja odpowiedzi w `Middleware::validate()` jest wołana z
`$pathItem->{strtolower($request->method())}`, więc bez znalezionego `PathItem`
nie ma czego walidować. Nie da się mieć „ścieżki nie znaleziono, ale odpowiedź
poprawna".

### 2.2. `servers[].url` nie jest brane pod uwagę

`grep -rn "servers" src/` w katalogu źródeł pakietu nie zwraca **żadnego**
trafienia. Nie ma też wzmianki o `servers` w README. Ani `Middleware`, ani
`RequestFactory`, ani walidatory nie zaglądają do tej sekcji speca. Wniosek:
`servers[].url` w naszym kontrakcie jest z punktu widzenia Spectatora martwy i
zmiana tej wartości nie wpłynie na dopasowanie ścieżek w żadną stronę.

### 2.3. Konfiguracja pakietu, komplet kluczy

Publikowany
[`config/spectator.php`](https://github.com/hotmeteor/spectator/blob/master/config/spectator.php)
ma dokładnie te klucze:

| Klucz | Domyślna wartość | Znaczenie |
|---|---|---|
| `default` | `env('SPEC_SOURCE', 'local')` | które źródło z `sources` jest aktywne |
| `sources.local.source` | `'local'` | sterownik |
| `sources.local.base_path` | `env('SPEC_PATH')` | katalog ze specami na dysku |
| `sources.remote.source` | `'remote'` | sterownik |
| `sources.remote.base_path` | `env('SPEC_PATH')` | bazowy URL |
| `sources.remote.params` | `env('SPEC_URL_PARAMS', '')` | doklejane parametry zapytania |
| `sources.github.source` | `'github'` | sterownik |
| `sources.github.base_path` | `env('SPEC_GITHUB_PATH')` | gałąź plus katalog |
| `sources.github.repo` | `env('SPEC_GITHUB_REPO')` | `org/repo` |
| `sources.github.token` | `env('SPEC_GITHUB_TOKEN')` | PAT |
| `path_prefix` | `''` | prefiks doklejany do ścieżek ze speca |
| `error_format` | `env('SPECTATOR_ERROR_FORMAT', 'text')` | `text` albo `json` |
| `middleware_groups` | `['api']` | grupy, do których dopinany jest middleware |

Dwie rzeczy warte odnotowania, bo mogą zaskoczyć:

- **`path_prefix` nie jest sterowane zmienną środowiskową.** README pakietu
  dokumentuje `SPECTATOR_PATH_PREFIX=v1`, ale w publikowanym pliku konfiguracyjnym
  stoi twarde `'path_prefix' => '',` bez wywołania `env()`. Sprawdzone również w
  wersji z tagu v3.0.4, tam jest tak samo. Ustawienie samej zmiennej `SPECTATOR_PATH_PREFIX`
  w `.env` nie zadziała, trzeba wpisać wartość do configu albo wołać
  `Spectator::withPathPrefix()`.
- **Middleware jest rejestrowany tylko w trybie konsolowym.**
  `SpectatorServiceProvider::boot()` opakowuje `registerMiddleware()` warunkiem
  `if (App::runningInConsole())`, a sama rejestracja to
  `prependMiddlewareToGroup($group, Middleware::class)` dla każdej grupy z
  `middleware_groups`. Trasy muszą więc siedzieć w grupie `api` (albo lista musi
  zostać rozszerzona), inaczej walidacja nigdy się nie odpali, a asercje przejdą
  na zielono, bo żaden wyjątek nie zostanie zarejestrowany.

Odczyt prefiksu robi
[`src/RequestFactory.php`](https://github.com/hotmeteor/spectator/blob/master/src/RequestFactory.php):

```php
public function getPathPrefix(): string
{
    return $this->pathPrefix ?? config('spectator.path_prefix') ?? '';
}
```

czyli ustawienie w teście (`setPathPrefix()` / `withPathPrefix()`, ta druga to
alias) ma pierwszeństwo nad configiem. `RequestFactory::reset()` zeruje
`pathPrefix` do `null`, więc po resecie znów obowiązuje wartość z configu.

### 2.4. Werdykt

`$this->postJson('/api/v1/login')` przeciwko naszemu kontraktowi **bez ustawionego
`path_prefix` nie przejdzie**. `assertValidRequest()` i `assertValidResponse()`
zgłoszą `InvalidPathException` z komunikatem
`Path [POST /api/v1/login] not found in spec.` (kod 404).

Dokładnie ten scenariusz jest zapisany jako test regresyjny w samym pakiecie,
`tests/ResponseValidatorTest.php`, metoda `cannot_locate_path_without_path_prefix()`:
trasa `/api/v2/users` przeciw specowi bez prefiksu daje
`assertInvalidRequest()` z komunikatem `Path [GET /api/v2/users] not found in spec.`,
a po `Config::set('spectator.path_prefix', '/api/v2/')` to samo żądanie zwraca
`assertValidRequest()->assertValidResponse()`. Analogiczny test na poziomie
middleware to `tests/MiddlewareTest.php`, metoda `path_prefix_is_stripped_for_matching()`,
z `app('spectator')->setPathPrefix('v1')`.

### 2.5. Opcje obsługi prefiksu

Trzy możliwe podejścia, uszeregowane od najtańszego.

**A. `spectator.path_prefix = 'api/v1'` albo `Spectator::withPathPrefix('api/v1')`.**
Udokumentowane w README (sekcja „Path Prefix") i pokryte testami pakietu.
Kontrakt zostaje nietknięty, wygenerowany klient TS i mock Prism też. Wymaga:
trasy faktycznie zamontowane pod `api/v1` (patrz sekcja 3.4), oraz wpisania
wartości do `config/spectator.php` lub wołania fasady w `Pest.php` czy w
`beforeEach`, bo klucz nie czyta `env()`. Nic nie psuje.

**B. Wpisanie prefiksu do kluczy w `paths:`**, czyli `/api/v1/login` zamiast
`/login`. Zadziała bez konfiguracji Spectatora, ale psuje trzy rzeczy naraz:
duplikuje prefiks (raz w `servers[].url`, raz w kluczu), przez co realny URL staje
się `/api/v1/api/v1/login` dla każdego klienta respektującego `servers`; zmienia
kształt wygenerowanego klienta TS w `packages/api-client` (klucze ścieżek są
częścią wygenerowanych typów), więc wymusza przejście całej ścieżki z
[`AGENTS.md`](../../AGENTS.md) „kontrakt, generacja, kod"; przesuwa też ścieżki w
mocku Prism. To jest cofnięcie się z poprawnego użycia `servers` do konwencji,
której OpenAPI nie potrzebuje.

**C. Zmiana `servers[].url` na `http://localhost:8000`.** Na Spectatora **nie
wpływa w ogóle** (sekcja 2.2), więc jako rozwiązanie problemu prefiksu jest
pozorne: żeby cokolwiek dało, i tak trzeba dołożyć wariant B. Za to psuje mocka i
domyślny `baseURL` klienta, które z `servers` korzystają. Odrzucone.

Czwartej opcji nie ma. W kodzie pakietu nie istnieje żaden inny punkt wejścia
zmieniający dopasowanie ścieżki: `Middleware::pathItem()` czyta prefiks wyłącznie
przez `resolvePath()`, a `resolvePath()` wyłącznie przez `RequestFactory::getPathPrefix()`.

### 2.6. Zgodność z Laravelem 13, PHP 8.3 i Pest 4

Ryzyka nie ma. Z `composer.json` tagu v3.0.4 (identycznego z `master`):

```json
"require": {
    "php": "^8.3",
    "ext-json": "*",
    "cebe/php-openapi": "^1.7",
    "laravel/framework": ">=12.0",
    "opis/json-schema": "^2.3"
}
```

README pakietu w sekcji „What's New in v3" podaje wymagania jako „PHP 8.3+ i
Laravel 12+". Ograniczenie `>=12.0` obejmuje `laravel/framework:^13.17` z
[`backend/composer.json`](../../backend/composer.json), a `^8.3` obejmuje nasze
`php: ^8.3`. Deklaracja nie jest gołosłowna: `.github/workflows/tests.yml` w tagu
v3.0.4 ma macierz `laravel: ['12.*', '13.*']` razy `php: [8.3, 8.4, 8.5]`, przy
czym dla `13.*` używa `orchestra/testbench: 11.*`.

`phpunit/phpunit: ^11.0` siedzi w `require-dev` pakietu, więc nie ogranicza naszej
aplikacji (`phpunit/phpunit: ^12.5.12` plus `pestphp/pest: ^4.7`). Asercje są
dostarczane przez `TestResponse::mixin(new Assertions)` w
`SpectatorServiceProvider::decorateTestResponse()`, czyli mechanizmem Laravela, nie
PHPUnita, i działają w Peście tak samo jak w PHPUnicie. Jedyny element związany z
konkretną wersją PHPUnita to opcjonalne rozszerzenie pokrycia
`Spectator\Coverage\SpectatorExtension`, opisane w docblocku jako „PHPUnit 11
extension" i implementujące `PHPUnit\Runner\Extension\Extension`. Czy ten interfejs
działa bez zmian na PHPUnicie 12: **nie ustalono**, zabrakło sprawdzenia sygnatur
interfejsów PHPUnita 12 w źródle. To rozszerzenie jest opcjonalne (rejestruje się
je ręcznie w `phpunit.xml`) i nie jest potrzebne do samych asercji.

Alternatywy (`league/openapi-psr7-validator`, `osteel/openapi-httpfoundation-testing`)
nie były badane, bo przesłanka ich szukania, czyli niezgodność Spectatora z
Laravelem 13, jest fałszywa.

## 3. `php artisan install:api` w Laravelu 13

Źródło: kod zainstalowanej u nas wersji frameworka, `laravel/framework` 13.29.0
(stała `Illuminate\Foundation\Application::VERSION`), plik
`backend/vendor/laravel/framework/src/Illuminate/Foundation/Console/ApiInstallCommand.php`,
klasa `Illuminate\Foundation\Console\ApiInstallCommand`.

### 3.1. Sygnatura i flagi

```
install:api
    {--composer=global : Absolute path to the Composer binary which should be used to install packages}
    {--force : Overwrite any existing API routes file}
    {--passport : Install Laravel Passport instead of Laravel Sanctum}
    {--without-migration-prompt : Do not prompt to run pending migrations}
```

Opis komendy: „Create an API routes file and install Laravel Sanctum or Laravel Passport".

### 3.2. Co robi krok po kroku (ścieżka domyślna, Sanctum)

1. `installSanctum()` woła `requireComposerPackages($this->option('composer'), ['laravel/sanctum:^4.0'])`.
   Trait `InteractsWithComposerPackages` uruchamia proces `composer require laravel/sanctum:^4.0`
   w `basePath()` aplikacji, z `COMPOSER_MEMORY_LIMIT=-1` i bez limitu czasu.
   Odpowiedź na pytanie z ticketu: **tak, komenda sama ciągnie pakiet**, osobne
   `composer require laravel/sanctum` jest zbędne.
2. Dalej `installSanctum()` skanuje `database/migrations` szukając pliku pasującego
   do `/\d{4}_\d{2}_\d{2}_\d{6}_create_personal_access_tokens_table.php/`. Jeżeli
   go nie ma, uruchamia `php artisan vendor:publish --provider Laravel\Sanctum\SanctumServiceProvider`.
   To publikuje jednocześnie migrację i konfigurację, bo `SanctumServiceProvider::boot()`
   rejestruje dwa zestawy: `publishesMigrations([... => database_path('migrations')], 'sanctum-migrations')`
   oraz `publishes([... => config_path('sanctum.php')], 'sanctum-config')`. Migracja
   w pakiecie to jeden plik: `2019_12_14_000001_create_personal_access_tokens_table.php`.
3. Sprawdza `routes/api.php`. Jeżeli plik istnieje i nie podano `--force`, wypisuje
   błąd „API routes file already exists." i **nie nadpisuje**. W przeciwnym razie
   kopiuje `stubs/api-routes.stub`, czyli:

   ```php
   Route::get('/user', function (Request $request) {
       return $request->user();
   })->middleware('auth:sanctum');
   ```

   Przy `--passport` dodatkowo podmienia w tym pliku `auth:sanctum` na `auth:api`.
4. `uncommentApiRoutesFile()` edytuje `bootstrap/app.php`: zamienia `// api: ` na
   `api: `, a gdy takiego komentarza nie ma, dopisuje linię
   `api: __DIR__.'/../routes/api.php',` zaraz po linii z `web:`. Jeżeli nie znajdzie
   ani jednego, ani drugiego, wypisuje ostrzeżenie i każe zarejestrować plik tras
   ręcznie. **Uwaga dla nas:** nasze `backend/bootstrap/app.php` nie zawiera ani
   `// api: `, ani wpisu `web: __DIR__.'/../routes/web.php',` (wywołanie `withRouting`
   ma tylko `web:`, `commands:` i `health:`, przy czym linia `web:` występuje w formie
   `web: __DIR__.'/../routes/web.php',` z wcięciem). Dopasowanie jest po dokładnym
   napisie `web: __DIR__.'/../routes/web.php',`, więc ten wariant zadziała, ale
   dopisze `api:` bez prefiksu wersji, patrz 3.4.
5. Bez `--without-migration-prompt` pyta interaktywnie: „One new database migration
   has been published. Would you like to run all pending database migrations?" z
   domyślną odpowiedzią `true`. Na „tak" woła `migrate`.
6. Na koniec wypisuje: „API scaffolding installed. Please add the
   [Laravel\Sanctum\HasApiTokens] trait to your User model."

Ścieżka `--passport` różni się tym, że instaluje `laravel/passport:^13.0`, po
skopiowaniu tras uruchamia `php artisan passport:install` i nie pyta o migracje.

### 3.3. Czego komenda nie robi, a czego potrzebuje tryb tokenowy

- **`HasApiTokens` na modelu `User`: trzeba dodać ręcznie.** Komenda o tym tylko
  informuje. Nasze `backend/app/Models/User.php` ma dziś `use HasFactory, Notifiable;`.
  Dokumentacja 13.x, sekcja „Issuing API Tokens": „To begin issuing tokens for
  users, your User model should use the `Laravel\Sanctum\HasApiTokens` trait".
  Trait daje relację `tokens()`, `createToken()` i `tokenCan()`.
- **Migracja `personal_access_tokens`: załatwiona.** Publikuje ją krok 2, a krok 5
  proponuje jej uruchomienie.
- **`config/auth.php`: bez zmian.** Guard `sanctum` nie musi być w pliku, bo
  `SanctumServiceProvider::register()` wstrzykuje go w runtime:

  ```php
  config([
      'auth.guards.sanctum' => array_merge([
          'driver' => 'sanctum',
          'provider' => null,
      ], config('auth.guards.sanctum', [])),
  ]);
  ```

  `array_merge` w tej kolejności oznacza, że jawny wpis w `config/auth.php` ma
  pierwszeństwo, więc dopisanie guarda jest dozwolone, ale niekonieczne.
  `'provider' => null` znaczy „użyj domyślnego dostawcy", czyli naszego `users`.
- **`EnsureFrontendRequestsAreStateful`: niepotrzebne.** Dokumentacja 13.x wprowadza
  je dopiero w sekcji „SPA Authentication / Sanctum Middleware", jako
  `$middleware->statefulApi()` w `bootstrap/app.php`, i opisuje jako sposób na to,
  by żądania z własnego SPA uwierzytelniały się ciasteczkami sesji. Sekcja
  „Installation" mówi wprost: „Next, if you plan to utilize Sanctum to authenticate
  an SPA, please refer to the SPA Authentication section", czyli tryb tokenowy nie
  ma tam nic do zrobienia. Sekcja „How it Works" dodaje: „It is perfectly fine to
  use Sanctum only for API token authentication or only for SPA authentication."
- **Ochrona tras:** `->middleware('auth:sanctum')`, tak jak w skopiowanym stubie.
  Token idzie w nagłówku `Authorization` jako `Bearer`.
- **`config/sanctum.php`:** publikowany razem z migracją. W trybie czysto tokenowym
  istotne są w nim głównie `expiration` i `prefix`. Sam provider i tak dołoży
  domyślne wartości przez `mergeConfigFrom`, gdy config nie jest scachowany.

### 3.4. Prefiks `/api/v1` po stronie Laravela

`install:api` montuje `routes/api.php` z domyślnym prefiksem `api`, bo
`Illuminate\Foundation\Configuration\ApplicationBuilder::withRouting()` ma parametr
`string $apiPrefix = 'api'`, a `buildRoutingCallback()` robi z niego
`Route::middleware('api')->prefix($apiPrefix)->group($api)`. Żeby dostać `/api/v1`,
wystarczy w `bootstrap/app.php` przekazać `apiPrefix: 'api/v1'`. Grupa middleware
zostaje `api`, co jest zgodne z domyślnym `spectator.middleware_groups`.

### 3.5. Różnice dokumentacji 13.x wobec 12.x i 11.x

Porównanie plików `sanctum.md` z gałęzi `11.x`, `12.x` i `13.x` repozytorium
[laravel/docs](https://github.com/laravel/docs):

- **12.x wobec 13.x:** dwie zmiany, obie w sekcji SPA. Ścieżka pliku dla globalnej
  konfiguracji axiosa: `resources/js/bootstrap.js` w 12.x, `resources/js/app.js` w
  13.x. Oraz dopisane w 13.x zdanie o tym, że skoro uwierzytelnianie SPA jest
  oparte na sesji, można korzystać ze standardowych mechanizmów Laravela, w tym
  „remember me". Sekcje „Installation" oraz „API Token Authentication" są
  identyczne.
- **11.x wobec 12.x:** wyłącznie różnice formatowania (bloki ```php wokół przykładów
  w sekcji „Overriding Default Models", drobiazg w składni bloku `[!NOTE]`). Treści
  merytorycznej to nie zmienia.

Wniosek: w części tokenowej dokumentacja Sanctuma się nie zmieniła. Instrukcja dla
11.x, 12.x i 13.x jest ta sama: `php artisan install:api`, potem `HasApiTokens` na
modelu `User`, potem `auth:sanctum` na trasach.

## 4. Wnioski dla naszego repo

- **Kontrakt zostaje bez zmian.** `servers[].url` z `/api/v1` i klucze `paths:` bez
  prefiksu to układ poprawny wobec OpenAPI 3.1 i wystarczający dla Spectatora, pod
  warunkiem ustawienia `path_prefix`. Wariant B z sekcji 2.5 (prefiks w kluczach)
  wymusiłby regenerację `packages/api-client` i przesunął ścieżki w mocku, przy
  zerowym zysku.
- **`path_prefix` trzeba ustawić w configu, nie w `.env`.** Klucz w publikowanym
  pliku nie czyta `env()`, więc sama zmienna `SPECTATOR_PATH_PREFIX` nic nie da.
  Miejsca do wyboru: `config/spectator.php` po publikacji, albo
  `Spectator::withPathPrefix('api/v1')` w `tests/Pest.php`. Pierwsze jest trwalsze,
  drugie łatwiej przeoczyć przy nowym pliku testowym.

  Wdrożone zostało pierwsze, z dopisanym `env('SPECTATOR_PATH_PREFIX', 'api/v1')`,
  czyli w naszym repo zmienna środowiskowa **działa**, wbrew temu, co daje sam
  pakiet. Domyślna wartość musi zgadzać się z `apiPrefix` w `bootstrap/app.php`.
- **Wartość prefiksu musi się zgadzać z `apiPrefix` w `bootstrap/app.php`.** To są
  dwa niezależne miejsca opisujące ten sam fakt. Jeżeli kiedyś dojdzie `/api/v2`,
  rozjadą się po cichu: testy zaczną zgłaszać „Path not found in spec", a nie
  „prefiks się nie zgadza".
- **Trasy muszą siedzieć w grupie middleware `api`.** Domyślne `withRouting(api: ...)`
  to zapewnia. Gdyby jakiś endpoint trafił poza tę grupę, Spectator go nie sprawdzi,
  a asercje nie zapalą się na czerwono, bo brak wyjątku jest dla nich sukcesem. To
  jest cicha awaria i warto mieć na nią przynajmniej jeden test kontrolny, na
  przykład z `assertInvalidRequest()` na celowo niezgodnym żądaniu.
- **Nazwy parametrów ścieżki najlepiej trzymać identyczne po obu stronach.**
  Kontrakt ma `{tournament}`, `{team}`, `{player}`, `{venue}`, `{slug}`. Przy tych
  samych nazwach w trasach Laravela zadziała szybka ścieżka porównania napisów,
  bez wchodzenia w regexy z kroku 5 algorytmu, gdzie każdy parametr jest zamieniany
  na `.+` i dopasowanie robi się luźniejsze niż powinno.
- **`install:api` uruchamiamy w kontenerze.** Komenda odpala `composer` jako
  osobny proces w `basePath()` aplikacji, a na hoście nie ma PHP ani Composera
  (patrz [`backend/AGENTS.md`](../../backend/AGENTS.md)), więc idzie przez `make shell`.
  Komenda modyfikuje `bootstrap/app.php` i `routes/api.php` oraz dopisuje zależność
  do `backend/composer.json`, czyli trzeba jej wynik przejrzeć przed commitem, w
  szczególności czy `apiPrefix` został podniesiony do `api/v1` (komenda tego nie
  robi) i czy stub `Route::get('/user', ...)` nie zostaje w repo jako trasa spoza
  kontraktu.
- **Po instalacji dopisujemy `HasApiTokens` do `App\Models\User`.** To jedyny krok,
  którego komenda nie wykonuje w trybie tokenowym.

## 5. Nieustalone

- Czy `Spectator\Coverage\SpectatorExtension` (opcjonalne rozszerzenie pokrycia
  speca) działa bez zmian na PHPUnicie 12, którego używa Pest 4. Docblock klasy
  mówi „PHPUnit 11 extension", a `require-dev` pakietu przypina `phpunit/phpunit: ^11.0`.
  Zabrakło sprawdzenia w źródle PHPUnita 12, czy interfejsy
  `PHPUnit\Runner\Extension\Extension` i `PHPUnit\Event\TestRunner\ExecutionFinishedSubscriber`
  mają niezmienione sygnatury. Nie dotyczy to samych asercji Spectatora, które nie
  przechodzą przez ten mechanizm.
- Czy wśród zgłoszeń w repozytorium Spectatora są dodatkowe, nieudokumentowane w
  README obejścia prefiksu wersji. Przeszukano kod, README i konfigurację pakietu,
  nie przeszukano historii issues.
