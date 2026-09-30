# Upload obrazów w Laravelu 13 a kontrakt, Spectator i klient TS

Badanie na potrzeby ticketu
[#84 „S1: research — upload obrazów w Laravelu 13, kontrakt i klient"](https://github.com/dawer2253/sports-tournament-app/issues/84).
Odblokowuje [#88 „S1: logo turnieju i herb drużyny — pliki, limity, podmiana"](https://github.com/dawer2253/sports-tournament-app/issues/88).
Data: 28 września 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Formaty, limity, kształt
`logoUrl`, sprzątanie starych plików i ewentualna zmiana kontraktu należą do
#88. Tam, gdzie fakty otwierają kilka dróg, są wypisane jako opcje z
konsekwencjami, bez wskazania zwycięzcy.

## 0. Źródła i metoda

Wyłącznie pierwotne:

- kod frameworka i pakietów w `backend/vendor/` — katalog nie jest w repo,
  czytany z lokalnej instalacji, której wersje zgadzają się z lockiem
  (`grep -A1 -E '"name": "(laravel/framework|hotmeteor/spectator)"' backend/composer.lock`
  oraz to samo na `backend/vendor/composer/installed.json`):
  `laravel/framework` **v13.29.0**, `hotmeteor/spectator` **v3.0.4**,
  `opis/json-schema` **2.6.0** (walidator schematów pod Spectatorem),
  `laravel/sail` **v1.67.0**, `symfony/mime` **v8.1.5**;
- kod `openapi-fetch` **0.17.0**, `openapi-typescript` **7.13.0**
  i `openapi-typescript-helpers` **0.1.0** z `node_modules`
  (`grep -A1 -E '"node_modules/(openapi-fetch|openapi-typescript|openapi-typescript-helpers)"' package-lock.json`);
- dokumentacja Laravela 13.x (przez MCP `laravel-boost`, źródło
  `github.com/laravel/docs/blob/13.x`), dokumentacja openapi-ts.dev, podręcznik
  PHP, `php-src` (gałąź PHP-8.5), MDN;
- log joba „Backend" z CI (run `36350624131`, 27 września 2026) — tylko do
  odczytu obrazu runnera i ustawień `setup-php`.

**Nic po stronie PHP nie było uruchamiane.** Zgodnie z `backend/AGENTS.md`
na hoście nie ma PHP, a Docker i Sail były w tym badaniu poza zakresem. Każde
zdanie o zachowaniu backendu to więc odczyt kodu z numerem linii, nie pomiar —
tam, gdzie wniosek wymaga złożenia kilku miejsc w kodzie, jest to zaznaczone.
Uruchomiony był wyłącznie kompilator TypeScriptu (§6.3).

Numery linii w `packages/api-contract/openapi.yaml` i w kodzie repo pochodzą
z `origin/main` na commicie `8540275`.

## 1. Streszczenie

- **Adres absolutny daje dysk `public`, nie żądanie.** `config/filesystems.php:44`
  składa `url` dysku z `env('APP_URL')` + `/storage`, więc
  `Storage::disk('public')->url(...)` zwraca `http://localhost:8000/storage/...`
  niezależnie od hosta w żądaniu. **Pułapka w testach:** `Storage::fake('public')`
  gubi klucz `url`, więc na podróbce ten sam kod zwraca adres względny
  `/storage/...`, który Spectator powinien odrzucić na `format: uri` (wniosek
  z kodu, niezmierzony). Na czystym klonie nie ma dowiązania `public/storage`
  i nic go nie tworzy.
- **`image` w 13.29 nie przepuszcza SVG** (tylko z `image:allow_svg`), ale
  przepuszcza więcej, niż mówi dokumentacja: poza jpg/jpeg/png/gif/bmp/webp
  także avif, heic i heif. `mimes` i `image` patrzą na treść pliku (finfo),
  `extensions` na rozszerzenie od klienta. `dimensions` przepuszcza każde SVG
  bez sprawdzania.
- **Limity w Sailu to 100M/100M, w CI 8M/2M** (produkcyjny `php.ini`).
  413 powstaje w globalnym `ValidatePostSize` z samego nagłówka
  `Content-Length`, zanim cokolwiek zobaczy Spectator. Limit na miarę logo
  da się więc postawić regułą `max` (422) albo zmianą `php.ini` w obrazie
  (413) — nie `ini_set()`, bo obie dyrektywy są `INI_PERDIR`.
- **Spectator waliduje `multipart/form-data`, ale pod warunkiem**, że test
  wyśle nagłówek `Content-Type: multipart/form-data` dosłownie — bez niego
  `post()` wysyła `application/x-www-form-urlencoded`, a `postJson()`
  `application/json`, i walidacja żądania się nie odbywa. Sam plik sprawdzany
  jest tylko na obecność i typ `string`; `format: binary` jest ignorowany.
- **`openapi-fetch` wysyła `FormData` poprawnie, ale typy temu przeczą.**
  Generator robi z `format: binary` pole `logo: string`, więc ani `File`
  w polu, ani gotowe `FormData` jako `body` się nie kompilują (sprawdzone
  `tsc`). Działa rzutowanie albo zmiana generatora na API Node z `transform`.

## 2. Dysk `public`, `storage:link` i absolutny `logoUrl`

### 2.1. Co mówi kontrakt i co stoi w schemacie

`logoUrl` ma w trzech kształtach typ `[string, 'null']` z `format: uri`:
`Branding` (l. 2001), `Team` (l. 2107), `TeamSummary` (l. 2119) —
`grep -n "logoUrl: { type" packages/api-contract/openapi.yaml`.

Walidator pod Spectatorem traktuje `format: uri` dosłownie: `opis/json-schema`
rejestruje `uri` jako format znany (`src/Resolvers/FormatResolver.php:42`),
a `UriFormats::uri()` (`src/Formats/UriFormats.php:29`) wymaga adresu
**absolutnego** (`$uri->isAbsolute()`). Ścieżka `/storage/logos/x.png`
nie przejdzie, `http://localhost:8000/storage/logos/x.png` przejdzie.

W bazie obie tabele mają kolumnę `logo_url` (`string`, `nullable`):
`grep -n "logo_url" backend/database/migrations/*.php` → `..._create_tournaments_table.php:38`
i `..._create_teams_table.php:33`. `TournamentResource` oddaje ją bez
przetworzenia: `'logoUrl' => $this->logo_url` (`backend/app/Http/Resources/TournamentResource.php:33`).

### 2.2. Skąd bierze się host

Są w Laravelu dwie drogi do adresu pliku i biorą host z różnych miejsc.

**`Storage::disk('public')->url($path)` — host z `APP_URL`, w chwili ładowania
konfiguracji.** `backend/config/filesystems.php:44`:

```php
'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
```

`FilesystemAdapter::getLocalUrl()` (`vendor/.../Filesystem/FilesystemAdapter.php:820`)
przy ustawionym `url` dokleja do niego ścieżkę; **bez `url` zwraca adres
względny** `'/storage/'.$path` — tak też opisuje to dokumentacja 13.x
(„File URLs": dla drivera `local` „return a relative URL"). Ponieważ plik
konfiguracyjny czyta `env()` wprost, a nie `config('app.url')`, zmiana
`config(['app.url' => ...])` w teście **nie** zmienia adresu dysku.

**`asset()` / `url()` — host z żądania.** `UrlGenerator::asset()` (l. 280)
bierze korzeń z `formatRoot()` (l. 644), a ten — o ile nikt nie wymusił
korzenia ani nie ustawił `app.asset_url` — z `$this->request->root()`, czyli
z nagłówka `Host`. `TrustHosts` nie jest włączony: w `getGlobalMiddleware()`
(`Foundation/Configuration/Middleware.php:456`) stoi warunkowo, a
`grep -ci trusthosts backend/bootstrap/app.php` daje `0` (na `main` i na
gałęzi PR #77).

### 2.3. Serwowanie pliku: `storage:link`

Dokumentacja 13.x („The Public Disk") każe dla dysku `public` na driverze
`local` założyć dowiązanie `public/storage` → `storage/app/public`
(`php artisan storage:link`); cel dowiązania jest w `filesystems.php:77`.

Stan repo:

- `public/storage` jest gitignorowane: `grep -n "/public/storage" backend/.gitignore` → l. 20;
- **nic go nie tworzy**: `grep -rn "storage:link" Makefile docs README.md backend/composer.json .github`
  nie daje wyników (ani cel `make`, ani skrypt Composera, ani krok CI, ani
  dokumentacja);
- `ls -la backend/public` na czystym checkoucie: `.htaccess`, `favicon.ico`,
  `index.php`, `robots.txt` — bez `storage`.

Co się dzieje z `GET /storage/logos/x.png` na Sailu (złożone z kodu, nie
zmierzone):

- **z dowiązaniem**: Sail uruchamia `artisan serve`
  (`vendor/laravel/sail/runtimes/8.5/Dockerfile:16`), ten odpala wbudowany
  serwer PHP (`php -S`, `ServeCommand::serverCommand()`, l. 221) z routerem
  `Foundation/resources/server.php`, który dla istniejącego pliku w `public/`
  zwraca `false` (l. 12) — PHP oddaje plik statycznie, z pominięciem Laravela.
  `Content-Type` wynika wtedy z rozszerzenia; mapa w `php-src`
  (`sapi/cli/mime_type_map.h`, gałąź PHP-8.5) ma m.in. `png`, `jpg`, `webp`,
  `avif`, `gif` i `svg` → `image/svg+xml`;
- **bez dowiązania**: żądanie trafia do Laravela. Dysk `local` ma
  `'serve' => true` (`filesystems.php:36`) i nie ma `url`, więc
  `FilesystemServiceProvider::serveFiles()` rejestruje trasę `GET /storage/{path}`
  (`storage.local`). `ServeFile` wymaga podpisu URL-a, bo dysk `local` nie ma
  `visibility: public`, i bez niego kończy `abort(403)` poza produkcją, `404`
  na produkcji (`Filesystem/ServeFile.php`, `hasValidSignature()`).
  Szuka przy tym w `storage/app/private`, nie w `public`.

`storage:link` bez opcji zakłada dowiązanie o **ścieżce absolutnej**. W
kontenerze to `/var/www/html/storage/app/public`, więc na hoście dowiązanie
wskazuje w pustkę (dla serwowania z kontenera bez znaczenia). Opcja
`--relative` (`StorageLinkCommand.php:17`) wymaga `symfony/filesystem`
(`Filesystem::relativeLink()`, wyjątek z komunikatem „please install the
symfony/filesystem package"), a tego pakietu nie ma:
`grep -c '"name": "symfony/filesystem"' backend/composer.lock` → `0`.

### 2.4. Sail, CI i front na innym originie

**Sail.** `backend/.env.example:5` ma `APP_URL=http://localhost:8000`, a
`compose.yaml:15` mapuje `${APP_PORT:-80}:80` przy `APP_PORT=8000`
(`.env.example:8`). `APP_URL` jest więc adresem widzianym z przeglądarki na
hoście, nie z wnętrza kontenera — dla adresu `<img>` to właściwy host.
`.env` każdej osoby jest gitignorowany; `APP_URL` bez portu dałby adresy
poprawne dla `format: uri`, ale martwe w przeglądarce.

**CI.** Job „Backend" robi `cp .env.example .env` (`ci.yml:164`), a
`phpunit.xml` nie nadpisuje `APP_URL` (`grep -c APP_URL backend/phpunit.xml` → `0`),
więc dysk `public` w testach ma `url` = `http://localhost:8000/storage`.
Serwera HTTP w CI nie ma — testy przepuszczają żądania przez jądro — więc
`storage:link` nie jest tam potrzebne do niczego, co da się asertować.

**Pułapka: `Storage::fake('public')` gubi `url`.**
`Storage::buildDiskConfiguration()` (`Support/Facades/Storage.php:166`)
przenosi z oryginalnej konfiguracji dysku tylko `throw`, a resztę bierze
z drugiego argumentu `fake()`:

```php
return array_merge([
    'throw' => $originalConfig['throw'] ?? false],
    $config,
    ['root' => $root]
);
```

Wniosek z kodu (niezmierzony): po `Storage::fake('public')` wywołanie
`Storage::disk('public')->url('logos/x.png')` zwraca `/storage/logos/x.png`,
czyli adres względny, i `assertValidResponse(200)` powinno go odrzucić na
`format: uri` (§2.1). `fake()` przyjmuje własną konfigurację, np.
`Storage::fake('public', ['url' => config('filesystems.disks.public.url')])`
— to fakt o API, nie rekomendacja.

**Front na `:5173` / `:5174`.** Port jest częścią originu, więc panel,
strona publiczna i API to trzy różne originy (MDN, „Same-origin policy").
Dla samego wyświetlenia nie ma to znaczenia: MDN wymienia „Images displayed by
`<img>`" wśród zasobów, które wolno osadzać między originami bez CORS. Znaczenie
pojawia się przy `fetch()` pliku albo rysowaniu go na `<canvas>` (canvas staje
się „tainted", MDN „CORS enabled image"). CORS w `config/cors.php:20` obejmuje
tylko `api/*`, a plik z dowiązania i tak nie przechodzi przez Laravela (§2.3),
więc nagłówków CORS przy obrazie nie będzie. `localhost` kontra `127.0.0.1`
po stronie frontu nie zmienia hosta w `logoUrl` — ten wynika z `APP_URL`.

### 2.5. Opcje dla #88: co trzyma kolumna `logo_url`

Fakty z §2.2 dają dwie drogi; wybór należy do #88.

| Opcja | Konsekwencje wynikające z kodu |
|---|---|
| Kolumna trzyma **ścieżkę na dysku**, zasób składa adres przez `Storage::disk('public')->url()` | Host zawsze z bieżącego `APP_URL`. Stary plik łatwo usunąć po ścieżce. Nazwa kolumny `logo_url` przestaje opisywać zawartość (zmiana wymaga migracji). W testach potrzebny `url` w `Storage::fake()` (§2.4). |
| Kolumna trzyma **gotowy adres absolutny**, złożony przy uploadzie | `TournamentResource` może oddawać kolumnę jak dziś. Host zamrożony z chwili uploadu — zmiana `APP_URL` nie przepisze starych wierszy. Usunięcie pliku wymaga odzyskania ścieżki z adresu. Adres złożony przez `asset()` wziąłby host z nagłówka `Host` żądania uploadu. |

Wspólne dla obu: `UploadedFile::store($path, $disk)` nazywa plik losowym
40-znakowym ciągiem z rozszerzeniem zgadniętym z treści
(`FileHelpers::hashName()`, l. 42; `UploadedFile::store()`), więc każdy
upload dostaje nowy adres. To odpowiada na pytanie #88 o wersję w adresie
przeciw cache — nowy plik to nowy URL — ale starego pliku nie usuwa nic
poza kodem, który go usunie jawnie.

## 3. Walidacja obrazów w Laravelu 13

### 3.1. `image` — co przepuszcza

`ValidatesAttributes::validateImage()` (l. 1539) w 13.29.0:

```php
$mimes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'avif', 'heic', 'heif'];

if (is_array($parameters) && in_array('allow_svg', $parameters)) {
    $mimes[] = 'svg';
}

return $this->validateMimes($attribute, $value, $mimes);
```

- **SVG nie przechodzi** bez `image:allow_svg`. `File::image(allowSvg: true)`
  to to samo przez obiekt reguły (`Rules/ImageFile.php`: `image:allow_svg`
  albo `image`).
- **Rozjazd z dokumentacją**: dokumentacja 13.x („Available Validation Rules
  → image") wymienia „jpg, jpeg, png, bmp, gif, or webp". Kod przepuszcza
  dodatkowo **avif, heic, heif**. Goła reguła `image` przyjmie więc formaty,
  których dokumentacja nie obiecuje.

### 3.2. `mimes`, `mimetypes`, `extensions`

- `validateMimes()` (l. 1754) porównuje listę z `$value->guessExtension()`.
  To metoda Symfony (`http-foundation/File/File.php:53`), która bierze MIME
  z `getMimeType()` → `MimeTypes::guessMimeType()` → `finfo` na treści pliku
  (`symfony/mime/FileinfoMimeTypeGuesser.php:45`). Dokumentacja: „this rule
  actually validates the MIME type of the file by reading the file's contents".
  Nazwa i rozszerzenie od klienta się nie liczą — dokumentacja wprost: plik
  z treścią PNG nazwany `photo.txt` przejdzie `mimes:png`.
- `extensions` (l. 1266) sprawdza **wyłącznie** rozszerzenie od klienta
  (`getClientOriginalExtension()`).
- Wszystkie trzy blokują rozszerzenia PHP (`php`, `phtml`, `phar`…), o ile na
  liście nie ma `php` (`shouldBlockPhpUpload()`, l. 1801).

### 3.3. `dimensions`

`validateDimensions()` (l. 792):

- **dla MIME `image/svg+xml` zwraca `true` od razu** (l. 794) — przy
  dopuszczonym SVG ograniczenia wymiarów nie działają wcale;
- dla pozostałych czyta `getimagesize()`; gdy ta zwróci `false`, reguła
  **odrzuca** plik. Nie sprawdzałem, czy `getimagesize()` w PHP 8.5 czyta
  AVIF i HEIC — jeśli nie, `image` + `dimensions` odrzuci taki plik mimo
  §3.1.

### 3.4. `max` i nieudany upload

- Dla pliku `max` liczy w **kilobajtach**: `getSize()` → `$value->getSize() / 1024`
  (l. 2817). Dokumentacja 13.x pozwala też na `File::image()->max('2mb')`.
- Gdy upload się nie udał (`isValid()` = `false`, np. `UPLOAD_ERR_INI_SIZE`),
  a pole ma którąkolwiek regułę plikową, walidator dodaje błąd `uploaded`
  zamiast właściwej reguły (`Validator.php:709–716`; komentarz w kodzie mówi
  wprost o plikach za dużych według ustawień PHP).
- Polskie teksty już są: `backend/lang/pl/validation.php` — `image` (l. 82),
  `dimensions` (l. 56), `max.file` (l. 108), `mimes` (l. 113), `uploaded`
  (l. 171, „Nie udało się wgrać pola :attribute."). Nazwy pola `logo` nie ma
  w `attributes` (`awk "/'attributes'/,0" backend/lang/pl/validation.php`),
  więc komunikat powie „Pole logo …".

### 3.5. SVG a XSS

- Dokumentacja 13.x (reguła `image`): SVG jest domyślnie wyłączone „due to the
  possibility of XSS vulnerabilities".
- MDN („SVG as an image"): w kontekście obrazu (`<img>`, `background-image`)
  **JavaScript jest wyłączony** i zewnętrzne zasoby się nie ładują; ograniczenia
  **nie dotyczą** SVG otwartego bezpośrednio ani osadzonego przez `<iframe>`,
  `<object>`, `<embed>`.
- Gdyby SVG było dopuszczone, otwarty bezpośrednio adres z `logoUrl` wykona
  skrypt w originie hosta pliku, czyli API (`localhost:8000`). Plik z dowiązania serwuje wbudowany serwer PHP
  z `image/svg+xml` (§2.3) i bez żadnego CSP. Dla porównania: trasa
  `ServeFile` (dyski z `serve`) sama dokłada
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`
  (`ServeFile.php:36`) — ale dysk `public` z niej nie korzysta.
- Token panelu leży w `localStorage` originu panelu
  (`grep -n localStorage apps/admin/src/lib/session.ts` → l. 5, 9, 37), czyli
  lokalnie `:5173`, innym niż `:8000` — skrypt z SVG na originie API nie
  sięga do niego regułą same-origin. **Topologii produkcyjnej (czy API, panel
  i pliki będą na jednym originie) nie sprawdzałem** — od niej zależy, czy
  ta osłona w ogóle istnieje.
- `finfo` rozpoznaje SVG po treści; zapis przez `store()` nada mu
  rozszerzenie `.svg` niezależnie od nazwy od klienta (§2.5). Nie sprawdzałem,
  jak wersja libmagic w obrazie Saila klasyfikuje SVG bez deklaracji `<?xml`.

### 3.6. Testy a wykrywanie treści

`UploadedFile::fake()` zwraca `Illuminate\Http\Testing\File`, który
**nadpisuje `getMimeType()`**: `mimeTypeToReport ?: MimeType::from($this->name)`
(`Http/Testing/File.php:132`), a `MimeType::from()` bierze MIME z
rozszerzenia nazwy. W testach `mimes` i `image` sprawdzają więc nazwę, nie
treść: `createWithContent('logo.png', '<svg…>')` przejdzie `image`, choć na
produkcji `finfo` rozpoznałby SVG. Żeby test przeszedł przez `finfo`, plik
musi być zwykłym `Illuminate\Http\UploadedFile` na prawdziwej ścieżce z
`$test = true` — ta klasa `getMimeType()` nie nadpisuje
(`grep -n getMimeType backend/vendor/laravel/framework/src/Illuminate/Http/UploadedFile.php` → brak).

## 4. Limity PHP a odpowiedź 413

### 4.1. Wartości

| Środowisko | `post_max_size` | `upload_max_filesize` | Źródło |
|---|---|---|---|
| Sail (runtime 8.5) | `100M` | `100M` | `vendor/laravel/sail/runtimes/8.5/php.ini`, kopiowany do `/etc/php/8.5/cli/conf.d/99-sail.ini` (`Dockerfile:97`) |
| CI (`setup-php`) | `8M` | `2M` | log joba: `ini-file: production` (wartość domyślna, `ci.yml` jej nie ustawia); `php.ini-production` z `php-src` PHP-8.5 |

Obie dyrektywy są `INI_PERDIR` (podręcznik PHP, `ini.core`) — `ini_set()`
w aplikacji ich nie zmieni. Obraz Saila buduje się z
`./vendor/laravel/sail/runtimes/8.5` (`compose.yaml:4`), więc zmiana limitu
na Sailu oznacza zmianę kontekstu builda (np. `sail:publish`, komenda jest
w `vendor/laravel/sail/src/Console/PublishCommand.php`). Nie sprawdzałem przez
`php -i` w kontenerze, że wbudowany serwer odpalony przez `artisan serve`
czyta ten sam `conf.d` — wynika to z tego, że to ten sam plik binarny CLI.

### 4.2. Mechanizm 413

- `ValidatePostSize` jest w **globalnym** stosie middleware'ów
  (`Foundation/Configuration/Middleware.php:460`) i porównuje **nagłówek**
  `CONTENT_LENGTH` z `ini_get('post_max_size')`
  (`Http/Middleware/ValidatePostSize.php:23`); przy przekroczeniu rzuca
  `PostTooLargeException` (413). Ciała nie czyta.
- Po stronie PHP: gdy dane POST przekraczają `post_max_size`, `$_POST`
  i `$_FILES` są puste (podręcznik PHP, `post_max_size`).
- Na gałęzi PR [#77](https://github.com/dawer2253/sports-tournament-app/pull/77)
  (`api/komunikaty-bledow-spoza-kontraktu`, otwarty, baza
  `api/szczegoly-turnieju`) mapa w `backend/bootstrap/app.php` zamienia 413
  na `Przesłane dane są za duże.`, kontrakt dostaje `components/responses/PayloadTooLarge`
  i wzmiankę w `info.description` („każde żądanie może dostać … `413`"), a
  `ErrorResponsesTest` asertuje to żądaniem z `CONTENT_LENGTH => PHP_INT_MAX`
  (`git show origin/api/komunikaty-bledow-spoza-kontraktu:backend/tests/Feature/ErrorResponsesTest.php | sed -n 150,162p`).
  Na `main` ścieżki `/logo` wypisują tylko 200, 401, 403, 404 i 422
  (`sed -n 407,435p packages/api-contract/openapi.yaml`).
- `HandleCors` stoi w tym samym globalnym stosie **przed** `ValidatePostSize`,
  a `Illuminate\Routing\Pipeline::handleException()` renderuje wyjątek wewnątrz
  potoku — więc z kodu wynika, że 413 wraca z nagłówkami CORS i panel na innym
  originie odczyta jego JSON. Nie mierzyłem tego.

### 4.3. Która warstwa odpowiada przy jakim rozmiarze

Złożone z §4.1 i §3.4, dla żądania z jednym plikiem:

| Rozmiar | Sail (100M/100M) | Skutek |
|---|---|---|
| poniżej limitu `max` aplikacji | przechodzi | 200 |
| powyżej `max`, poniżej 100M | walidacja `max` | 422, `max.file` |
| ciało powyżej 100M | `ValidatePostSize` | 413 |

Przy równych limitach plik większy niż `upload_max_filesize` oznacza ciało
większe niż `post_max_size` (multipart dokłada nagłówki części), więc na
Sailu 413 przychodzi pierwsze i droga przez `uploaded` (422 z §3.4) jest dla
pojedynczego pliku praktycznie nieosiągalna. Przy innych limitach (np.
produkcyjne 8M/2M) plik 3 MB dałby 422 `uploaded`, a nie `max`.

W testach limity PHP nie grają roli poza `ValidatePostSize`: fałszywy plik nie
przechodzi przez parser multipart PHP. Test asertujący 413 wartością
`CONTENT_LENGTH` pomiędzy 8M a 100M dałby różny wynik w CI i na Sailu; test
z `PHP_INT_MAX` jest od tego wolny.

### 4.4. 413 omija Spectatora

Middleware Spectatora jest dopinany do grup z `spectator.middleware_groups`
(`SpectatorServiceProvider.php:51`, `prependMiddlewareToGroup`), w repo
`['api']` (`backend/config/spectator.php:88`) — czyli **po** globalnym
`ValidatePostSize`. Przy 413 Spectator nie widzi ani żądania, ani odpowiedzi.
`assertValidResponse()` (`Assertions.php:65`) sprawdza tylko, czy middleware
złapał wyjątek walidacji; skoro nie działał, nic nie złapał — z kodu wynika,
że `assertValidResponse(413)` przejdzie, nie walidując niczego poza statusem.

## 5. Spectator i `multipart/form-data`

### 5.1. Żądanie: `Content-Type` porównywany dosłownie

`RequestValidator::validateBody()` (`vendor/hotmeteor/spectator/src/Validation/RequestValidator.php:158–159`):

```php
$contentType = $this->request->header('Content-Type');
if (! array_key_exists($contentType, $expectedBody->content)) {
    throw new RequestValidationException('Request did not match any specified media type for request body.');
}
```

Klucz w kontrakcie to `multipart/form-data`, więc nagłówek musi mieć dokładnie
tę wartość — wariant z `; boundary=…` nie pasuje. Co wysyłają helpery testowe
Laravela:

- `post()` bez nagłówka: Symfony `Request::create()` ustawia dla POST
  `CONTENT_TYPE = application/x-www-form-urlencoded` (`http-foundation/Request.php`,
  gałąź `case 'POST'`) → **niezgodne**;
- `postJson()` / `json()`: `CONTENT_TYPE => application/json`
  (`MakesHttpRequests.php:600`), pliki idą osobno → **niezgodne**;
- `post($uri, $data, ['Content-Type' => 'multipart/form-data'])`: nagłówek
  trafia do `CONTENT_TYPE` (`formatServerHeaderKey()`) → **zgodne**. Tak robią
  testy samego Spectatora: `handles_form_data` i `validates_upload_file`
  w `vendor/hotmeteor/spectator/tests/RequestValidatorTest.php`.

Niezgodny nagłówek nie wysypuje żądania — middleware łapie wyjątek i żądanie
idzie dalej — ale `assertValidRequest()` zgłosi błąd.

### 5.2. Co jest walidowane w ciele

Dla typu innego niż JSON Spectator buduje dane z `$request->all()`, a każdy
`UploadedFile` zamienia na jego treść (`->get()`, `parseBodySchema()`, l. 193–199),
po czym waliduje schematem `{type: object, required: [logo], properties: {logo: {type: string, format: binary}}}`.

- `format: binary` nie jest formatem znanym `opis/json-schema` (brak w
  `FormatResolver`), a `FormatKeywordParser::parse()` dla nieznanego formatu
  zwraca `null` (l. 66) — słowo kluczowe jest pomijane.
- Zostaje więc: **obecność pola `logo` i typ `string`**. Spectator nie sprawdza
  MIME, rozmiaru ani wymiarów — to wyłącznie sprawa reguł Laravela i asercji
  w Peście.

### 5.3. Odpowiedź

Odpowiedź z `/logo` to JSON, więc Spectator waliduje ją schematem
`Tournament` / `Team`, w tym `logoUrl` z `format: uri` (§2.1). To jedyne
miejsce, w którym Spectator zatrzyma adres względny — i właśnie tu ugryzie
`Storage::fake()` bez `url` (§2.4).

### 5.4. Pest: `UploadedFile::fake()` i `Storage::fake()`

Z dokumentacji 13.x („Testing File Uploads", „Filesystem → Testing") i kodu:

- `UploadedFile::fake()->image($name, $w, $h)` generuje **prawdziwy obraz**
  przez GD (`Http/Testing/FileFactory.php:74`): `jpeg`, `png`, `gif`, `webp`,
  `wbmp` albo `bmp` według rozszerzenia nazwy, dla każdego innego — JPEG
  (l. 83). Bez GD rzuca `LogicException`. Wymiary są prawdziwe, więc
  `dimensions` działa na podróbce.
- `->size($kb)` i `create($name, $kb)` tylko **raportują** rozmiar
  (`sizeToReport`); plik tymczasowy jest pusty. Wystarcza do testu `max`.
- MIME podróbki bierze się z nazwy (§3.6).
- `Storage::fake('public')` czyści i podpina katalog
  `storage/framework/testing/disks/public` (`getRootPath()`), bez `url` (§2.4).
  Asercje: `Storage::disk('public')->assertExists(...)`, `assertMissing(...)`,
  nazwa pliku z `$file->hashName()`.

GD: obraz Saila instaluje `php8.5-gd` (`grep -n php8.5-gd backend/vendor/laravel/sail/runtimes/8.5/Dockerfile`).
CI nie wymienia `gd` w `extensions:` (`ci.yml:143`); log runu `36350624131`
pokazuje obraz `ubuntu-24.04` i PHP 8.5.11, a wiki `setup-php` („PHP extensions
loaded on ubuntu-24.04") wymienia `gd` wśród ładowanych domyślnie dla 8.5.
**Nie sprawdzałem, że `fake()->image()` faktycznie działa w CI** — dziś żaden
test go nie woła (`grep -rn "fake()" backend/tests` → brak).

## 6. Klient TS: `openapi-fetch` i `multipart/form-data`

### 6.1. Typy z generatora

`openapi-typescript` robi z `format: binary` zwykły `string`, z komentarzem:
`packages/api-client/src/schema.d.ts:746–747` (`/** Format: binary */ logo: string;`),
to samo przy `/teams/{team}/logo` (l. 1106).

Generacja idzie przez CLI (`"generate": "openapi-typescript ../api-contract/openapi.yaml --output src/schema.d.ts"`
w `packages/api-client/package.json`). Lista flag CLI
(`node_modules/openapi-typescript/bin/cli.js`, l. 14–39) nie ma opcji
zamiany `binary` na `Blob`. Dokumentacja openapi-ts.dev („Node.js API →
Example: Blob types") robi to wyłącznie opcją `transform` w API Node:
`if (schemaObject.format === "binary") return BLOB`.

### 6.2. Zachowanie w czasie wykonania

`openapi-fetch` 0.17.0 (`node_modules/openapi-fetch/src/index.js`):

- `defaultBodySerializer()` (l. 619) oddaje `FormData` bez zmian;
- przy `FormData` klient **nie ustawia** `Content-Type` (l. 94–101: „browser
  will correctly set Content-Type & boundary expression"); dla każdego innego
  ciała ustawia `application/json`;
- dokumentacja (openapi-ts.dev, „API → bodySerializer") podaje przykład
  z `bodySerializer(body) { const fd = new FormData(); … return fd; }`
  i potwierdza: dla `FormData` „`Content-Type` is omitted".

Middleware klienta w `packages/api-client/src/index.ts` ustawia tylko `Accept`
i `Authorization`, więc nie psuje nagłówka z granicą multipart.

### 6.3. Co się kompiluje

Sprawdzone `tsc` 6.0.3 (z `node_modules` repo) na kopii
`packages/api-client/src/schema.d.ts` i typach `openapi-fetch` 0.17.0, dla
`client.POST('/tournaments/{tournament}/logo', { params: { path: { tournament: 1 } }, … })`:

| Wariant | Wynik |
|---|---|
| A. `body: { logo: file }` (`File`) + własny `bodySerializer` | **błąd** TS2322: `Type 'File' is not assignable to type 'string'` |
| B. `body: formData` (gotowe `FormData`) | **błąd** TS2322: `'FormData' is not assignable to type '{ logo: string; } & {}'` |
| C. `body: { logo: file as unknown as string }` + `bodySerializer` | kompiluje się |
| D. `body: formData as unknown as { logo: string }` | kompiluje się |
| E. bez `body` | **błąd** — `requestBody.required: true` robi `body` obowiązkowym |

Poboczne: `BodySerializer<T>` w `src/index.d.ts` (l. 69) ma jeden parametr,
choć implementacja przekazuje też nagłówki; `defaultBodySerializer` jest
zadeklarowany jako zwracający `string`, a dla `FormData` zwraca `FormData`.

### 6.4. Opcje (do decyzji w ticketach ekranów, nie tutaj)

- **Rzutowanie w miejscu wywołania** (wariant C lub D): bez zmian w
  generatorze; typ w `schema.d.ts` dalej kłamie o polu `logo`.
- **`transform` w API Node**: skrypt `generate` przestaje być jednym
  wywołaniem CLI; CI sprawdza zgodność wygenerowanego klienta ze specyfikacją,
  więc ta sama zmiana musi objąć i generację, i kontrolę.
- W obu przypadkach wysyłką `FormData` zajmuje się `openapi-fetch` poprawnie
  (§6.2).

## 7. Czego nie sprawdziłem

- Niczego po stronie PHP nie uruchamiałem (bez Saila, bez PHP na hoście).
  W szczególności niezmierzone są: adres względny spod `Storage::fake('public')`
  i jego odrzucenie przez Spectatora (§2.4), 403 spod `ServeFile` bez
  dowiązania (§2.3), nagłówki CORS przy 413 (§4.2), vacuous
  `assertValidResponse(413)` (§4.4).
- Zachowania wbudowanego serwera PHP przy ciele ponad `post_max_size`: czy
  ostrzeżenie „POST Content-Length … exceeds the limit" nie trafia do
  odpowiedzi przed nagłówkami (zależy od `display_errors` w obrazie Saila,
  którego nie odczytałem), i czy przeglądarka wysyła `FormData` zawsze
  z `Content-Length` (bez niego `ValidatePostSize` nie zadziała).
- Czy `getimagesize()` w PHP 8.5 odczytuje wymiary AVIF i HEIC (§3.3) i jak
  libmagic w obrazie Saila klasyfikuje SVG bez deklaracji XML (§3.5).
- `memory_limit` w obrazie Saila i w CI.
- Czy `fake()->image()` działa w CI (§5.4) — GD jest tylko na liście z wiki
  `setup-php`, nie w logu joba.
- Topologii produkcyjnej (origin API, panelu i plików) — od niej zależy
  waga ryzyka z §3.5.
- Testów frontendu z uploadem (msw + `FormData`/`File` w jsdom).

## 8. Źródła

- Laravel 13.x docs: `filesystem.md` („The Public Disk", „File URLs",
  „Testing"), `validation.md` (reguły `image`, `mimes`, `mimetypes`,
  `dimensions`, „Validating Files", „MIME Types and Extensions"),
  `http-tests.md` („Testing File Uploads") — <https://github.com/laravel/docs/tree/13.x>.
- Kod `laravel/framework` v13.29.0: `Filesystem/FilesystemAdapter.php`,
  `Filesystem/FilesystemServiceProvider.php`, `Filesystem/ServeFile.php`,
  `Support/Facades/Storage.php`, `Routing/UrlGenerator.php`,
  `Validation/Concerns/ValidatesAttributes.php`, `Validation/Validator.php`,
  `Validation/Rules/ImageFile.php`, `Http/Middleware/ValidatePostSize.php`,
  `Http/Testing/{File,FileFactory,MimeType}.php`, `Http/FileHelpers.php`,
  `Foundation/Configuration/Middleware.php`, `Foundation/Console/{ServeCommand,StorageLinkCommand}.php`,
  `Foundation/resources/server.php`, `Foundation/Testing/Concerns/MakesHttpRequests.php`.
- Kod `hotmeteor/spectator` v3.0.4: `src/Validation/{RequestValidator,ResponseValidator,AbstractValidator}.php`,
  `src/Middleware.php`, `src/Assertions.php`, `src/SpectatorServiceProvider.php`,
  `tests/RequestValidatorTest.php` — <https://github.com/hotmeteor/spectator/tree/v3.0.4>.
- Kod `opis/json-schema` 2.6.0: `src/Resolvers/FormatResolver.php`,
  `src/Formats/UriFormats.php`, `src/Parsers/Keywords/FormatKeywordParser.php`.
- Kod `laravel/sail` v1.67.0: `runtimes/8.5/{Dockerfile,php.ini}`.
- Kod `symfony/http-foundation` i `symfony/mime` v8.1.5: `File/File.php`,
  `File/UploadedFile.php`, `Request.php`, `MimeTypes.php`, `FileinfoMimeTypeGuesser.php`.
- Kod `openapi-fetch` 0.17.0 (`src/index.js`, `src/index.d.ts`) i
  `openapi-typescript` 7.13.0 (`bin/cli.js`, `dist/index.d.ts`); dokumentacja
  <https://openapi-ts.dev/openapi-fetch/api> i <https://openapi-ts.dev/node>.
- PHP: <https://www.php.net/manual/en/ini.core.php>,
  <https://www.php.net/manual/en/features.file-upload.errors.php>,
  `php-src` PHP-8.5: `php.ini-production`, `sapi/cli/mime_type_map.h`.
- `setup-php`: README i wiki „PHP extensions loaded on ubuntu-24.04"
  (<https://github.com/shivammathur/setup-php/wiki>).
- MDN: „Same-origin policy", „SVG as an image", „Allowing cross-origin use of
  images and canvas".
