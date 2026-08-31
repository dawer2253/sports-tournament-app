# Backend: zapis instalacji szkieletu

Zapis historyczny z sierpnia 2026 — **co i jak powstało** przy zakładaniu
`backend/`. Kroki są już wykonane i zacommitowane, nie powtarzaj ich. Bieżąca
instrukcja uruchomienia: [`BACKEND.md`](BACKEND.md).

Maszyna: Windows 11 + Docker Desktop 29.7.2.

## Szkielet

```bash
curl -s "https://laravel.build/backend?with=mysql" | bash
```

Skrypt kończy się `sudo chown -R $USER: .`, więc **poza Linuksem/macOS przerwie
się na braku `sudo`** — właściwą pracę wykonuje wcześniej, w kontenerze
`laravelsail/php84-composer`. Na tej maszynie uruchomiono więc sam krok
kontenerowy, bez bloku `chown`.

Co z tego wyszło:

| Składnik | Wersja |
|---|---|
| `laravel/laravel` (szkielet) | v13.10.1 |
| `laravel/framework` | v13.29.0 |
| `laravel/sail` | v1.67.0 |
| Runtime PHP w kontenerze | 8.5 |
| MySQL | 8.4 |
| `laravel/pint` | v1.30.5 (w szkielecie) |

Plik Compose nazywa się `compose.yaml` (nie `docker-compose.yml`).

## Pest

Szkielet Laravela 13 przychodzi z PHPUnit-em, nie z Pestem — Pest dochodzi
osobno. Komenda `php artisan pest:install` **nie istnieje** w Pest 4:

```bash
composer require pestphp/pest pestphp/pest-plugin-laravel --dev --with-all-dependencies
./vendor/bin/pest --init
```

Testy funkcjonalne biegną na bazie `testing`, którą kontener MySQL zakłada sam
przy pierwszym starcie. `tests/Pest.php` włącza `RefreshDatabase`, więc zestaw
nie zależy od stanu bazy deweloperskiej.

## Zmiany w `compose.yaml`

Wygenerowany plik dostał kilka poprawek:

- `WWWUSER`/`WWWGROUP` mają domyślne `1000` — bez tego `docker compose`
  uruchomiony z pominięciem skryptu `sail` sypie ostrzeżeniami o pustych zmiennych,
- doszło `SUPERVISOR_PHP_USER: '${SUPERVISOR_PHP_USER:-sail}'`, żeby dało się
  przełączyć użytkownika procesu PHP z `.env` (patrz
  [`BACKEND.md`](BACKEND.md), sekcja o uprawnieniach na Windowsie),
- `depends_on: [mysql]` zamienione na `condition: service_healthy`. Krótka forma
  pilnuje tylko kolejności startu, więc `sail up -d` wracał, zanim MySQL
  przyjmował połączenia, a migracje zaraz po nim wywalały się na SQLSTATE,
- healthcheck MySQL-a dostał `start_period: 60s` (oraz `interval: 5s`,
  `retries: 10`). Domyślne trzy próby odmierzają się od sekundy zero, a pierwszy
  start inicjalizuje katalog danych — bez `start_period` kontener bywał uznany za
  niezdrowy, zanim wstał, co wywracało `condition: service_healthy`,
- wypadło mapowanie portu `${VITE_PORT:-5173}`. Backend nie ma frontu, a 5173
  zajmuje na hoście `apps/admin` — `make up` biłby się o port z `npm run dev:admin`.

## Usunięta warstwa Vite

Szkielet stawia w backendzie własny front: `package.json`, `vite.config.js`,
`resources/css`, `resources/js` i widok `welcome.blade.php` z dyrektywą `@vite`.
Wszystko to zostało usunięte, bo:

- front projektu to `apps/admin` i `apps/public`, poza Dockerem — backend oddaje
  wyłącznie JSON;
- `backend/` nie jest workspace'em npm (globy w rootowym `package.json` to
  `apps/*` i `packages/*`), a monorepo trzyma jeden `package-lock.json`
  w rootcie, więc to drzewo zależności nigdy by się nie zainstalowało;
- `@vite` bez zbudowanego manifestu rzuca `ViteManifestNotFoundException`,
  a `public/build/` jest w `.gitignore` — na czystym klonie strona główna
  zwracała **500**, co wywracało też smoke test.

`/` zwraca teraz `{"status":"ok"}`. Z `composer.json` wypadł skrypt `dev`
(`artisan dev` woła `npm run dev`) i dwa kroki npm ze skryptu `setup`.

## Laravel Boost

Nie instalowany w S0 — sprawdzona była tylko zgodność: `laravel/boost` v2.7.0
rozwiązuje się czysto na Laravelu 13 (`composer require --dry-run`). Decyzja #1
w [`PLAN.md`](PLAN.md). **Doinstalowany później**; jak jest wpięty i dlaczego
serwer MCP nie chodzi na Sailu, opisuje [`BACKEND.md`](BACKEND.md).

Jak instalator zachował się naprawdę (v2.7): `backend/AGENTS.md` zostawił
nietknięty, a do `backend/CLAUDE.md` **dopisał** swoje wytyczne pod nagłówkiem
repo, w bloku `<laravel-boost-guidelines>`. Nagłówka nie trzeba więc odtwarzać,
ale same wytyczne każą m.in. prefiksować komendy `vendor/bin/sail` i trzymać
ustalenia w `.ai/rules` — to przeczy repo, więc blok jest przycięty, a powody
stoją nad nim w tym samym pliku. Kolejne `boost:install` podmienia całą
zawartość między znacznikami, więc przycięcie trzeba będzie powtórzyć.
