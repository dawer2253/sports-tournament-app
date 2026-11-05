# Serwer MCP lokalnie, do nagrania demo: jak go wystawić i kto się połączy

Badanie na potrzeby ticketu
[#326 „MCP: research — serwer MCP dla Laravela i klientów organizatora"](https://github.com/dawer2253/sports-tournament-app/issues/326)
po zawężeniu zakresu z 5 listopada 2026: MCP służy **tylko do nagrania demo,
lokalnie** (decyzja #27, `grep -n "^| 27" docs/PLAN.md`). Fakty idą do grillingu
„MCP: lokalny serwer i klient do nagrania demo". Data: 5 listopada 2026.

Ta notatka **uzupełnia** wcześniejszą, szerszą notatkę
[`mcp-serwer.md`](mcp-serwer.md)
(commit `deb9ce8`). Części tamtej notatki o zdalnym serwerze, OAuth, Passporcie
i connectorach claude.ai są po zawężeniu nieaktualne. Tu jest wyłącznie wariant
lokalny, a kilka faktów jest nowych albo poprawionych (sekcja 2: w repo **już
leży** `laravel/mcp`, ale w wersji 0.9.4, nie 1.x).

**Ta notatka ustala fakty, nie wybiera za człowieka.** Opcje mają wypisane
konsekwencje; nie ma tu rekomendacji wariantu.

## 0. Pytanie

Jak lokalnie wystawić serwer MCP w tym stacku (Laravel 13 na Sailu + monorepo
TS) i którzy klienci się z nim połączą? Cztery wątki z ticketu:

1. endpoint w Laravelu (`laravel/mcp`): zgodność z Laravelem 13, transport na
   `localhost`, narzędzia/zasoby/prompty, testy w Pest, token Sanctum;
2. proces stdio w TS (`@modelcontextprotocol/*`) wołający REST przez
   `packages/api-client`;
3. klienci lokalni: Claude Code i Claude Desktop — transport i przekazanie tokenu;
4. potwierdzenia po stronie klienta i na czym oprzeć „wynik do akceptacji".

## 1. Krótka odpowiedź

- **Są trzy wykonalne lokalnie układy**, wszystkie bez publicznego adresu:
  - **L1: `Mcp::local` w Laravelu (stdio przez `docker compose exec -T`)** —
    dokładnie tak repo już uruchamia Laravel Boost (`cat .mcp.json`). Działa w
    Claude Code i (przez `claude_desktop_config.json`) w Claude Desktop. Brak
    HTTP, więc brak tokenu Sanctum; tożsamość organizatora trzeba ustawić inaczej
    (sekcja 3.3).
  - **L2: `Mcp::web` w Laravelu na `http://localhost:8000/...` z
    `auth:sanctum`** — Claude Code łączy się wprost z nagłówkiem
    `Authorization: Bearer …`. Claude Desktop **nie** połączy się z tym
    bezpośrednio: jego zdalne connectory łączą się z infrastruktury Anthropic
    (sekcja 5.2).
  - **L3: proces stdio w TS** na `@modelcontextprotocol/server` (v2) albo
    `@modelcontextprotocol/sdk` (v1), wołający `/api/v1` przez
    `createApiClient({ baseUrl, getToken })`; token Sanctum w zmiennej
    środowiskowej. Działa w Claude Code i Claude Desktop.
- **Wersja `laravel/mcp` to pierwsza rzecz do rozstrzygnięcia przy L1/L2**:
  w `composer.lock` leży v0.9.4 (dev, wciągnięta przez `laravel/boost` 2.7.0),
  która mówi tylko „starymi" rewizjami protokołu (z `initialize`). Aktualna
  v1.1.2 dokłada rewizję `2026-07-28`, ale wymaga podniesienia Boosta do ≥ 2.9.0.
- **Ani v0.9.4, ani v1.1.2 nie waliduje nagłówka `Origin`**, którego
  specyfikacja wymaga (MUST) dla Streamable HTTP — dotyczy L2.
- **„Wynik do akceptacji"**: specyfikacja zaleca człowieka w pętli; Claude Code
  i Claude Desktop pytają o zgodę na wywołanie narzędzia. Claude Code ma też
  `_meta["anthropic/requiresUserInteraction"]` (prompt przy każdym wywołaniu) i
  elicitation (`form`, `url`). `laravel/mcp` nie ma API do elicitation. Stan
  turnieju `draft` daje akceptację niezależną od klienta.

## 2. Punkt startowy w repo (odczytane)

| Fakt | Polecenie |
|---|---|
| Laravel 13, PHP ^8.3, Sanctum 4, Boost 2.7 w dev, Pest 4 | `grep -n '"laravel/framework"\|"php"\|sanctum\|boost\|pestphp/pest"' backend/composer.json` → `"php": "^8.3"`, `"laravel/framework": "^13.17"`, `"laravel/sanctum": "^4.0"`, `"laravel/boost": "^2.7"`, `"pestphp/pest": "^4.7"` |
| `laravel/mcp` **jest już zainstalowany**, v0.9.4, w `packages-dev` | `grep -n -A1 '"name": "laravel/mcp"' backend/composer.lock` → `"version": "v0.9.4"` (linia 7121); `grep -n '"packages-dev"' backend/composer.lock` → linia 6099, czyli wpis leży w sekcji dev |
| Wciąga go Boost z ograniczeniem bez 1.x | `grep -n '"name": "laravel/boost"' -A60 backend/composer.lock \| grep 'laravel/mcp'` → `"laravel/mcp": "^0.7.1\|^0.8.0\|^0.9.0"` (Boost v2.7.0) |
| Boost rejestruje się jako lokalny serwer MCP | `grep -n "Mcp::local" backend/vendor/laravel/boost/src/BoostServiceProvider.php` → `Mcp::local('laravel-boost', Boost::class);` (linia 60) |
| Precedens uruchomienia stdio przez Sail | `cat .mcp.json` → `"command": "docker"`, `"args": ["compose", "-f", "backend/compose.yaml", "--project-directory", "backend", "exec", "-T", "laravel.test", "php", "artisan", "boost:mcp"]`; wprowadził go `424f0bf Backend: Laravel Boost z konfiguracją MCP pod Compose` (`git log --oneline -- .mcp.json`) |
| Laravel lokalnie na porcie 8000, mapowanie portu bez adresu IP | `grep -n "APP_URL\|APP_PORT" backend/.env.example` → `APP_URL=http://localhost:8000`, `APP_PORT=8000`; `grep -n ports -A1 backend/compose.yaml` → `'${APP_PORT:-80}:80'` |
| Token Sanctum wydaje `POST /login`, bez nazwy i abilities | `grep -n createToken backend/app/Http/Controllers/Api/AuthController.php` → `$user->createToken('api')->plainTextToken` (linia 62) |
| Brak `routes/ai.php` | `ls backend/routes` → `api.php console.php web.php` |
| Klient TS: `createApiClient({ baseUrl, getToken, onUnauthenticated })`, ze źródeł `.ts` | `grep -n "export function createApiClient\|getToken" packages/api-client/src/index.ts`; `grep -n '"main"\|"private"' packages/api-client/package.json` → `"private": true`, `"main": "./src/index.ts"` |
| Node w repo | `cat .nvmrc` → `24` |
| Stany turnieju | `grep -n "Stan turnieju" CONTEXT.md` → `szkic (draft), trwający (active), zakończony (finished)` (linia 28) |

Obserwacja z tej sesji, nie twierdzenie o repo: serwer `laravel-boost` z
`.mcp.json` nie połączył się w mojej sesji Claude Code (`CONNECTION_CLOSED`).
Przyczyny nie sprawdzałam; najprostsze wyjaśnienie to niestojący kontener Saila,
bo `docker compose exec` wymaga działającego `laravel.test`. Dotyczy to też L1:
**nagranie wymaga stojącego Saila przed startem klienta.**

## 3. Endpoint w Laravelu: `laravel/mcp`

### 3.1. Zgodność i wersja

- Wersja w repo, v0.9.4 (2026-08-13): `require` m.in.
  `"illuminate/*": "^11.45.3|^12.41.1|^13.0"`, `"php": "^8.2"`
  (`sed -n 7120,7150p backend/composer.lock`). Zgodna z Laravelem 13.
- Protokół v0.9.4: tylko `2025-11-25`, `2025-06-18`, `2025-03-26`
  (`backend/vendor/laravel/mcp/src/Enums/ProtocolVersion.php:9-11`), handshake
  `initialize` (`backend/vendor/laravel/mcp/src/Server/Methods/Initialize.php`),
  nagłówek `MCP-Session-Id` (`backend/vendor/laravel/mcp/src/Server/Registrar.php`, metoda `web`).
- Najnowsza wersja na Packagist: **v1.1.2 (2026-10-26)**; seria 1.x od v1.0.0
  (2026-09-14) ([repo.packagist.org/p2/laravel/mcp.json](https://repo.packagist.org/p2/laravel/mcp.json)).
  `require` v1.1.2: `"illuminate/*": "^11.45.3|^12.41.1|^13.0"`, `"php": "^8.2"`
  (ten sam plik).
- v1.1.2 mówi domyślnie `2026-07-28`, a klientom wysyłającym `initialize`
  odpowiada `2025-11-25`/`2025-06-18`/`2025-03-26`
  ([`UPGRADE.md` v1.1.2](https://github.com/laravel/mcp/blob/v1.1.2/UPGRADE.md),
  [`src/Enums/ProtocolVersion.php` v1.1.2](https://github.com/laravel/mcp/blob/v1.1.2/src/Enums/ProtocolVersion.php)).
- **Podniesienie do 1.x wymaga podniesienia Boosta**: Boost do v2.8.1 dopuszcza
  `laravel/mcp: ^0.7.1|^0.8.0|^0.9.0`, od **v2.9.0** (2026-09-14)
  `^0.7.1|^0.8.0|^0.9.0|^1.0`; najnowszy Boost to v2.10.4
  ([repo.packagist.org/p2/laravel/boost.json](https://repo.packagist.org/p2/laravel/boost.json)).
  Nie uruchamiałam `composer require`, więc nie sprawdziłam, czy rozwiązanie
  zależności przejdzie bez innych konfliktów.
- `laravel/mcp` leży dziś w `packages-dev`. Do lokalnego demo to wystarcza;
  jeśli serwer MCP ma być częścią aplikacji, pakiet trzeba przenieść do
  `require` (wniosek, nie sprawdzałam wymagań projektu wobec `--no-dev`).

Co zmienia wybór wersji dla demo: Claude Code mówi rewizją `2026-07-28` i
starszymi (sekcja 5.1 — Claude Code deklaruje różne capabilities „on
connections that use protocol revision 2026-07-28" i „on the earlier protocol
revisions"), więc oba warianty powinny się z nim dogadać. Nie łączyłam
klienta z żadną z wersji.

### 3.2. Rejestracja i transport

Z [dokumentacji Laravel 13.x „MCP"](https://laravel.com/docs/13.x/mcp):

- `php artisan vendor:publish --tag=ai-routes` tworzy `routes/ai.php`.
- `Mcp::web('/mcp/weather', WeatherServer::class)` — serwer HTTP (POST);
  `Mcp::local('weather', WeatherServer::class)` — serwer jako komenda Artisan,
  „perfect for building local AI assistant integrations like Laravel Boost".
  Komendy `mcp:start` nie uruchamia się ręcznie; „configure your MCP client
  (AI agent) to start the server".
- Kod: `Mcp::local` uruchamia serwer z `StdioTransport`, który czyta
  `STDIN` linia po linii i pisze do `STDOUT`
  (`backend/vendor/laravel/mcp/src/Server/Transport/StdioTransport.php:27-47`);
  `mcp:start {handle}` szuka serwera zarejestrowanego przez `Mcp::local`
  (`backend/vendor/laravel/mcp/src/Console/Commands/StartCommand.php`).
- Generatory: `make:mcp-server`, `make:mcp-tool`, `make:mcp-resource`,
  `make:mcp-prompt` (`ls backend/vendor/laravel/mcp/src/Console/Commands`).
- Narzędzia, zasoby (także szablony URI) i prompty są w dokumentacji, każde
  rejestrowane w klasie serwera (`$tools`, `$resources`, `$prompts`).

### 3.3. Logowanie i tożsamość organizatora

- **HTTP (`Mcp::web`) z Sanctum** — dokumentacja: „simply add Sanctum's
  authentication middleware … ensure your MCP clients provide an
  `Authorization: Bearer <token>` header":
  `Mcp::web('/mcp/demo', …)->middleware('auth:sanctum')`
  ([docs, Sanctum](https://laravel.com/docs/13.x/mcp#sanctum)). Token z
  `POST /login` pasuje bez zmian w kontrakcie.
- W narzędziu: `$request->user()->can(...)`, odmowa przez
  `Response::error('Permission denied.')` ([docs, Authorization](https://laravel.com/docs/13.x/mcp#authorization)).
- `Laravel\Mcp\Request::user()` woła `auth`-owy `userResolver`
  ([`src/Request.php:91-96` v1.1.2](https://github.com/laravel/mcp/blob/v1.1.2/src/Request.php)).
  **Wniosek (nie sprawdzony uruchomieniem):** w `Mcp::local` (proces Artisan, bez
  żądania HTTP) nic nie uwierzytelnia użytkownika, więc `$request->user()` zwróci
  `null`, dopóki aplikacja sama go nie ustawi (np. z identyfikatora w zmiennej
  środowiskowej). Specyfikacja dla stdio mówi właśnie to: „Implementations using
  an STDIO transport SHOULD NOT follow this specification, and instead retrieve
  credentials from the environment"
  ([Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)).
  Dokumentacja `laravel/mcp` nie opisuje uwierzytelniania serwerów lokalnych —
  nie znalazłam takiej sekcji.
- Konsekwencja architektoniczna (z mapy #320, nie z tego researchu): narzędzie
  w Laravelu wołające domenę wprost omija `/api/v1`, a ADR-0001 robi z
  `openapi.yaml` jedyne źródło prawdy o API. L1 i L2 tego nie wymuszają —
  narzędzie może wołać te same akcje co kontrolery — ale to decyzja do grillingu.

### 3.4. Bezpieczeństwo HTTP na `localhost` (dotyczy L2)

- Specyfikacja, Streamable HTTP: „Servers **MUST** validate the `Origin` header on
  all incoming connections to prevent DNS rebinding attacks"; „When running
  locally, servers **SHOULD** bind only to localhost (127.0.0.1)"; „Servers
  **SHOULD** implement proper authentication"
  ([Streamable HTTP 2026-07-28, Security & Endpoint](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)).
- `laravel/mcp` **nie waliduje `Origin`**: trasa `Mcp::web` dostaje tylko
  `ReorderJsonAccept`, `ValidateMcpHeaders` i `AddWwwAuthenticateHeader`
  ([`src/Server/Registrar.php:42-63` v1.1.2](https://github.com/laravel/mcp/blob/v1.1.2/src/Server/Registrar.php));
  katalog `src/Server/Middleware` w v1.1.2 ma tylko te i
  `AddAuthorizationFramingHeaders` (`gh api "repos/laravel/mcp/contents/src/Server/Middleware?ref=v1.1.2" --jq '.[].name'`);
  w v0.9.4 w `src` nie ma żadnego sprawdzenia `Origin` po stronie serwera
  (`grep -rn -i origin backend/vendor/laravel/mcp/src` → trafienia tylko w
  `src/Client/OAuth`). Suita zgodności pakietu ma test
  `dns-rebinding-protection` na liście oczekiwanych porażek
  ([`tests/Conformance/conformance-baseline.yml` v1.1.2](https://github.com/laravel/mcp/blob/v1.1.2/tests/Conformance/conformance-baseline.yml)).
- Port Saila jest mapowany jako `'${APP_PORT:-80}:80'` (`backend/compose.yaml:15`),
  bez adresu IP. Nie sprawdzałam w dokumentacji Dockera, na jakim interfejsie
  hosta to nasłuchuje, ani czy przypięcie do `127.0.0.1` psuje coś innego w repo.
- Wniosek: przy L2 `auth:sanctum` daje uwierzytelnienie, ale wymóg `Origin`
  trzeba by spełnić własnym middleware'em. Przy samym nagraniu demo to ryzyko
  lokalne, ale to luka względem MUST w specyfikacji.

### 3.5. Testy w Pest

Z [dokumentacji, Testing Servers](https://laravel.com/docs/13.x/mcp#testing-servers):

- `WeatherServer::tool(CurrentWeatherTool::class, [...])->assertOk()->assertSee(...)`;
  analogicznie `::prompt(...)`, `::resource(...)`.
- `WeatherServer::actingAs($user)->tool(...)` — działa niezależnie od transportu,
  więc testy narzędzi nie zależą od wyboru L1/L2. To samo jest w kodzie v0.9.4:
  `PendingTestResponse::tool()` i `::actingAs()`
  (`backend/vendor/laravel/mcp/src/Server/Testing/PendingTestResponse.php:39,141`).
- Asercje: `assertHasErrors`, `assertHasNoErrors`, `assertName`, `assertTitle`,
  `assertDescription`, `assertSentNotification`, `assertNotificationCount`.
- `php artisan mcp:inspector mcp/weather` (web) albo `php artisan mcp:inspector weather`
  (local) uruchamia MCP Inspector.
- v1.x: żądania HTTP do `Mcp::web` muszą mieć nagłówki `MCP-Protocol-Version`,
  `Mcp-Method` (i `Mcp-Name` dla `tools/call`) — dotyczy testów, które strzelają
  w endpoint przez `postJson`, nie testów przez `Server::tool(...)`
  ([`UPGRADE.md` v1.1.2, „MCP HTTP Headers"](https://github.com/laravel/mcp/blob/v1.1.2/UPGRADE.md)).

## 4. Proces stdio w TypeScript (L3)

- Specyfikacja stdio: klient uruchamia serwer jako podproces; na `stdout` wolno
  pisać wyłącznie wiadomości MCP, logi na `stderr`
  ([stdio 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)).
  Poświadczenia — ze środowiska (cytat w 3.3).
- SDK ([README](https://github.com/modelcontextprotocol/typescript-sdk)): v2 to
  `@modelcontextprotocol/server` / `@modelcontextprotocol/client`, „implementing
  the 2026-07-28 MCP spec"; v1 dostaje poprawki „for at least six months after
  the v2 release (2026-07-27)". Szkielet stdio: `McpServer` z
  `@modelcontextprotocol/server`, `StdioServerTransport` z
  `@modelcontextprotocol/server/stdio`, `server.registerTool(...)`.
- npm (`npm view <pakiet> version engines dependencies`):
  `@modelcontextprotocol/server` **2.4.0**, `engines.node >=20`, zależność
  `zod ^4.2.0`; `@modelcontextprotocol/sdk` **1.32.2**, `engines.node >=18`.
  Repo ma Node 24 (`.nvmrc`).
- README v2 nie wspomina obsługi klientów ze starym `initialize`. Nie
  sprawdzałam, czy serwer v2 obsłuży klienta mówiącego tylko `2025-11-25` —
  jeśli to istotne, bezpieczniejszy jest v1 albo sprawdzenie przewodnika migracji.
- Klient REST: `createApiClient({ baseUrl, getToken })` dokleja
  `Authorization: Bearer <token>` i `Accept: application/json` do każdego żądania
  (`packages/api-client/src/index.ts`, funkcja `createApiClient`). Proces stdio
  może więc wziąć `baseUrl` i token ze zmiennych środowiskowych i wołać te same
  endpointy co panel; kontrakt zostaje jedynym źródłem prawdy, a uprawnienia
  egzekwuje backend.
- `packages/api-client` eksportuje źródła `.ts` (`"main": "./src/index.ts"`).
  Proces Node musi je więc uruchomić przez loader TS albo bundler. Nie
  sprawdzałam, czy wbudowane w Node 24 usuwanie typów wystarczy dla tego
  pakietu w workspace.
- Token: dziś tylko `POST /login` (`createToken('api')`); w panelu nie ma ekranu
  wydania tokenu. Do demo token można wziąć z odpowiedzi `/login` i wpisać w
  konfigurację klienta (wniosek; nie ma tego w kontrakcie jako osobnej funkcji).

## 5. Klienci lokalni

### 5.1. Claude Code

Z [Claude Code: MCP](https://code.claude.com/docs/en/mcp):

- Transporty: HTTP („recommended option for connecting to remote MCP servers"),
  SSE (deprecated), stdio, WebSocket (przez `add-json`).
- HTTP z tokenem:
  `claude mcp add --transport http <name> <url> --header "Authorization: Bearer your-token"`.
- stdio ze zmienną: `claude mcp add --env KEY=... --transport stdio <name> -- <komenda>`;
  „Everything after `--` is passed to the server untouched."
- Zakresy: local (`~/.claude.json`), project (`.mcp.json` w repo, współdzielony),
  user. W `.mcp.json` działa rozwijanie `${VAR}` i `${VAR:-default}`, także w
  `headers` (`"Authorization": "Bearer ${API_KEY}"`) — token nie musi trafić do
  repo.
- Serwery z `.mcp.json` wymagają zgody: „Claude Code prompts for approval in
  interactive sessions before using project-scoped servers from `.mcp.json`
  files".
- Limity: ostrzeżenie powyżej 10 000 tokenów wyniku, domyślny limit 25 000
  (`MAX_MCP_OUTPUT_TOKENS`); `MCP_TIMEOUT` dla startu serwera.
- W dokumentacji nie znalazłam przykładu z `http://localhost` jako adresem
  serwera (jedyne `localhost` to callback OAuth). **Nie sprawdziłam**, czy Claude
  Code przyjmuje `http://` bez TLS dla `localhost` — to warunek L2.
- Dla L1 repo ma gotowy wzorzec w `.mcp.json` (sekcja 2); nowy serwer to drugi
  wpis z inną komendą Artisan (`php artisan mcp:start <handle>`).

### 5.2. Claude Desktop

- **Lokalne serwery stdio** przez `claude_desktop_config.json`
  (`%APPDATA%\Claude\claude_desktop_config.json` na Windows), wpis `mcpServers`
  z `command`, `args`, `env`; po zmianie pełny restart aplikacji; logi w
  `%APPDATA%\Claude\logs` (`mcp.log`, `mcp-server-NAZWA.log`)
  ([Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)).
  Ta strona każe mieć zainstalowany Node.js dla serwerów uruchamianych przez `npx`.
- **Rozszerzenie `.mcpb`**: „Claude Desktop includes a built-in Node.js
  environment"; pola `"sensitive": true` są szyfrowane w magazynie systemu
  („Credential Manager on Windows")
  ([artykuł pomocy](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)).
  W manifeście wartość z `user_config` trafia do serwera przez
  `"env": { "API_KEY": "${user_config.api_key}" }`; typy serwera: `node`,
  `python`, `binary`, `uv`
  ([MCPB MANIFEST.md](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md)).
  Do samego nagrania demo `.mcpb` nie jest potrzebny — wystarczy plik konfiguracyjny.
- **Zdalne connectory nie dosięgną `localhost`**: „Claude reaches your server
  from Anthropic's infrastructure, so a server running on your machine needs a
  public URL" (tunel)
  ([Test your connector](https://claude.com/docs/connectors/building/testing.md)).
  „Claude desktop app: remote connectors, plus local connectors installed as
  desktop extensions"
  ([Get started with connectors, „Where connectors work"](https://claude.com/docs/connectors/getting-started.md)).
  Czyli L2 w Claude Desktop odpada bez tunelu, a tunel to wystawienie do sieci,
  z którego decyzja #27 rezygnuje.
- **Nie ustaliłam**, czy `claude_desktop_config.json` przyjmuje wpis z `url`
  (serwer HTTP) zamiast `command` — przeczytane źródła pokazują wyłącznie
  `command`/`args`/`env`.
- L1 w Desktopie: komenda `docker` z argumentami jak w `.mcp.json`, ale ze
  ścieżkami bezwzględnymi („Make sure the file paths … are absolute and not
  relative" — ta sama strona). Nie sprawdzałam, czy Desktop na Windows znajdzie
  `docker` w `PATH`.

### 5.3. Zestawienie

| | Claude Code | Claude Desktop |
|---|---|---|
| L1: `Mcp::local` przez `docker compose exec -T` | tak (wzorzec w `.mcp.json`) | tak, przez `claude_desktop_config.json` (nie testowane) |
| L2: `Mcp::web` na `localhost` + Bearer | tak, `--header` (nie sprawdzone dla `http://`) | nie bez tunelu |
| L3: proces TS stdio + token w `env` | tak, `--env` | tak, `env` w configu albo `.mcpb` |
| Token Sanctum | L2: nagłówek; L3: zmienna; L1: nie dotyczy | L3: `env`/`user_config`; L1: nie dotyczy |

## 6. Potwierdzenia i „wynik do akceptacji"

1. **Specyfikacja**: „there **SHOULD** always be a human in the loop with the
   ability to deny tool invocations"; aplikacje SHOULD pokazywać wystawione
   narzędzia, sygnalizować wywołanie i „Present confirmation prompts"; „clients
   **MUST** consider tool annotations to be untrusted unless they come from
   trusted servers"
   ([Tools 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)).
2. **Claude Desktop**: zgoda na wywołanie — **Allow once** / **Always allow**;
   per narzędzie **Always allow** / **Needs approval** / **Blocked**
   ([Get started with connectors](https://claude.com/docs/connectors/getting-started.md));
   ta strona mówi o connectorach. Dla serwerów lokalnych:
   „All actions require your explicit approval before execution"
   ([Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)).
   Nie sprawdzałam, czy lokalne serwery mają te same trzy ustawienia per narzędzie.
3. **Claude Code**:
   - `_meta["anthropic/requiresUserInteraction"]: true` w wpisie `tools/list`
     wymusza prompt przy każdym wywołaniu, „even in `acceptEdits`, `auto`, and
     `bypassPermissions`", bez opcji „don't ask again"; reguły allow go nie
     omijają.
   - `readOnlyHint` — wywołania równoległe z innymi read-only;
     `idempotentHint`/`readOnlyHint` — Claude Code może ponowić wywołanie po
     zerwanym połączeniu.
   - Elicitation: dialog w terminalu, tryby `form` i `url`; Claude Code deklaruje
     `elicitation: {form: {}, url: {}}` na połączeniach `2026-07-28` oraz na
     starszych rewizjach do serwerów z własnej konfiguracji (od v2.1.287).
   ([Claude Code: MCP](https://code.claude.com/docs/en/mcp)).
4. **`laravel/mcp`**: adnotacje jako atrybuty `#[IsReadOnly]`, `#[IsDestructive]`,
   `#[IsIdempotent]`, `#[IsOpenWorld]` ([docs, Tool Annotations](https://laravel.com/docs/13.x/mcp#tool-annotations);
   w v0.9.4: `backend/vendor/laravel/mcp/src/Server/Tools/Annotations/`).
   **Elicitation brak**: w v0.9.4 `grep -rn -i elicit backend/vendor/laravel/mcp/src`
   nic nie zwraca; w v1.1.2 testy `input-required-result-basic-elicitation` i
   pokrewne są na liście oczekiwanych porażek (plik baseline jak w 3.4).
   Nie sprawdzałam, czy da się ustawić `_meta` wpisu narzędzia w `tools/list`
   (potrzebne do `anthropic/requiresUserInteraction`).
5. **Akceptacja w domenie**: turniej `draft` to szkic (`CONTEXT.md:28`). Agent
   może budować szkic, a organizator ogląda go i publikuje osobną akcją — działa
   w każdym kliencie i transporcie, bez elicitation. Czy publikację wykonuje
   narzędzie MCP czy tylko panel, to decyzja do grillingu.

## 7. Otwarte pytania i niepewności

- Nie instalowałam `laravel/mcp` 1.x ani nie podnosiłam Boosta; zgodność z
  `composer.lock` to wniosek z metadanych Packagist.
- Nie łączyłam żadnego klienta z żadnym serwerem; wszystko powyżej to lektura
  dokumentacji i kodu.
- Czy Claude Code przyjmuje `http://localhost` (bez TLS) jako adres serwera HTTP.
- Czy `claude_desktop_config.json` obsługuje serwery HTTP (`url`).
- Jak w `Mcp::local` ustawić zalogowanego użytkownika — dokumentacja milczy;
  wniosek o `null` z `Request::user()` nie jest sprawdzony uruchomieniem.
- Czy serwer TS SDK v2 obsłuży klientów ze starym `initialize`.
- Czy Node 24 uruchomi `packages/api-client` bez loadera TS.
- Na jakim interfejsie hosta nasłuchuje port Saila i czy da się go zawęzić do
  `127.0.0.1` bez skutków ubocznych.
- Przyczyna `CONNECTION_CLOSED` serwera `laravel-boost` w tej sesji.
- Klientów spoza Claude nie badałam (zakres ticketu: Claude Code i Desktop).
