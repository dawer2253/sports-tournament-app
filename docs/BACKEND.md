# Backend: pierwsze uruchomienie

Backend stoi w `backend/` — Laravel 13 na Sailu, z MySQL-em w kontenerze.
Ten dokument opisuje, jak podnieść go na czystym klonie.

> **Przetestowane** na Windows 11 + Docker Desktop 29.7.2 (sierpień 2026).
> Szkielet jest już zainstalowany i zacommitowany — tu opisujemy tylko
> uruchamianie. Zapis tego, co i jak powstało przy instalacji:
> [`BACKEND-INSTALACJA.md`](BACKEND-INSTALACJA.md).

## Wymagania

Tylko Docker. PHP, Composer i MySQL żyją w kontenerach i nie są instalowane na
hoście. Frontend zostaje poza Dockerem, na natywnym node.

**Windows: potrzebny WSL2.** Sail sam odmawia startu poza nim
(`Unsupported operating system [MINGW64_NT-...]`), więc `make` i `./vendor/bin/sail`
uruchamiaj z powłoki WSL2, nie z Git Basha ani PowerShella. `make` nie jest
częścią Windowsa — w WSL2 dochodzi przez `sudo apt install make`.

## Start środowiska

Na czystym klonie najpierw bootstrap, potem start:

```bash
make install   # tylko za pierwszym razem
make up
```

`vendor/` i `.env` nie są w repo, więc na świeżym klonie `./vendor/bin/sail`
jeszcze nie istnieje i żaden cel Saila nie ma czym zadziałać. `make install`
odtwarza jedno i drugie: kopiuje `.env.example`, uruchamia `composer install`
w kontenerze `laravelsail/php84-composer` (na hoście nie ma PHP) i generuje
`APP_KEY`. Cel jest plikowy, więc powtórne wywołanie nic nie robi, a `make up`
ma go w zależnościach — samo `make up` na czystym klonie też zadziała.

`make up` kończy się migracjami i nie jest to ozdobnik: sesje siedzą w bazie
(`SESSION_DRIVER=database`), a baza żyje w wolumenie Dockera, którego na czystym
klonie nie ma. Bez tabel aplikacja zwraca **500 na każdym żądaniu**. `migrate`
jest idempotentne, więc przy kolejnych `make up` tylko przelatuje.

Aplikacja odpowiada pod `http://localhost:8000` — `/` to health check zwracający
`{"status":"ok"}`. Backend oddaje wyłącznie JSON, bez warstwy widoków (szkieletowy
front na Vite został usunięty, patrz [`BACKEND-INSTALACJA.md`](BACKEND-INSTALACJA.md)).
Frontend celuje w `http://localhost:8000/api/v1`, patrz `.env.example`
w `apps/admin` i `apps/public`.

Sail domyślnie wystawia aplikację na porcie **80**, nie 8000. Port podnosi
`APP_PORT=8000` z `.env` — dlatego ta zmienna jest w `.env.example` i nie należy
jej usuwać, bo rozjedzie się z kontraktem.

Pozostałe cele wypisuje `make help` (opisy trzymają się komentarzy `##` przy
celach w [`Makefile`](../Makefile), więc lista nie rozjeżdża się z dokumentacją).
Wszystkie są cienkim opakowaniem na `./vendor/bin/sail`, który wymaga katalogu
roboczego `backend/` (czyta stamtąd `.env` i `compose.yaml`) — Makefile wchodzi
tam sam.

### Windows: uprawnienia do `storage/`

Jeżeli trzymasz repo na dysku Windows (`C:\...`) i sięgasz do niego przez Docker
Desktop, bind mount należy do roota (`uid=0` w opcjach montowania 9p). Kontenerowy
użytkownik `sail` nie zapisze wtedy `storage/`, Blade nie skompiluje widoków i
aplikacja zwraca **500** z komunikatem o `tempnam()`. Lekarstwo jest w
`.env.example` — odkomentuj:

```
SUPERVISOR_PHP_USER=root
```

Na macOS i Linuksie zostaw to zakomentowane: tam mount przejmuje UID hosta,
który zgadza się z `sail`. Problem znika też, gdy repo leży w systemie plików
WSL2 zamiast na `C:` — to zresztą wariant zalecany przez Laravela, bo jest
znacznie szybszy.

## Warstwa API i autoryzacja

Stoi. Endpointy `/register`, `/login`, `/logout` i `/me` są zaimplementowane,
autoryzacja to token Bearer wydawany przez Sanctuma. Instalacja jest już w repo,
poniższy opis jest po to, żeby wiadomo było, skąd wzięły się poszczególne
ustawienia.

Sanctuma instaluje **sama** komenda `php artisan install:api`: ciągnie pakiet,
publikuje migrację `personal_access_tokens` i `config/sanctum.php`, zakłada
`routes/api.php` i dopisuje `api:` w `bootstrap/app.php`. Osobne
`composer require laravel/sanctum` jest zbędne. Ręcznie zostaje tylko trait
`HasApiTokens` na modelu `User`. `config/auth.php` nie wymaga zmian, bo guard
`sanctum` rejestruje się sam.

`EnsureFrontendRequestsAreStateful` i `statefulApi()` **nas nie dotyczą**, to
tryb SPA na ciasteczkach. Pracujemy wyłącznie na tokenach.

Prefiks wersji ustawia `apiPrefix: 'api/v1'` w `withRouting()`
w `bootstrap/app.php`, bo `install:api` daje samo `api`, a kontrakt zakłada
`http://localhost:8000/api/v1`.

CORS jest zawężony do origins panelu (5173) i strony publicznej (5174);
lista siedzi w `config/cors.php`.

## Laravel Boost

Zainstalowany jako zależność deweloperska. Stan instalacji trzyma
`backend/boost.json`. Wytyczne dla agentów dopisuje do
[`backend/CLAUDE.md`](../backend/CLAUDE.md), pod nagłówkiem repo, nie zamiast
niego — i **są tam przycięte**, bo część z nich przeczy zasadom tego repo; co
wypadło i dlaczego, wypisuje [`backend/AGENTS.md`](../backend/AGENTS.md). Czego
pilnować przy kolejnej instalacji: [`BACKEND-INSTALACJA.md`](BACKEND-INSTALACJA.md).
Skille pisze do `backend/.claude/skills/`, czyli poza repo: są warsztatem
każdego z osobna, więc ta ścieżka jest w `.gitignore`
(patrz [`docs/AGENTS-SETUP.md`](AGENTS-SETUP.md)).

Konfiguracja serwera MCP leży w **`.mcp.json` w korzeniu monorepo**, nie
w `backend/`, bo stamtąd czytają ją narzędzia agentowe. Woła `docker compose`,
a nie `vendor/bin/sail`, którym instalator obdziela ten plik domyślnie:

```
docker compose -f backend/compose.yaml --project-directory backend exec -T laravel.test php artisan boost:mcp
```

Powód jest ten sam co przy `make`: Sail odmawia startu poza WSL2, a narzędzie
agentowe woła serwer MCP z powłoki, w której akurat chodzi — na Windowsie zwykle
spoza WSL2, gdzie domyślna komenda nie wystartowałaby wcale. `docker compose`
działa na każdym hoście, a `--project-directory backend` podstawia Sailowe
`.env`. Flaga `-T` jest konieczna: MCP rozmawia po stdio, a alokacja TTY
psułaby strumień. Kontenery muszą przy tym stać (`make up` albo
`docker compose up -d`) — `exec` sam ich nie podniesie.

## Zgodność z kontraktem

Kontrakt leży w [`packages/api-contract/openapi.yaml`](../packages/api-contract/openapi.yaml)
i jest jedynym źródłem prawdy o kształcie API. Backend nie definiuje kontraktu,
tylko dowodzi, że go spełnia.

Dowodzi tego Spectator, wpięty w testy Pest. Konfiguracja jest w
`config/spectator.php` i ma dwa miejsca, które łatwo przeoczyć:

- `base_path` wskazuje `../packages/api-contract`, czyli poza katalog backendu.
  Kontener tego katalogu **nie widziałby** z automatu, dlatego `compose.yaml`
  montuje go read-only pod `/var/www/packages/api-contract`. Bez tego wszystkie
  asercje padają na `Cannot resolve schema with missing or invalid spec`.
- `path_prefix` to `api/v1`. Ścieżki w kontrakcie są bez prefiksu (`/login`), bo
  prefiks siedzi w `servers[].url`, a Spectator `servers` w ogóle nie czyta:
  porównuje URI trasy Laravela z kluczami `paths` doklejonymi do `path_prefix`.
  Bez tego ustawienia każdy test kończy się
  `Path [POST /api/v1/login] not found in spec`. README pakietu obiecuje tu
  zmienną `SPECTATOR_PATH_PREFIX`, ale publikowany config jej nie czyta, więc
  `env()` jest dopisane u nas: zmienna działa, a wartość domyślna musi zgadzać
  się z `apiPrefix` w `bootstrap/app.php`. Szczegóły:
  [`docs/research/sanctum-spectator-prefiks-api.md`](research/sanctum-spectator-prefiks-api.md).

Każdy test funkcjonalny endpointu powinien kończyć się asercją zgodności:

```php
beforeEach(function () {
    Spectator::using('openapi.yaml');
});

it('zwraca listę turniejów zgodną z kontraktem', function () {
    actingAsOrganizer()
        ->getJson('/api/v1/tournaments')
        ->assertValidRequest()
        ->assertValidResponse(200);
});
```

`actingAsOrganizer()` (helper z `tests/Pest.php`) zakłada konto i wydaje mu
prawdziwy token, więc test idzie tą samą drogą co panel, a nie skrótem przez
`actingAs()`.

Jeżeli endpoint ma zwracać coś, czego nie ma w spec, **najpierw zmienia się spec**,
potem regeneruje klienta (`npm run contract:generate`) i dopiero wtedy pisze kod.
Odwrotna kolejność kończy się rozjazdem, przed którym cały ten mechanizm ma chronić.

## Wersja Laravela

Bierzemy **najnowszą**, czyli Laravel 13. `laravel.build` instaluje ją domyślnie,
więc nic nie przypinasz. Decyzja #1 w [`docs/PLAN.md`](PLAN.md) jest zaktualizowana
(pierwotnie planowano wersję 11).

**Laravel Boost działa na Laravelu 13**, ale nie jest zainstalowany — sprawdzenie
zgodności i ostrzeżenie przed `boost:install` opisuje
[`BACKEND-INSTALACJA.md`](BACKEND-INSTALACJA.md).
