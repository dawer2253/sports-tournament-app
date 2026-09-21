# Komunikaty błędów frameworka a przykłady w kontrakcie

Badanie na potrzeby ticketu
[#53 „API: przykład ValidationError obiecuje komunikat, którego Laravel nie zwraca"](https://github.com/dawer2253/sports-tournament-app/issues/53).
Sam `ValidationError` jest już naprawiony na gałęzi `api/przyklad-bledu-walidacji`
(commit `e330a16`) i nie jest tu przedmiotem analizy — służy wyłącznie za wzorzec
klasy błędu. Pytanie brzmi: **gdzie jeszcze w
[`packages/api-contract/openapi.yaml`](../../packages/api-contract/openapi.yaml)
przykład obiecuje ciało odpowiedzi, którego ten backend nie zwróci.** Data:
21 września 2026.

Źródła: wyłącznie pierwotne — kod zainstalowanego frameworka
(`backend/vendor/laravel/framework`, wersja **13.29.0** z
`Illuminate\Foundation\Application::VERSION`), kod Sanctuma
(`laravel/sanctum` **v4.3.3**), kod repo, żywy backend na Sailu oraz
dokumentacja Laravela 13.x przez MCP `laravel-boost`. Bez blogów i tutoriali.

## 0. Co z tego weszło

Rekomendacje z tej notatki są **wdrożone w tej samej gałęzi**, więc sekcje niżej
czyta się jako uzasadnienie zmian, nie jako listę zadań:

- 404 — backend dogoni przykład (§4.4): przesłonięcie w `backend/bootstrap/app.php`
  plus dwa testy w `backend/tests/Feature/AuthTest.php` (brak trasy i brak modelu).
- 401 bez nagłówka `Accept` (§7.3): `redirectGuestsTo(null)` plus test, który
  omija `getJson()`.
- Token i `createdAt` (§7.2): przykłady doganiają rzeczywistość. Offsetów było
  41, nie trzy — przeliczone na UTC z zachowaniem chwili (`12:00+02:00` →
  `10:00+00:00`), a reguła trafiła do sekcji „Konwencje" kontraktu.

Niewdrożone zostaje to, co notatka opisuje jako otwarte: kody spoza kontraktu
(§8) i polskie 403 przy pierwszej policy (§5).

## 1. Streszczenie

**Jedno twarde znalezisko w klasie #53: `components/responses/NotFound` (l. 1797).**
Przykład obiecuje `Nie znaleziono zasobu.`. Ten backend nie ma dziś **ani jednej**
ścieżki kodu, która taki tekst zwróci, a trzy realne warianty 404 dają trzy różne
komunikaty — wszystkie po angielsku, a jeden z nich wycieka nazwę klasy modelu:
`No query results for model [App\Models\Tournament] 999999`. To ta sama klasa
błędu co #53, tyle że dotkliwsza, bo `apps/public/src/pages/tournament.tsx:46`
renderuje `message` wprost na ekran odwiedzającego.

**`Unauthenticated` (l. 1785) i `Forbidden` (l. 1791) są zgodne z rzeczywistością.**
`Unauthenticated.` zostało potwierdzone na żywym backendzie, `This action is
unauthorized.` odtworzone dwiema drogami (`new AuthorizationException`, odmowa
Gate'a) i odczytane z kodu dla trzeciej (`FormRequest::failedAuthorization()`).
Oba są w kodzie frameworka
**napisami stałymi, nie idą przez tłumacz** — `backend/lang/pl` ani `lang/pl.json`
ich nie spolszczą, cokolwiek by w nich wpisać.

**Ścieżki `/register`, `/login`, `/logout`, `/me` mają zgodne kody statusu
(201/200/204/200) i zgodny kształt `AuthPayload`**, ale dwa przykłady są
nierealistyczne: token w przykładzie ma 20 znaków po pionowej kresce, a Sanctum
zawsze generuje 48; `createdAt` w przykładzie ma offset `+02:00`, a backend
z `config/app.php` (`'timezone' => 'UTC'`) zawsze zwróci `+00:00`.

**Znalezisko poboczne, ale poważniejsze od wszystkich powyższych: `/me` i
`/logout` bez tokenu i bez nagłówka `Accept: application/json` zwracają 500,
nie 401** — również przy `APP_DEBUG=false`. Przyczyna siedzi w
`bootstrap/app.php`, poprawka to jedna linia. Testy tego nie łapią, bo
`getJson()`/`postJson()` zawsze ustawiają `Accept`.

**Kontrakt nie opisuje kodów 405, 413, 500 i 400, a framework je zwraca.** 415 i
429 nie występują: Laravel nie sprawdza `Content-Type`, a w aplikacji nie ma
żadnego limitera.

## 2. Metoda: skąd wiadomo, co wychodzi przy `APP_DEBUG=false`

Lokalne `backend/.env` ma `APP_DEBUG=true`, więc każda odpowiedź błędu dokłada
`exception`, `file`, `line` i `trace` i zaciemnia obraz. Rozstrzygające jest
zachowanie produkcyjne, bo to ono trafi do klienta API.

`.env` **nie było zmieniane** (`git status --short` na końcu badania: czysto).
Zamiast tego do gitignorowanego `backend/storage/app/probe.php` (usuniętego po
badaniu) trafiał skrypt, który ustawiał `config(['app.debug' => false])` i
przepuszczał ręcznie zbudowane żądania przez jądro HTTP:

```php
config(['app.debug' => false]);
$kernel = app(Illuminate\Contracts\Http\Kernel::class);
$request = Illuminate\Http\Request::create('/api/v1/nie-ma', 'GET', [], [], [], ['HTTP_ACCEPT' => 'application/json']);
echo $kernel->handle($request)->getStatusCode().' '.$kernel->handle($request)->getContent();
```

Uruchamiany przez `cd backend && ./vendor/bin/sail artisan tinker --execute 'require base_path("storage/app/probe.php");'`.
Skrypt kończył się wypisaniem `app.debug = false`, żeby nie brać założenia na
wiarę. Wszystkie kolumny „tekst realny (`APP_DEBUG=false`)" w tabeli niżej
pochodzą stamtąd; kolumna była dodatkowo konfrontowana z `curl` przeciw żywemu
kontenerowi (`APP_DEBUG=true`) — różnią się wyłącznie obecnością pól
diagnostycznych, nigdy treścią `message`.

Dlaczego to ma znaczenie: `Handler::convertExceptionToArray()`
(`vendor/laravel/framework/src/Illuminate/Foundation/Exceptions/Handler.php:1123`)
przy `app.debug === false` zwraca `['message' => $this->isHttpException($e) ? $e->getMessage() : 'Server Error']`.
Czyli **każdy wyjątek HTTP oddaje swój komunikat wprost do klienta, także
produkcyjnie** — nie ma warstwy, która by go uogólniła. Uogólniane jest tylko to,
co wyjątkiem HTTP nie jest (stąd `Server Error` na 500).

## 3. Tabela znalezisk

Numery linii z `packages/api-contract/openapi.yaml` na commicie `e330a16`.

| Miejsce w kontrakcie | Tekst obiecany | Tekst realny (`APP_DEBUG=false`) | Werdykt |
|---|---|---|---|
| `responses/Unauthenticated`, l. 1785 | `Unauthenticated.` | `Unauthenticated.` | **zgodne** |
| `responses/Forbidden`, l. 1791 | `This action is unauthorized.` | `This action is unauthorized.` | **zgodne** (zastrzeżenie w §5) |
| `responses/NotFound`, l. 1797 | `Nie znaleziono zasobu.` | brak trasy: `The route api/v1/... could not be found.`; binding/`findOrFail`: `No query results for model [App\Models\Tournament] 999999`; `abort(404)`: `""` | **rozjazd** |
| `responses/ValidationError`, l. 1804 | `Pole nazwa jest wymagane.` | `Pole nazwa jest wymagane. (i jeszcze 3 błędy)` przy 4 błędach, `Pole nazwa jest wymagane.` przy jednym | **zgodne** (naprawione w `e330a16`, poza zakresem) |
| `responses/NotModified`, l. 1773 | ciało puste | — | **nieweryfikowalne dziś** (endpointy `/public/*` nie stoją) |
| `/register` 201, token, l. 112 | `1\|4bT9xQkR7fN2wUhLpVmZ` (20 znaków po `\|`) | `12\|8x3BVdO9vPngf3k0POalbZPQm0PJS4R6fWeRa3MR3d017862` (48 znaków po `\|`) | **rozjazd** (kosmetyczny) |
| `/register` 201, `createdAt`, l. 117 | `2026-09-01T10:00:00+02:00` | `2026-09-21T19:19:46+00:00` | **rozjazd** (kosmetyczny, format zgodny) |
| `/login` 200, token + `createdAt`, l. 150 i 155 | jw. | jw. | **rozjazd** (kosmetyczny) |
| `/me` 200, `createdAt`, l. 186 | `2026-09-01T10:00:00+02:00` | `2026-09-21T19:19:46+00:00` | **rozjazd** (kosmetyczny) |
| `/register` `'201'`, l. 101 | 201 | 201 | **zgodne** |
| `/login` `'200'`, l. 139 | 200 | 200 | **zgodne** |
| `/logout` `'204'`, l. 163 | 204, bez ciała | 204, bez ciała | **zgodne** |
| `/me` `'200'`, l. 172 | 200 | 200 | **zgodne** |
| `/logout` i `/me` `'401'`, l. 164 i 187 | 401 | 401 **tylko z `Accept: application/json`**; bez tego nagłówka **500** | **rozjazd** (§7.3) |
| pozostałe ścieżki (`/sports`, `/tournaments`, `/teams`, `/players`, `/venues`, `/public/*`) | — | — | **nieweryfikowalne dziś**: endpoint nie stoi, przykład jest specyfikacją intencji |

Endpointy domenowe nie stoją — `cat backend/routes/api.php` pokazuje cztery trasy
autoryzacji i nic więcej. Ich przykłady **nie są** tą klasą błędu i nie zostały
policzone jako rozjazdy.

## 4. 404: trzy warianty, trzy różne komunikaty

To jest sedno znaleziska, bo `responses/NotFound` jest w kontrakcie użyty
**22 razy** (`grep -c "responses/NotFound" packages/api-contract/openapi.yaml`),
a żadne z tych 22 miejsc nie jest dziś zaimplementowane. Decyzja zapada więc
zanim powstanie kod, który ją utrwali.

### 4.1. Co realnie wychodzi

Wszystkie cztery wiersze odtworzone skryptem z §2, przy `app.debug = false`:

| Źródło 404 | `message` | Kod frameworka |
|---|---|---|
| brak trasy (`NotFoundHttpException` z routera) | `The route api/v1/nie-ma-takiego-zasobu could not be found.` | `Routing/AbstractRouteCollection.php:44`, `sprintf('The route %s could not be found.', $request->path())` |
| route-model binding, brak modelu | `No query results for model [App\Models\User] 999999` | `Database/Eloquent/ModelNotFoundException::setModel()` + `Handler::prepareException():762` |
| `Model::findOrFail()` w kontrolerze | `No query results for model [App\Models\Tournament] 999999` | jw. |
| `abort(404)` bez komunikatu | **pusty string** `""` | `HttpException(404, '')`, `convertExceptionToArray()` oddaje go bez zmian |
| `abort(404, 'Nie znaleziono zasobu.')` | `Nie znaleziono zasobu.` | jw. |
| `Response::denyAsNotFound()` / `AuthorizationException::asNotFound()` | `Not Found` | `Handler::prepareException():763–765`, fallback `Response::$statusTexts[404]` |

Dwie rzeczy warte wyciągnięcia z tej tabeli:

- **`abort(404)` daje `{"message": ""}`.** Schemat `Error` (l. 1809–1813) wymaga
  tylko `message: { type: string }`, więc pusty string przechodzi walidację
  Spectatora bez mrugnięcia. Gdyby endpointy domenowe użyły gołego `abort(404)`,
  kontrakt byłby formalnie spełniony, a klient nie dostałby nic.
- **Wariantem domyślnym dla endpointów domenowych będzie ten drugi**, bo kontrakt
  ma `{tournament}`, `{team}`, `{player}`, `{venue}`, `{slug}` i naturalnym
  rozwiązaniem w Laravelu jest implicit binding. Czyli domyślnie wyjdzie
  `No query results for model [App\Models\Tournament] 7`.

### 4.2. Czy `lang/pl` to spolszczy

Nie. Żaden z tych komunikatów nie przechodzi przez tłumacz:

```bash
cd backend && grep -n "__(\|trans(" \
  vendor/laravel/framework/src/Illuminate/Routing/AbstractRouteCollection.php \
  vendor/laravel/framework/src/Illuminate/Database/Eloquent/ModelNotFoundException.php
```

zwraca zero trafień. `AbstractRouteCollection` skleja komunikat `sprintf`-em,
`ModelNotFoundException::setModel()` przypisuje `$this->message` interpolacją
napisu. Dopisanie kluczy do `backend/lang/pl.json` nie zmieni niczego.

### 4.3. Czy da się mieć jeden przykład dla wszystkich wariantów

**Tak, ale tylko pod warunkiem, że backend dogoni przykład.** Same w sobie
warianty są nie do pogodzenia jednym `example`: jeden mówi o trasie, drugi
o klasie modelu i identyfikatorze, trzeci jest pusty.

Rozbijanie kontraktu na trzy odpowiedzi 404 odpada — OpenAPI nie ma czym
rozróżnić dwóch ciał pod tym samym kodem statusu inaczej niż przez
`examples:` z kilkoma nazwanymi wariantami, a to znaczy, że **klient musiałby
umieć obsłużyć wszystkie trzy**, w tym pusty `message`. Dla frontu, który
`message` renderuje wprost, to jest przeniesienie problemu, nie rozwiązanie.

### 4.4. Rekomendacja dla 404 — tu wybieramy odwrotnie niż w #53

**Backend dogania przykład.** W #53 wybrano „przykład dogania rzeczywistość", bo
tam rzeczywistość była lepsza od przykładu: `Nieprawidłowy e-mail lub hasło.`
niesie konkret, którego `Podane dane są nieprawidłowe.` nie niesie. Przy 404 jest
dokładnie na odwrót — rzeczywistość jest gorsza od przykładu z trzech powodów:

1. **Wyciek szczegółu implementacyjnego.** `No query results for model
   [App\Models\Tournament] 7` podaje na zewnątrz przestrzeń nazw i nazwę klasy
   modelu, i robi to **także produkcyjnie**, bo `NotFoundHttpException` jest
   wyjątkiem HTTP, więc `convertExceptionToArray()` przepuszcza jego `message`
   przy `app.debug === false` (kod w §2).
2. **To trafia na ekran użytkownika.** `apps/public/src/pages/tournament.tsx:46`
   to `return <p className="p-8 text-destructive">{tournament.error.message}</p>`,
   a `apps/admin/src/pages/tournaments.tsx:83` przekazuje `error?.message` do
   `errorMessage`. Odwiedzający stronę publiczną pod nieistniejącym slugiem
   zobaczyłby angielski komunikat o klasie Eloquenta.
3. **Reszta API jest po polsku.** Po #11 i `e330a16` wszystkie 422 mówią po
   polsku. 404 zostałby jedynym miejscem, gdzie użytkownik dostaje angielski
   napis, i to takim, którego `lang/pl` nie naprawi.

Konkretnie: zostawić przykład `Nie znaleziono zasobu.` bez zmian i dołożyć
w `backend/bootstrap/app.php`, w istniejącym `withExceptions()`, przesłonięcie
renderowania — to jest przepis wprost z dokumentacji Laravela 13.x
(`errors.md`, „Rendering Exceptions", znaleziony przez `search-docs`; przykład
w dokumentacji używa dokładnie `NotFoundHttpException` i warunku `$request->is('api/*')`):

```php
$exceptions->render(function (NotFoundHttpException $e, Request $request) {
    if ($request->is('api/*')) {
        return response()->json(['message' => __('Nie znaleziono zasobu.')], 404);
    }
});
```

Uwagi do wdrożenia, żeby nie wyszło gorzej niż było:

- `NotFoundHttpException` jest **wspólnym** typem dla brakującej trasy i dla
  brakującego modelu (`Handler::prepareException():762` opakowuje
  `ModelNotFoundException` właśnie w niego), więc jedno przesłonięcie zamyka oba
  warianty. To jest zaleta, nie przypadek: dzięki temu jeden przykład
  w kontrakcie staje się prawdziwy.
- Kosztem jest utrata czytelnego `The route ... could not be found.` w dev.
  Warto zostawić oryginalny komunikat, gdy `config('app.debug')` jest prawdziwe —
  produkcyjnie i tak nie wyjdzie, a literówka w URL-u przestanie być zagadką.
- `abort(404)` w kodzie domenowym przestanie mieć znaczenie (przesłonięcie
  nadpisze pusty `message`), ale i tak lepiej, żeby endpointy używały binding-u
  albo `abort(404, __('Nie znaleziono zasobu.'))`.
- Dochodzi asercja do Pesta. Dzisiejszy `tests/Feature/AuthTest.php:223`
  („oddaje 404 jako JSON w kształcie z kontraktu") sprawdza wyłącznie
  `assertJsonStructure(['message'])`, czyli przeszedłby też na pustym stringu.
  Po zmianie powinien asertować treść.

Alternatywa „przykład dogania rzeczywistość" jest możliwa, ale wymagałaby
wpisania do kontraktu `No query results for model [App\Models\Tournament] 7`
jako oficjalnej treści odpowiedzi publicznego API. To zamraża nazwę klasy
PHP w kontrakcie, który jest źródłem prawdy również dla frontu i mocka.
Odradzam.

## 5. 403: `This action is unauthorized.` jest nadal aktualne

Potwierdzone w kodzie i odtworzone. `AuthorizationException::__construct()`
(`vendor/laravel/framework/src/Illuminate/Auth/Access/AuthorizationException.php:33`):

```php
parent::__construct($message ?? 'This action is unauthorized.', 0, $previous);
```

`grep -rn "This action is unauthorized\." vendor/laravel/framework/src/Illuminate/`
daje **dokładnie jedno** trafienie — tę linię. Tekst jest napisem stałym, bez
`__()`, więc `lang/pl` go nie dotknie.

Odtworzone przy `app.debug = false`, wszystkie trzy drogi dały 403 i ten sam tekst:

| Droga | `message` |
|---|---|
| `throw new AuthorizationException` | `This action is unauthorized.` |
| `Gate::authorize()` przy callbacku zwracającym `false` | `This action is unauthorized.` |
| `Gate::authorize()` przy `Response::deny('Turniej należy do innego organizera.')` | `Turniej należy do innego organizera.` |
| `new AuthorizationException('Turniej należy do innego organizera.')` | `Turniej należy do innego organizera.` |

Czwarta droga, `FormRequest::authorize()` zwracające `false`, prowadzi do tego
samego: `Foundation/Http/FormRequest.php:360` to `failedAuthorization()` z gołym
`throw new AuthorizationException;`. Nie odtwarzałem jej żądaniem HTTP, opieram
się na odczytanym kodzie.

Ścieżka renderowania: `Handler::prepareException():766` zamienia
`AuthorizationException` bez statusu na `AccessDeniedHttpException($e->getMessage())`,
czyli komunikat przechodzi do klienta bez zmian. Wariant ze statusem (linia 763)
bierze `$e->response()?->message()`, a przy jego braku
`Response::$statusTexts[$status]` — stąd `Not Found` przy `denyAsNotFound()`.

**Werdykt: przykład jest zgodny, nie ma czego poprawiać w ramach #53.**

Zastrzeżenie na przyszłość, do decyzji przy pierwszej policy (S1): `Response::deny()`
przenosi własny tekst do klienta 1:1, co daje tanią drogę do polskiego 403 bez
przesłaniania handlera. Gdyby zespół chciał spójności językowej z 422 i 404,
zmiana idzie normalną kolejnością — najpierw `example` w kontrakcie, potem
policy. Sam `lang/pl.json` **nie wystarczy**, bo tekst nie idzie przez tłumacz.
Dzisiejszy `description` odpowiedzi (`Zasób należy do innego organizera`, l. 1787)
jest już po polsku, więc rozjazd językowy między opisem a przykładem będzie widać.

## 6. 401: przykład zgodny, ale endpoint ma osobny problem

`Unauthenticated.` jest napisem stałym w dwóch miejscach:
`Auth/AuthenticationException.php:38` (wartość domyślna parametru) oraz
`Auth/Middleware/Authenticate.php:102` (jawnie przekazana). Bez tłumacza.

W Sanctumie nie ma nic, co by to zmieniło:
`grep -rn "Unauthenticated\." vendor/laravel/sanctum/src/` trafia wyłącznie
w `Http/Middleware/AuthenticateSession.php:57`, czyli w tryb SPA na ciasteczkach,
którego nie używamy (nasze trasy mają `Illuminate\Auth\Middleware\Authenticate:sanctum`,
`route:list` niżej).

Dodatkowo `Handler::unauthenticated():846` buduje odpowiedź ręcznie
(`response()->json(['message' => $exception->getMessage()], 401)`), z pominięciem
`convertExceptionToArray()`. Dlatego 401 **nie zmienia kształtu przy
`APP_DEBUG=true`** — nie ma w nim `exception` ani `trace` nawet lokalnie. To
jedyny błąd w tym API o tej własności.

**Werdykt: zgodne.**

## 7. Ścieżki `/register`, `/login`, `/logout`, `/me`

### 7.1. Kody statusu i kształt `AuthPayload` — zgodne

Pełny przebieg na żywym backendzie dał `201 Created` (`/register`), `200 OK`
(`/login`), `200 OK` (`/me`), `204 No Content` z pustym ciałem (`/logout`)
i `401` na `/me` po wylogowaniu. Kształt odpowiedzi
`{"data":{"token":"…","user":{"id":…,"name":…,"email":…,"createdAt":…}}}`
zgadza się ze schematem `AuthPayload` (l. 1853–1858) co do pola.

### 7.2. Dwa nierealistyczne przykłady

**Token.** Kontrakt pokazuje `1|4bT9xQkR7fN2wUhLpVmZ` — 20 znaków po kresce.
Sanctum v4.3.3 generuje w `HasApiTokens::generateTokenString()`
`Str::random(40)` sklejone z `hash('crc32b', $tokenEntropy)`, czyli **48 znaków**
(40 + 8 heksadecymalnych). Zmierzone na żywej odpowiedzi: 48. Przykładowy token
nie jest więc nawet formalnie poprawnym tokenem tego API — po nowszym Sanctumie
zawsze kończy się ośmioma znakami sumy kontrolnej, po której pakiet odsiewa
oczywiste śmieci zanim pójdzie do bazy.

Rekomendacja: **przykład dogania rzeczywistość** (jak w #53). Wpisać token
o realnej długości, np. `1|4bT9xQkR7fN2wUhLpVmZaCdEfGhIjKlMnOpQrSt1a2b3c4d`.
Wariant odwrotny nie wchodzi w grę — nie będziemy skracać tokenu dla zgodności
z przykładem.

**`createdAt`.** Kontrakt pokazuje offset `+02:00`, backend zwraca `+00:00`,
bo `backend/config/app.php:68` to twarde `'timezone' => 'UTC'` (bez `env()`).
Format się zgadza: `UserResource` woła `toIso8601String()`, co daje
`2026-09-21T19:19:46+00:00`, czyli ISO 8601 z offsetem tak, jak wymaga sekcja
„Konwencje" kontraktu.

To jest przypadek graniczny: przykład **nie kłamie o kształcie**, tylko pokazuje
offset, którego backend nigdy nie wyprodukuje. Rekomendacja: **przykład dogania
rzeczywistość**, zamienić `+02:00` na `+00:00` w trzech miejscach (l. 117, 155,
186). Wariant odwrotny — zmiana `app.timezone` na `Europe/Warsaw` — jest decyzją
o przechowywaniu czasu, nie o przykładzie w kontrakcie, i nie powinna wynikać
z tego, co ktoś kiedyś wpisał w `example`. Jeżeli miałaby zapaść, to osobnym
ticketem i raczej jako ADR.

### 7.3. `/me` i `/logout` bez nagłówka `Accept` zwracają 500, nie 401

To nie jest rozjazd przykładu, tylko rozjazd **kodu statusu**, więc formalnie
osobna sprawa od #53 — ale dotyczy dokładnie tych ścieżek, które kazano zbadać,
i jest z całego badania najpoważniejsze.

Odtworzenie (oba przy `APP_DEBUG=false`, przez skrypt z §2; na żywym backendzie
z `APP_DEBUG=true` to samo 500, tylko z `trace`):

```
GET /api/v1/me bez Accept            => 500 { "message": "Server Error" }
GET /api/v1/me z Accept: application/json => 401 {"message":"Unauthenticated."}
POST /api/v1/logout bez Accept       => 500 { "message": "Server Error" }
```

Przy `APP_DEBUG=true` widać przyczynę:
`{"message":"Route [login] not defined.","exception":"Symfony\\Component\\Routing\\Exception\\RouteNotFoundException"}`.

Mechanizm. `Auth/Middleware/Authenticate.php:101–105`:

```php
throw new AuthenticationException(
    'Unauthenticated.',
    $guards,
    $request->expectsJson() ? null : $this->redirectTo($request),
);
```

Trzeci argument liczy się **zachłannie**, jeszcze zanim wyjątek powstanie, i
warunkuje go `$request->expectsJson()` — **nie** naszym
`shouldRenderJsonWhen(fn ($r) => $r->is('api/*') || $r->expectsJson())`
z `bootstrap/app.php`. Bez `Accept: application/json` (i bez
`X-Requested-With: XMLHttpRequest`) `expectsJson()` jest fałszywe, więc wchodzi
`redirectTo()`, a ten woła domyślny callback ustawiony przez framework w
`Foundation/Configuration/ApplicationBuilder.php:291`:

```php
$middleware = (new Middleware)->redirectGuestsTo(fn () => route('login'));
```

Trasy o nazwie `login` w tym backendzie nie ma i nie będzie (`routes/web.php` to
sam health check), więc `route('login')` rzuca `RouteNotFoundException` — wyjątek
niebędący `HttpException`, czyli 500 i `Server Error`.

Dlaczego testy tego nie widzą: każdy test w `tests/Feature/AuthTest.php` używa
`getJson()`/`postJson()`, które ustawiają `Accept: application/json`. Dlaczego
nasz front tego nie widzi: `packages/api-client/src/index.ts:53` ustawia
`Accept` w middleware na każdym żądaniu. Widzi to za to każdy inny konsument —
`curl` bez nagłówka, domyślny Postman (`Accept: */*`), monitoring, podgląd
w przeglądarce.

Poprawka to jedna linia w `bootstrap/app.php`, w pustym dziś `withMiddleware()`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->redirectGuestsTo(null);
})
```

`Foundation/Configuration/Middleware.php:539–546` zamienia `null` na
`fn () => null`, a to przez `redirectTo(guests:)` ląduje w
`Authenticate::redirectUsing()` (linia 572 tego samego pliku). Zweryfikowane
działanie, w jednym przebiegu skryptu, przy `app.debug = false`:

```
GET /api/v1/me bez Accept, stan obecny  => 500 { "message": "Server Error" }
GET /api/v1/me bez Accept, po naprawie  => 401 {"message":"Unauthenticated."}
```

(W skrypcie wywołane jako `Authenticate::redirectUsing(fn () => null)`, czyli
dokładnie to, do czego sprowadza się `redirectGuestsTo(null)`. Samego
`bootstrap/app.php` nie zmieniałem.)

Kontrakt zostaje bez zmian — on od początku obiecuje 401 i ma rację. Do zrobienia
jest test, który nie przechodzi przez `getJson()`; `$this->get('/api/v1/me', ['Accept' => '*/*'])`
albo `$this->call('GET', '/api/v1/me')` wystarczy.

## 8. Kody, których kontrakt nie opisuje, a framework je zwraca

Osobna kategoria od klasy #53: tu nie ma rozjazdu między przykładem a
rzeczywistością, tylko **luka** — kontrakt milczy o odpowiedzi, którą klient
może dostać. Wyliczenie kodów użytych w kontrakcie:

```bash
grep -oE "^\s+'[1-5][0-9]{2}':" packages/api-contract/openapi.yaml | tr -d " ':" | sort | uniq -c | sort -rn
```

daje wyłącznie 401 (26), 200 (24), 404 (22), 403 (21), 422 (15), 304 (6),
204 (5), 201 (5). Poza tym zestawem framework potrafi oddać:

| Kod | Kiedy | `message` przy `APP_DEBUG=false` | Status ustalenia |
|---|---|---|---|
| **405** | zła metoda na istniejącej ścieżce | `The GET method is not supported for route api/v1/login. Supported methods: POST.` (+ nagłówek `Allow: POST`) | odtworzone, `curl` i skrypt |
| **500** | każdy wyjątek niebędący `HttpException` | `Server Error` | odtworzone (`RuntimeException` w trasie testowej) |
| **413** | `CONTENT_LENGTH` ponad `post_max_size` (w kontenerze `100M`) | `The POST data is too large.` | odtworzone przez podstawienie `CONTENT_LENGTH`; źródło: `Http/Middleware/ValidatePostSize.php:24` |
| **400** | ścieżka URL z niepoprawnym UTF-8 | `Malformed URL.` | odczytane z `Http/Exceptions/MalformedUrlException.php`, **nie odtwarzałem** żądaniem |
| **503** | tryb konserwacji (`artisan down`) | `Service Unavailable` | odczytane z `Foundation/Http/Middleware/PreventRequestsDuringMaintenance.php:102–107`, **nie odtwarzałem** |

Trzy kody, o które warto zapytać wprost, bo **nie występują**:

- **415 nie istnieje.** Laravel nie sprawdza `Content-Type` żądania. Sprawdzone:
  `POST` z `Content-Type: text/plain` przeszedł do trasy z pustym `$request->all()`
  i zwrócił 200. Zepsuty JSON (`{to nie jest json`) też nie daje 400 — ciało po
  prostu parsuje się na pustą tablicę i idzie dalej, czyli w praktyce skończy się
  na 422 z walidacji.
- **429 nie występuje.** W aplikacji nie ma żadnego limitera:
  `grep -rn "RateLimiter\|throttle" backend/app backend/bootstrap backend/routes`
  nie znajduje nic, a `route:list` (niżej) pokazuje na trasach wyłącznie grupę
  `api` i `Authenticate:sanctum`. W Laravelu 11+ `throttle:api` **nie jest**
  domyślną częścią grupy `api` — dokłada je dopiero `$middleware->throttleApi()`
  (`Foundation/Configuration/Middleware.php:497`), którego w `bootstrap/app.php`
  nie ma. Gdyby kiedyś doszło, komunikatem będzie `Too Many Attempts.`
  (`Routing/Middleware/ThrottleRequests.php:256`).
- **419 nie występuje**, bo grupa `api` nie ma `PreventRequestForgery`
  (`Foundation/Configuration/Middleware.php:495–499`).

Rekomendacja: 405 i 500 dopisać do kontraktu nie warto per-endpoint (byłoby to
22 razy to samo), ale warto o nich **wspomnieć w `info.description`**, w sekcji
„Konwencje", obok zdania o kopercie błędu. Klient generowany z kontraktu i tak
musi mieć gałąź „nieudokumentowany kod" — chodzi o to, żeby autor frontu
wiedział, że `message` przy 500 jest bezużyteczne (`Server Error`), a przy 405
niesie treść.

Osobno, drobiazg poza klasą #53, zauważony przy liczeniu: `/tournaments/{tournament}/logo`
(l. 399) i `/teams/{team}/logo` (l. 578) mają `401`, `403` i `422`, ale **nie mają
`404`**, choć obie ścieżki niosą parametr rozwiązywany bindingiem, więc 404
z nich wyjdzie. Pozostałe ścieżki z parametrem 404 mają. Wygląda na przeoczenie.
Te dwie ścieżki są też jedynymi kandydatami na 413 z tabeli wyżej.

## 9. Rekomendacje w skrócie

| # | Co | Kierunek | Uzasadnienie |
|---|---|---|---|
| 1 | `responses/NotFound`, l. 1797 | **backend dogania przykład** | §4.4: rzeczywistość wycieka nazwę klasy modelu, trafia na ekran użytkownika i jest po angielsku; przykład zostaje, dochodzi `$exceptions->render()` |
| 2 | token w `/register` i `/login`, l. 112 i 150 | **przykład dogania rzeczywistość** | §7.2: Sanctum generuje 48 znaków, nie 20 |
| 3 | `createdAt`, l. 117, 155, 186 | **przykład dogania rzeczywistość** | §7.2: `app.timezone` to `UTC`, offset zawsze `+00:00` |
| 4 | 500 zamiast 401 bez `Accept` | **backend dogania kontrakt** | §7.3: `$middleware->redirectGuestsTo(null)`, kontrakt bez zmian |
| 5 | `responses/Unauthenticated`, `responses/Forbidden` | **bez zmian** | §5, §6: zgodne z rzeczywistością |
| 6 | 405 i 500 | wzmianka w `info.description` | §8: luka, nie rozjazd |
| 7 | `404` na obu `/logo` | dopisać `$ref` | §8: przeoczenie, poza klasą #53 |

Kolejność zmian w kontrakcie bez wyjątków: `openapi.yaml`, potem
`npm run contract:generate`, potem kod ([`AGENTS.md`](../../AGENTS.md)).

## 10. Polecenia do odtworzenia

Wersje i konfiguracja:

```bash
grep -n '"laravel/framework"' backend/composer.lock -A3
grep -n '"name": "laravel/sanctum"' backend/composer.lock -A3
grep -n "timezone" backend/config/app.php
grep -n "APP_DEBUG\|APP_LOCALE" backend/.env backend/phpunit.xml
cat backend/routes/api.php
cat backend/bootstrap/app.php
cd backend && ./vendor/bin/sail artisan route:list --path=api --json
```

Żywy backend (`APP_DEBUG=true`, więc doklei `exception`/`trace`):

```bash
curl -s -H 'Accept: application/json' http://localhost:8000/api/v1/nie-ma-takiego-zasobu
curl -s -i -H 'Accept: application/json' http://localhost:8000/api/v1/me
curl -s -i -H 'Accept: application/json' http://localhost:8000/api/v1/login      # 405
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/v1/me         # 500, bez Accept
curl -s -o /dev/null -w '%{http_code}\n' -H 'Accept: application/json' http://localhost:8000/api/v1/me   # 401
curl -s -X POST http://localhost:8000/api/v1/register -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Badacz","email":"badacz@example.com","password":"tajnehaslo123","passwordConfirmation":"tajnehaslo123"}'
```

Zachowanie produkcyjne (`APP_DEBUG=false`), bez ruszania `.env` — skrypt
w gitignorowanym `backend/storage/app/probe.php` (`git check-ignore -v
backend/storage/app/probe.php` to potwierdza), uruchamiany przez:

```bash
cd backend && ./vendor/bin/sail artisan tinker --execute 'require base_path("storage/app/probe.php");'
```

Szkielet skryptu i przykładowe przypadki — §2 oraz:

```php
config(['app.debug' => false]);
Route::middleware('api')->prefix('api/v1')->group(function () {
    Route::get('/probe/find-or-fail', fn () => App\Models\Tournament::findOrFail(999999));
    Route::get('/probe/abort-404', fn () => abort(404));
    Route::get('/probe/binding/{user}', fn (App\Models\User $user) => ['id' => $user->id]);
    Route::get('/probe/boom', function () { throw new RuntimeException('cokolwiek'); });
});
$kernel = app(Illuminate\Contracts\Http\Kernel::class);
$r = Illuminate\Http\Request::create('/api/v1/probe/abort-404', 'GET', [], [], [], ['HTTP_ACCEPT' => 'application/json']);
echo $kernel->handle($r)->getStatusCode().' '.$kernel->handle($r)->getContent();
```

Kod frameworka (ścieżki względem `backend/`):

```bash
grep -n "convertExceptionToArray" -A 12 vendor/laravel/framework/src/Illuminate/Foundation/Exceptions/Handler.php
sed -n '758,774p' vendor/laravel/framework/src/Illuminate/Foundation/Exceptions/Handler.php   # prepareException
sed -n '843,856p' vendor/laravel/framework/src/Illuminate/Foundation/Exceptions/Handler.php   # unauthenticated
sed -n '40,48p'   vendor/laravel/framework/src/Illuminate/Routing/AbstractRouteCollection.php
sed -n '128,140p' vendor/laravel/framework/src/Illuminate/Routing/AbstractRouteCollection.php
grep -n "setModel" -A 12 vendor/laravel/framework/src/Illuminate/Database/Eloquent/ModelNotFoundException.php
sed -n '99,106p'  vendor/laravel/framework/src/Illuminate/Auth/Middleware/Authenticate.php
sed -n '286,292p' vendor/laravel/framework/src/Illuminate/Foundation/Configuration/ApplicationBuilder.php
sed -n '495,500p;539,546p;565,575p' vendor/laravel/framework/src/Illuminate/Foundation/Configuration/Middleware.php
grep -rn "This action is unauthorized\." vendor/laravel/framework/src/Illuminate/
grep -rn "Unauthenticated\." vendor/laravel/framework/src/Illuminate/ vendor/laravel/sanctum/src/
grep -n "generateTokenString" -A 8 vendor/laravel/sanctum/src/HasApiTokens.php
```

Dowód, że komunikaty nie idą przez tłumacz (zero trafień):

```bash
cd backend && grep -n "__(\|trans(" \
  vendor/laravel/framework/src/Illuminate/Auth/Middleware/Authenticate.php \
  vendor/laravel/framework/src/Illuminate/Auth/AuthenticationException.php \
  vendor/laravel/framework/src/Illuminate/Auth/Access/AuthorizationException.php \
  vendor/laravel/framework/src/Illuminate/Routing/AbstractRouteCollection.php \
  vendor/laravel/framework/src/Illuminate/Database/Eloquent/ModelNotFoundException.php
```

Konsumenci `message` po stronie frontu:

```bash
grep -rn "error.message\|error?.message" apps/admin/src apps/public/src
grep -n "Accept" packages/api-client/src/index.ts
```

## 11. Czego nie sprawdziłem

- **400 (`Malformed URL.`) i 503 (`Service Unavailable`)** — oba odczytane
  z kodu, żadnego nie odtwarzałem żądaniem. 503 wymagałoby `artisan down` na
  współdzielonym kontenerze.
- **413 odtworzone sztucznie.** Podstawiłem `CONTENT_LENGTH` o wartości 1 GiB
  przy ciele `{}`, bo `ValidatePostSize` porównuje właśnie nagłówek
  (`Http/Middleware/ValidatePostSize.php:23`). Nie wysyłałem realnego pliku
  ponad `post_max_size` (w kontenerze `100M`). Nie sprawdzałem też, czy warstwa
  serwera przed PHP (w Sailu to wbudowany serwer, w produkcji będzie nginx) nie
  utnie takiego żądania wcześniej i własnym kształtem odpowiedzi.
- **`FormRequest::authorize()` zwracające `false`** — ścieżka odczytana z kodu
  (`Foundation/Http/FormRequest.php:360`), nieodtworzona żądaniem HTTP, bo
  dzisiejsze `LoginRequest` i `RegisterRequest` zwracają `true`.
- **Zachowanie `/public/*`, `304` i nagłówków walidatora** — endpointy nie stoją,
  nie ma czego mierzyć. `responses/NotModified` (l. 1773) nie ma ciała, więc poza
  klasą #53 i tak by nie wpadł.
- **Czy `$exceptions->render()` na `NotFoundHttpException` nie zepsuje czegoś
  w Spectatorze.** Rekomendacja z §4.4 jest oparta na dokumentacji i na kodzie
  handlera; nie napisałem testu, który by ją wdrożył i przepuścił przez
  `assertValidResponse(404)`. To jest robota implementacyjna, nie badawcza, ale
  warto ją zrobić przed zamknięciem decyzji.
- **Historia issues frameworka i Sanctuma** — nie przeglądana. Wszystkie
  twierdzenia o zachowaniu pochodzą z kodu wersji zainstalowanej w tym repo
  (13.29.0 / v4.3.3), nie z ogólnej wiedzy o Laravelu.
