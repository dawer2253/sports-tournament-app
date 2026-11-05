# Serwer MCP dla organizatora: zdalnie w Laravelu czy lokalnie przez stdio

Badanie na potrzeby ticketu
[#326 „MCP: research — serwer MCP dla Laravela i klientów organizatora"](https://github.com/dawer2253/sports-tournament-app/issues/326),
część mapy [„Mapa: serwer MCP do obsługi ligi przez organizatora"](https://github.com/dawer2253/sports-tournament-app/issues/320).
Fakty idą do grillingu [#327 „MCP: gdzie działa serwer i jak loguje się organizator"](https://github.com/dawer2253/sports-tournament-app/issues/327).
Data: 5 listopada 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Opcje są wypisane z
konsekwencjami. Moja rekomendacja stoi osobno, w oznaczonej sekcji 9, i można
ją pominąć.

## 0. Źródła i metoda

Wyłącznie pierwotne, odczytane 5 listopada 2026:

- **Specyfikacja MCP** — [Versioning](https://modelcontextprotocol.io/specification/versioning),
  [Key Changes 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/changelog),
  oraz dla rewizji 2025-11-25:
  [Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
  [Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization),
  [Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools),
  [Elicitation](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation),
  [schema.ts 2025-11-25](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2025-11-25/schema.ts) (`ToolAnnotations`).
- **laravel/mcp** — [dokumentacja Laravel 13.x „MCP"](https://laravel.com/docs/13.x/mcp),
  źródła w [github.com/laravel/mcp](https://github.com/laravel/mcp) (`composer.json`,
  `UPGRADE.md`, `src/Server/Registrar.php`,
  `src/Server/Http/Controllers/OAuthRegisterController.php`,
  `tests/Conformance/`), [releases](https://github.com/laravel/mcp/releases),
  Packagist.
- **laravel/passport** — [dokumentacja 13.x](https://laravel.com/docs/13.x/passport),
  `composer.json`, `routes/web.php` i `src/HasApiTokens.php` z gałęzi `13.x`;
  dla porównania `src/HasApiTokens.php` z `laravel/sanctum` 4.x.
- **TypeScript SDK** — [README](https://github.com/modelcontextprotocol/typescript-sdk),
  `npm view @modelcontextprotocol/sdk` i `npm view @modelcontextprotocol/server`.
- **Klienci Claude** — [Build an MCP server for Claude](https://claude.com/docs/connectors/building/index.md),
  [Authentication for connectors](https://claude.com/docs/connectors/building/authentication.md),
  [Add a connector that isn't in the directory](https://claude.com/docs/connectors/custom/add-unlisted.md),
  [Get started with connectors](https://claude.com/docs/connectors/getting-started.md),
  [Test your connector](https://claude.com/docs/connectors/building/testing.md),
  [Connector pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria.md),
  [Build a desktop extension with MCPB](https://claude.com/docs/connectors/building/mcpb.md),
  [MCPB MANIFEST.md](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md),
  [MCP tunnels](https://claude.com/docs/connectors/mcp-tunnels/overview.md),
  [Claude Code: MCP](https://code.claude.com/docs/en/mcp),
  [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers),
  [Getting started with local MCP servers on Claude Desktop](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop).

Twierdzenia o repo mają przy sobie polecenie, które je pokazuje (z katalogu
głównego repo). Niczego nie instalowałam i nie uruchamiałam serwera MCP —
wszystko poniżej to lektura dokumentacji i kodu źródłowego.

## 1. Streszczenie

- **Specyfikacja MCP ma dziś rewizję bieżącą `2026-07-28`**, bezstanową (bez
  `initialize` i bez `Mcp-Session-Id`). Starsza `2025-11-25` nadal krąży u
  klientów; dokumentacja Claude dla connectorów mówi o handshake'u `initialize`
  i o specyfikacjach autoryzacji 2025-03-26, 2025-06-18 i 2025-11-25. Obie
  biblioteki, które wchodzą w grę, obsługują obie ery.
- **`laravel/mcp` pasuje do Laravela 13** (`illuminate/*: ^13.0`, wydanie
  v1.1.2 z 26.10.2026), daje Streamable HTTP (`Mcp::web`) i lokalny stdio
  (`Mcp::local` → `php artisan mcp:start`), narzędzia/zasoby/prompty, adnotacje
  narzędzi jako atrybuty PHP i testy w Pest (`Server::tool(...)->assertOk()`).
  Autoryzacja: OAuth 2.1 przez Passport (`Mcp::oauthRoutes()` + `auth:api`)
  albo zwykły `auth:sanctum` z tokenem Bearer.
- **Passport obok dzisiejszego Sanctum nie jest bezkosztowy**: oba pakiety mają
  trait `HasApiTokens` z tymi samymi nazwami metod, a ekran zgody Passporta
  wymaga zalogowanej sesji `web` — backend dziś nie ma żadnej trasy logowania
  sesyjnego (oddaje wyłącznie JSON).
- **Lokalny proces stdio w TS** to `@modelcontextprotocol/server` (SDK v2,
  2.4.0) albo starsze `@modelcontextprotocol/sdk` (1.32.2). Organizator
  instaluje go jako rozszerzenie Claude Desktop (`.mcpb`, z polem na token
  oznaczonym `sensitive`) albo wpis w `claude_desktop_config.json` /
  `claude mcp add`. Token Sanctum idzie wtedy zmienną środowiskową — tak każe
  specyfikacja dla stdio.
- **claude.ai (web, mobile) i connectory w Claude Desktop łączą się z
  infrastruktury Anthropic**, więc serwer musi być osiągalny z publicznego
  internetu przez HTTPS. Logowanie per użytkownik: tylko OAuth (DCR albo CIMD,
  PKCE S256). Stały nagłówek z tokenem w claude.ai jest w becie i tylko dla
  części organizacji.
- **Claude Code łączy się sam, z maszyny użytkownika**: zdalny HTTP z
  `--header "Authorization: Bearer …"` albo stdio. To jedyny klient Claude,
  który bez #276 (publiczny HTTPS) dosięgnie Laravela na `localhost`.
- **„Wynik do akceptacji"**: specyfikacja zaleca człowieka w pętli i daje
  adnotacje `readOnlyHint`/`destructiveHint`, ale każe traktować je jako
  niezaufane wskazówki. Claude pokazuje prośbę o zgodę na wywołanie narzędzia
  (Allow once / Always allow; per narzędzie Always allow / Needs approval /
  Blocked). Elicitation istnieje w specyfikacji, Claude Code ją obsługuje, ale
  `laravel/mcp` ma testy zgodności elicitation (MRTR) na liście oczekiwanych
  porażek. Stan `draft` turnieju jest akceptacją niezależną od klienta.

## 2. Punkt startowy w repo

| Fakt | Polecenie |
|---|---|
| Laravel 13, PHP ^8.3 | `grep -n '"laravel/framework"\|"php"' backend/composer.json` → `"php": "^8.3"`, `"laravel/framework": "^13.17"` |
| Brak pakietu MCP i Passporta w backendzie | `grep -n "laravel/mcp\|passport" backend/composer.json` → nic |
| `laravel/boost` w dev (MCP dla deweloperów, nie organizatora) | `grep -n boost backend/composer.json` |
| Sanctum, token bez abilities | `grep -n createToken backend/app/Http/Controllers/Api/AuthController.php` → `createToken('api')` |
| User używa traitu Sanctum | `grep -n HasApiTokens backend/app/Models/User.php` → `use Laravel\Sanctum\HasApiTokens;` |
| Jedyny guard to `web` (sesja); Sanctum go sprawdza | `grep -n -A6 "'guards'" backend/config/auth.php`, `grep -n "'guard'" backend/config/sanctum.php` |
| `routes/web.php` oddaje tylko health check JSON, bez logowania sesyjnego | `cat backend/routes/web.php` |
| Prefiks `api/v1` z `bootstrap/app.php` | `grep -n apiPrefix backend/bootstrap/app.php` |
| Endpointy łańcucha z przykładu istnieją w kontrakcie | `grep -n "^  /tournaments:\|^  /tournaments/{tournament}/teams:\|^  /stages/{stage}/schedule" packages/api-contract/openapi.yaml` |
| Klient TS jest prywatny i konsumowany ze źródeł (`main: ./src/index.ts`), na `openapi-fetch` | `cat packages/api-client/package.json` |
| Stany turnieju | `grep -n "Stan turnieju" CONTEXT.md` → `draft`, `active`, `finished` |
| Brak środowiska z sieci | `gh issue view 276 --json state` → `OPEN` |

## 3. Co mówi specyfikacja MCP (to, co dotyczy decyzji)

### 3.1. Wersje

- „The **current** protocol version is **2026-07-28**" ([Versioning](https://modelcontextprotocol.io/specification/versioning)).
- Najważniejsze zmiany względem 2025-11-25 ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)):
  usunięte sesje i `Mcp-Session-Id`, usunięty handshake `initialize` (wersja i
  capabilities klienta w `_meta` każdego żądania), nowe obowiązkowe
  `server/discover`, wzorzec Multi Round-Trip Requests (`InputRequiredResult`)
  zamiast żądań inicjowanych przez serwer (w tym `elicitation/create`), Dynamic
  Client Registration oznaczony jako **Deprecated** na rzecz Client ID Metadata
  Documents, Sampling/Roots/Logging Deprecated.
- Wniosek praktyczny: serwer musi dziś obsłużyć oba typy klientów. Obie
  biblioteki z sekcji 4 i 5 to robią (szczegóły tam).

### 3.2. Transporty

- Dwa standardowe: **stdio** i **Streamable HTTP**; stary HTTP+SSE jest
  przestarzały ([Transports 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)).
- stdio: klient uruchamia serwer jako podproces; na `stdout` wolno pisać tylko
  wiadomości MCP, logi idą na `stderr`.
- Streamable HTTP: jeden endpoint (np. `https://example.com/mcp`); serwer
  **MUST** walidować nagłówek `Origin` (DNS rebinding), lokalnie **SHOULD**
  słuchać tylko na 127.0.0.1.

### 3.3. Autoryzacja

Z [Authorization 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization):

- „Authorization is **OPTIONAL**". HTTP **SHOULD** stosować tę specyfikację;
  stdio „**SHOULD NOT** follow this specification, and instead retrieve
  credentials from the environment".
- Przy HTTP: serwer MCP to zasób OAuth 2.1; **MUST** wystawić Protected
  Resource Metadata (RFC 9728, `/.well-known/oauth-protected-resource`) i
  odpowiadać `401` z `WWW-Authenticate`. Klient **MUST** robić PKCE S256 i
  wysyłać `resource` (RFC 8707). Serwer **MUST** sprawdzać, że token wydano dla
  niego, i **MUST NOT** przepuszczać tokenu dalej („token passthrough").
- Rejestracja klienta: CIMD **SHOULD**, DCR (RFC 7591) **MAY**,
  pre-rejestracja **SHOULD** jako opcja. W 2026-07-28 DCR jest Deprecated.
- Wszystkie endpointy serwera autoryzacji **MUST** iść po HTTPS, redirecty
  **MUST** być `localhost` albo HTTPS.

Uwaga o „token passthrough": dotyczy tokenu wydanego *serwerowi MCP*, który
ten przekazałby do innego API. W wariancie stdio (sekcja 5) token Sanctum nie
jest tokenem OAuth dla serwera MCP — proces lokalny po prostu używa go jako
klient REST. Nie znalazłam w specyfikacji zakazu takiego układu; nie jest on
też przez nią opisany.

### 3.4. Narzędzia: człowiek w pętli i adnotacje

Z [Tools 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools):

- „there **SHOULD** always be a human in the loop with the ability to deny
  tool invocations" — klient powinien pokazywać, które narzędzia są wystawione,
  sygnalizować wywołanie i pytać o potwierdzenie. Protokół nie narzuca UI.
- `ToolAnnotations` (z `schema.ts`): `title`, `readOnlyHint` (domyślnie
  false), `destructiveHint` (domyślnie true, ma sens tylko gdy nie read-only),
  `idempotentHint` (domyślnie false), `openWorldHint` (domyślnie true).
  Wszystkie to **wskazówki**; „clients **MUST** consider tool annotations to be
  untrusted unless they come from trusted servers".

### 3.5. Elicitation

Z [Elicitation 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation):

- Serwer prosi użytkownika o dane w trakcie operacji. Tryb `form` (płaski
  obiekt z prymitywami: string, number, boolean, enum) i tryb `url` (przejście
  na stronę poza klientem). Odpowiedź: `accept` / `decline` / `cancel`.
- Klient deklaruje capability `elicitation`; bez niej serwer nie może prosić.
  Formularzem **MUST NOT** zbierać haseł ani tokenów.
- W 2026-07-28 elicitation idzie przez MRTR: serwer zwraca
  `resultType: "input_required"`, klient ponawia żądanie z odpowiedziami.

## 4. Wariant A: zdalnie w Laravelu (`laravel/mcp`)

### 4.1. Zgodność i wersja

- `require` w `composer.json` pakietu: `"php": "^8.2"`,
  `"illuminate/*": "^11.45.3|^12.41.1|^13.0"`, `"illuminate/json-schema": "^12.41.1|^13.0"`.
  Z naszym `^13.17` i PHP `^8.3` się zgadza (nie instalowałam, więc nie
  sprawdziłam rozwiązywania zależności przez Composera).
- Packagist: v1.1.2 (2026-10-26), v1.1.1, v1.1.0 (2026-10-20). Seria 1.x od
  v1.0.0 (14.09).
- Protokół według `UPGRADE.md`: domyślnie 2026-07-28; klienci wysyłający
  `initialize` dostają 2025-11-25, 2025-06-18 albo 2025-03-26, zależnie od
  prośby. Release v1.0.0: „Serve legacy initialize clients alongside the modern
  protocol".

### 4.2. Transport i rejestracja

Z [dokumentacji](https://laravel.com/docs/13.x/mcp):

- `composer require laravel/mcp`, `php artisan vendor:publish --tag=ai-routes`
  tworzy `routes/ai.php`.
- `Mcp::web('/mcp/weather', WeatherServer::class)` — serwer HTTP (POST,
  strumień SSE przy odpowiedziach strumieniowych); da się dokleić middleware,
  np. `->middleware(['throttle:mcp'])`.
- `Mcp::local('weather', WeatherServer::class)` — serwer lokalny jako komenda
  Artisan (`mcp:start`). Dokumentacja nie używa słowa „stdio"; to jest proces,
  który klient uruchamia na swojej maszynie, czyli wymaga u organizatora PHP i
  dostępu do bazy. Dla organizatora nierealne, dla dewelopera przydatne.
- Generatory: `make:mcp-server`, `make:mcp-tool`, `make:mcp-resource`,
  `make:mcp-prompt`. Narzędzie ma `handle(Request $request): Response`,
  `schema(JsonSchema $schema)`, opcjonalnie `outputSchema()`,
  `shouldRegister()` i walidację przez `$request->validate([...])`.
- Adnotacje jako atrybuty: `#[IsReadOnly]`, `#[IsDestructive]`,
  `#[IsIdempotent]`, `#[IsOpenWorld]`, plus `#[Title]`.

### 4.3. Autoryzacja

Z dokumentacji i `src/Server/Registrar.php`:

- **OAuth 2.1 przez Passport**: `Mcp::oauthRoutes()` i `->middleware('auth:api')`
  na trasie `Mcp::web`. `oauthRoutes()` rejestruje
  `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`
  (z `code_challenge_methods_supported: ['S256']`, `scopes_supported: ['mcp:use']`)
  i `POST oauth/register` (DCR), który zakłada klienta Passporta. Metadane
  serwera autoryzacji **nie** ogłaszają `client_id_metadata_document_supported`
  — po stronie serwera pakiet daje więc DCR, nie CIMD (CIMD w `UPGRADE.md`
  dotyczy klienta MCP wbudowanego w pakiet, `Mcp::oAuthRoutesFor()`). DCR da się
  wyłączyć: `Mcp::oauthRoutes(registration: false)`.
- Dokumentacja: OAuth 2.1 „is the most widely supported among MCP clients" i
  zaleca Passport, gdy się da.
- **Sanctum**: `->middleware('auth:sanctum')` i nagłówek
  `Authorization: Bearer <token>`. Bez discovery OAuth — klient musi umieć
  wysłać stały nagłówek.
- Autoryzacja w narzędziu: `$request->user()->can(...)`, odmowa przez
  `Response::error(...)`. Nasze polityki (`can('manage', 'tournament')`) da się
  więc wołać z narzędzia — ale tylko gdy narzędzie woła domenę bezpośrednio, nie
  REST (patrz 4.6).

### 4.4. Passport obok Sanctum — co wiadomo

- `laravel/passport` 13.x: `"illuminate/*": "^11.35|^12.0|^13.0"`,
  `"league/oauth2-server": "^9.2"`; Packagist: v13.10.0 (2026-10-08).
  Instalacja: `php artisan install:api --passport`, guard `'api' => ['driver' => 'passport']`.
- **Konflikt traitów**: `Laravel\Passport\HasApiTokens` (13.x) i
  `Laravel\Sanctum\HasApiTokens` (4.x) definiują te same publiczne metody:
  `tokens`, `tokenCan`, `tokenCant`, `createToken`, `currentAccessToken`,
  `withAccessToken` (`grep -n "public function" src/HasApiTokens.php` w obu
  repo). Dwa traity na jednym modelu `User` wymagają w PHP rozwiązania
  konfliktu (`insteadof`/aliasy) albo osobnego modelu dla guardu `api`. Nie
  sprawdzałam, czy któryś z pakietów dokumentuje taki układ; dokumentacja
  Passporta przedstawia Sanctum jako alternatywę („Passport or Sanctum?"), nie
  jako sąsiada.
- **Ekran zgody wymaga sesji `web`**: w `routes/web.php` Passporta
  `POST /oauth/authorize` (zatwierdzenie) siedzi w
  `middleware(['web', 'auth'])`, a `AuthorizationController` dla gościa woła
  `promptForLogin`. Widok zgody ustawia `Passport::authorizationView(...)`
  (laravel/mcp publikuje własny: `vendor:publish --tag=mcp-views`). Nasz
  backend nie ma dziś trasy logowania sesyjnego (`cat backend/routes/web.php`),
  a panel loguje tokenem Bearer. OAuth oznacza więc dodatkowo stronę logowania
  serwowaną przez Laravela (Blade albo przekierowanie do panelu, który ustawi
  sesję) — to praca poza samym MCP.
- `/api/v1` z `auth:sanctum` nie musi się zmieniać: MCP siedzi w osobnym
  `routes/ai.php` z własnym middleware. Nie testowałam współistnienia.

### 4.5. Testy

- Pest wprost w dokumentacji: `WeatherServer::tool(CurrentWeatherTool::class, [...])->assertOk()->assertSee(...)`,
  `::actingAs($user)`, `assertHasErrors`, `assertName/Title/Description`,
  `assertSentNotification`.
- `php artisan mcp:inspector mcp/weather` uruchamia MCP Inspector.
- `UPGRADE.md`: żądania HTTP muszą mieć nagłówki `MCP-Protocol-Version` i
  `Mcp-Method` (przy 2026-07-28), więc testy wołające endpoint też.
- Repo pakietu ma suitę zgodności (`tests/Conformance/run.sh`) z plikiem
  `conformance-baseline.yml` podawanym jako `--expected-failures`. Na liście
  serwerowych oczekiwanych porażek są m.in. `input-required-result-basic-elicitation`
  i cała grupa `tasks-*`. Czytam to tak: serwer laravel/mcp **nie przechodzi
  dziś testów zgodności elicitation**; dokumentacja też nie opisuje API do
  elicitation. To wniosek z listy, nie z uruchomienia.

### 4.6. Otwarta konsekwencja dla kontraktu

Narzędzie w Laravelu może wołać domenę (akcje, polityki) bezpośrednio albo
HTTP-em własne `/api/v1`. Mapa #320 mówi: bezpośrednie wołanie domeny to
decyzja trudna do odwrócenia i dostaje ADR (ADR-0001 robi z `openapi.yaml`
jedyne źródło prawdy o API). Ten research jej nie rozstrzyga.

## 5. Wariant B: lokalnie u organizatora (stdio, TypeScript)

### 5.1. SDK

- [README](https://github.com/modelcontextprotocol/typescript-sdk): gałąź
  `main` to v2 (`@modelcontextprotocol/server`, `@modelcontextprotocol/client`),
  „implementing the 2026-07-28 MCP spec". v1 (`@modelcontextprotocol/sdk`) na
  gałęzi `v1.x` dostaje poprawki „for at least six months after the v2 release
  (2026-07-27)".
- npm: `@modelcontextprotocol/server` 2.4.0, `@modelcontextprotocol/sdk`
  1.32.2 (`engines: node >=18`).
- Przewodnik migracji v2 ma rozdział „Legacy clients" i mówi o negocjacji
  przez handshake `initialize` (najnowsza wspólna: 2025-11-25). Szczegółów
  rozdziału nie czytałam.
- Szkielet: `McpServer` + `StdioServerTransport` (`@modelcontextprotocol/server/stdio`),
  `server.registerTool(name, { description, inputSchema }, handler)`, schematy
  Zod v4 lub inne Standard Schema.

### 5.2. Jak wołałby REST

- `packages/api-client` to typowany klient na `openapi-fetch`, prywatny
  (`"private": true`) i konsumowany ze źródeł (`"main": "./src/index.ts"`).
  Paczka do dystrybucji (npm albo `.mcpb`) musiałaby go zbundlować — sam
  workspace się nie opublikuje. Kontrakt zostaje jedynym źródłem prawdy
  automatycznie, bo serwer stdio to kolejny klient REST.
- Uprawnienia egzekwuje backend tak jak dla panelu (`can('manage', ...)`).
- Serwer stdio potrzebuje adresu API i tokenu. Według specyfikacji
  poświadczenia stdio bierze się „from the environment".

### 5.3. Instalacja i token u organizatora

- **Claude Desktop, rozszerzenie `.mcpb`**
  ([MCPB](https://claude.com/docs/connectors/building/mcpb.md)): zip z serwerem
  i `manifest.json`, instalacja dwuklikiem lub przeciągnięciem; serwer działa
  lokalnie po stdio. Node.js jest wbudowany w Claude Desktop na macOS i
  Windows, więc organizator nie instaluje runtime'u. `user_config` generuje
  formularz ustawień; pole `"sensitive": true` jest maskowane, a
  [artykuł pomocy](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
  mówi, że Claude Desktop szyfruje je bezpiecznym magazynem systemu. Wartość
  trafia do serwera przez `"env": { "API_KEY": "${user_config.api_key}" }`.
  Narzędzie: `npm install -g @anthropic-ai/mcpb`, `mcpb init`, `mcpb pack`.
  Katalog Anthropic nie przyjmuje już samodzielnych MCPB — dystrybucja to plik
  od nas.
- **Claude Desktop, ręcznie**: `claude_desktop_config.json`
  (`%APPDATA%\Claude\claude_desktop_config.json` na Windows), wpis
  `mcpServers` z `command`, `args`, `env`
  ([Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)).
  Wymaga zainstalowanego Node.js i edycji JSON-a — dla organizatora
  nie-dewelopera to bariera.
- **Claude Code**: `claude mcp add --env API_TOKEN=... --transport stdio liga -- npx -y <paczka>`
  ([Claude Code: MCP](https://code.claude.com/docs/en/mcp)).
- Skąd organizator weźmie token: dziś token daje tylko `POST /login`
  (`createToken('api')`), bez nazwy widocznej dla użytkownika, bez abilities i
  bez ekranu do jego wydania/odwołania w panelu. Wariant B zakłada więc jakiś
  ekran „token dla agenta" albo wpisywanie e-maila i hasła w ustawieniach
  rozszerzenia (logowanie przez serwer stdio). Tego nie ma w kontrakcie.

### 5.4. Czego wariant B nie daje

- Działa tylko tam, gdzie klient uruchamia lokalne procesy: Claude Desktop i
  Claude Code. claude.ai w przeglądarce i aplikacja mobilna obsługują tylko
  connectory zdalne ([Get started with connectors](https://claude.com/docs/connectors/getting-started.md), „Where connectors work").
- Proces lokalny i tak potrzebuje osiągalnego API. Z Laravelem na
  `localhost` działa u dewelopera; u organizatora wymaga #276.

## 6. Klienci

| Klient | Transport | Autoryzacja | Skąd łączy się z serwerem |
|---|---|---|---|
| **claude.ai (web)**, **mobile** | tylko zdalny: Streamable HTTP (i stary SSE) | OAuth: DCR lub CIMD (domyślnie), własny client ID/secret; „No sign-in"; stały nagłówek w becie dla części organizacji | z infrastruktury Anthropic (egress `160.79.104.0/21`) |
| **Claude Desktop** | zdalne connectory jak claude.ai; lokalne stdio przez `.mcpb` lub `claude_desktop_config.json` | zdalne: jak claude.ai; lokalne: bez OAuth, sekrety w `user_config`/`env` | zdalne: z infrastruktury Anthropic; lokalne: proces na komputerze użytkownika |
| **Claude Code** | stdio, HTTP, SSE (przestarzały), WebSocket | OAuth (DCR domyślnie, wykrywa CIMD, `--client-id`/`--client-secret`), dowolne nagłówki (`--header "Authorization: Bearer …"`), `--env` dla stdio | z maszyny użytkownika |
| Inni (Cursor, VS Code, ChatGPT itd.) | — | — | **nie sprawdzałam** |

Szczegóły dla klientów hostowanych
([Authentication for connectors](https://claude.com/docs/connectors/building/authentication.md),
[Add a connector…](https://claude.com/docs/connectors/custom/add-unlisted.md)):

- Custom connector po URL-u: plany Free (jeden connector), Pro, Max, Ultra,
  Team, Enterprise. Na Team/Enterprise dodaje go Owner, członkowie łączą się
  własnym kontem.
- Adres: „the HTTPS address where the server accepts MCP requests". Serwer na
  maszynie dewelopera wymaga tunelu (Cloudflare Tunnel, ngrok) —
  [Test your connector](https://claude.com/docs/connectors/building/testing.md):
  „Claude reaches your server from Anthropic's infrastructure, so a server
  running on your machine needs a public URL".
- Wymagania OAuth: `401` z `WWW-Authenticate: Bearer resource_metadata=...`
  (Claude ignoruje ten nagłówek przy `200`), `resource` w metadanych równe URL-owi
  serwera, pierwszy wpis `authorization_servers` jest jedynym używanym, PKCE
  S256 ogłoszone w metadanych, callback `https://claude.ai/api/mcp/auth_callback`
  dla aplikacji hostowanych i loopback `http://localhost:<port>/callback` oraz
  `http://127.0.0.1:<port>/callback` (port dowolny) dla Claude Code, token
  endpoint przyjmujący `application/x-www-form-urlencoded`, odpowiedzi OAuth w
  10 s (odświeżanie 30 s), rotacja refresh tokenów dla klientów publicznych.
  CIMD Claude wybiera tylko, gdy metadane ogłaszają
  `client_id_metadata_document_supported: true` **i** `none` w
  `token_endpoint_auth_methods_supported`; inaczej DCR. `laravel/mcp`
  ogłasza `none` i `registration_endpoint`, ale nie CIMD — więc Claude
  użyje DCR (wniosek z porównania dwóch źródeł, nie z próby).
- Stały token: „Request headers" w dialogu dodawania connectora — „in beta and
  available to a limited set of organizations"; token jest wspólny dla całej
  organizacji, „don't use it to identify which user is calling".
- Funkcje: narzędzia, prompty, zasoby, wyniki tekstowe i obrazkowe. Nie
  obsługiwane: subskrypcje zasobów, sampling, „advanced or draft capabilities".
  Elicitation w claude.ai nie jest wymieniona ani jako obsługiwana, ani jako nie
  — **nie ustaliłam**. Limity: wynik narzędzia ok. 150 000 znaków, 240 s na
  wywołanie (Claude Code: 25 000 tokenów, konfigurowalne).
- MCP tunnels (serwer w sieci prywatnej bez publicznego adresu): research
  preview, tylko plan Enterprise na prośbę — nie dotyczy naszego organizatora.

## 7. „Wynik do akceptacji" — na czym można to oprzeć

1. **Zgoda klienta na wywołanie narzędzia.** claude.ai/Desktop: „Claude can ask
   for your approval before it uses one of the connector's tools" — **Allow
   once** / **Always allow**; per narzędzie **Always allow** / **Needs approval**
   / **Blocked**. Checklist katalogu: adnotacje „determine auto-permissions in
   Claude. Read-only tools can run without per-call confirmation, and
   destructive tools always prompt" (to zdanie z wymagań dla katalogu; nie
   sprawdzałam, czy custom connector zachowuje się identycznie). Claude Code:
   `readOnlyHint` pozwala równoległe wywołania; `_meta["anthropic/requiresUserInteraction"]: true`
   wymusza prompt przy każdym wywołaniu, nawet w trybach auto. Ograniczenie:
   zgoda dotyczy pojedynczego wywołania z argumentami, nie efektu całego
   łańcucha (turniej → drużyny → terminarz), i użytkownik może ją wyłączyć
   przez „Always allow".
2. **Adnotacje** (`readOnlyHint`, `destructiveHint`, `idempotentHint`) — w
   `laravel/mcp` jako atrybuty, w TS SDK w definicji narzędzia. Specyfikacja:
   wskazówki, niezaufane.
3. **Elicitation** — potwierdzenie formularzem z poziomu serwera (np. „Utworzyć
   8 drużyn i 28 meczów? tak/nie"). Claude Code deklaruje `form` i `url`.
   claude.ai — nie ustaliłam. `laravel/mcp` — testy zgodności elicitation na
   liście oczekiwanych porażek, brak API w dokumentacji. TS SDK v2 implementuje
   2026-07-28 (MRTR), nie sprawdzałam API elicitation.
4. **Akceptacja w domenie, niezależna od klienta.** Turniej w stanie `draft`
   „nie istnieje publicznie" (`grep -n "Stan turnieju" CONTEXT.md`, mapa #320).
   Agent buduje szkic, organizator ogląda go (w czacie przez narzędzie
   read-only albo w panelu) i publikuje osobną akcją. To działa w każdym
   kliencie i nie wymaga elicitation; o tym, czy publikację robi agent czy
   tylko panel, decyduje grilling.

## 8. Co znaczy brak publicznego HTTPS (#276)

- **Wariant A + claude.ai/Desktop-connector**: nie zadziała bez publicznego
  HTTPS. Do prób: tunel na maszynę dewelopera. OAuth dodatkowo wymaga, by
  metadane serwera autoryzacji były osiągalne z egressu Anthropic.
- **Wariant A + Claude Code**: działa lokalnie dziś (`claude mcp add --transport http liga http://localhost/mcp --header "Authorization: Bearer …"`),
  bez OAuth i bez #276. To ścieżka do zbudowania i testowania narzędzi przed
  wdrożeniem. Nie sprawdzałam, czy Claude Code akceptuje `http://` bez TLS dla
  `localhost` — dokumentacja przykłady podaje z `https://`.
- **Wariant B**: proces lokalny działa od razu, ale organizator i tak potrzebuje
  osiągalnego API, więc u prawdziwego organizatora też czeka na #276.
- Wniosek, który nie jest wyborem: #276 blokuje *organizatora* w każdym
  wariancie; różnica jest w tym, czy dodatkowo potrzebny jest OAuth (A dla
  claude.ai), czy instalacja paczki (B).

## 9. Rekomendacja (opinia autorki, nie fakt; do odrzucenia w grillingu)

Zostawiam ją, bo ticket na to pozwala; decyzja należy do #327.

- **Kierunek: wariant A (`laravel/mcp`, `Mcp::web`)**, bo jako jedyny sięga do
  claude.ai, mobile i Desktopu bez instalacji czegokolwiek u organizatora, a
  Pest-owe testy narzędzi pasują do istniejącego backendu.
- **Logowanie etapami**: najpierw `auth:sanctum` z tokenem Bearer (Claude Code
  lokalnie, bez #276 — buduje się i testuje narzędzia), potem OAuth przez
  Passport, gdy będzie publiczny HTTPS. Etap OAuth warto rozpisać osobno, bo
  niesie dwie rzeczy spoza MCP: rozwiązanie kolizji `HasApiTokens` i stronę
  logowania sesyjnego dla ekranu zgody.
- **Akceptacja przez `draft`** (punkt 7.4) zamiast elicitation — elicitation
  ma dziś za słabe pokrycie po stronie `laravel/mcp` i nieustalone w claude.ai.
  Adnotacje i tak ustawić (`#[IsReadOnly]` na odczycie, `#[IsDestructive]` na
  usuwaniu).
- Kontrakt: w wariancie A narzędzia mogą wołać domenę wprost — wymaga to ADR-a
  (mapa #320); alternatywa to narzędzia wołające wewnętrznie te same akcje co
  kontrolery `/api/v1`.

## 10. Czego nie sprawdziłam

- Nie instalowałam `laravel/mcp` ani Passporta; zgodność z naszym
  `composer.lock` i współistnienie z Sanctum są wnioskiem z `composer.json` i
  kodu, nie z uruchomienia.
- Nie łączyłam żadnego klienta z serwerem.
- Klientów spoza Claude (Cursor, VS Code, ChatGPT i in.) nie badałam.
- Elicitation w claude.ai/Desktop: brak informacji w przeczytanych źródłach.
- Czy custom connector w claude.ai stosuje te same domyślne uprawnienia według
  adnotacji co connectory z katalogu.
- Szczegółów rozdziału „Legacy clients" w dokumentacji TS SDK v2 ani API
  elicitation w SDK v2.
