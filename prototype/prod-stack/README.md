# Prototyp: prod-podobny stack lokalnie (#277)

**Prototyp jednorazowy.** Gałąź `prototype/prod-podobny-stack`, nie do `main`.
Odpowiada na pytanie z ticketu
[#277 „S6: prototyp prod-podobnego stacku lokalnie"](https://github.com/dawer2253/sports-tournament-app/issues/277):
czy całość (zbudowane fronty + PHP-FPM + serwer WWW + MySQL + trwałe uploady)
da się podnieść jednym poleceniem i czy działa end-to-end. Wynik idzie do
decyzji „S6: kształt wdrożenia" ([#278](https://github.com/dawer2253/sports-tournament-app/issues/278)).

## Topologia

Jeden origin, trzy kontenery:

```
przeglądarka :8080
      │
      ▼
  edge  (Caddy)                 ← na VPS tu wchodzi domena i TLS
      │ reverse_proxy
      ▼
  app   (nginx + php-fpm, supervisord)
      │  /              → zbudowana strona publiczna (apps/public)
      │  /admin/        → zbudowany panel (apps/admin, base=/admin/)
      │  /api/v1/…      → Laravel
      │  /storage/…     → uploady (storage/app/public przez storage:link)
      │  /up            → health Laravela
      ▼
  db    (MySQL 8.4)             ← bez portu na hoście
```

Wolumeny: `db-data` (baza), `storage-data` (uploady, framework/cache, sesje),
`caddy-data` (certyfikaty na VPS). Przeżywają `docker compose down` i restart;
`down -v` robi reset do zera.

## Uruchomienie

```bash
cd prototype/prod-stack
docker compose up -d --build     # jedno polecenie, pierwszy build ~2–4 min
./smoke.sh                       # dymny test end-to-end (curl + jq)
```

- Panel: <http://localhost:8080/admin/>
- Strona publiczna: <http://localhost:8080/>
- Konto z seeda: `dawid@example.com` / `tajnehaslo123`

Zatrzymanie: `docker compose down` (dane zostają) albo `down -v` (reset).
Port zmienia `EDGE_PORT`; wtedy `APP_URL` musi wskazać ten sam publiczny adres,
bo `HasLogo::logoUrl()` składa z niego URL uploadu.

## Co zostało sprawdzone (2026-10-18, Docker 29.8.1 / Compose v5.5.1)

- **Start od zera i jedno polecenie:** `docker compose down -v` →
  `docker compose up -d` → `/up` zdrowe, migracje i seed przeszły, konto
  z seeda loguje się, `GET /tournaments` zwraca cztery turnieje demo.
- **`./smoke.sh` przechodzi w całości:** `/up`, strona publiczna pod `/`, panel
  pod `/admin/`, deep linki `/admin/login` i `/t/liga-osiedlowa-2026`, logowanie
  tokenem, lista turniejów, publiczny turniej po slugu, upload logo i pobranie
  tego samego pliku z `/storage/`.
- **Przeglądarka:** strona publiczna renderuje turniej i logo; panel loguje się
  przez formularz i pokazuje cztery turnieje; odświeżenie
  `/admin/tournaments/1/teams` (deep link) działa, bo nginx podaje
  `admin/index.html`.
- **Trwałość uploadu:** po `docker compose restart` i po `down`/`up` ten sam
  `logoUrl` dalej zwraca 200 i identyczne bajty. Plik leży w wolumenie
  `storage-data`, nie w warstwie kontenera.
- **Adres API w buildzie:** w zbudowanych bundle'ach siedzi dosłownie
  ``baseUrl:`/api/v1` `` (sprawdzone `grep` w obrazie). To build-time, nie
  runtime — zmiana adresu wymaga przebudowania frontów.

## Jeden origin czy osobne? Co z tego wyszło

**Jedno origin po ścieżkach działa i zdejmuje CORS.** Cena: panel musi być
zbudowany z `--base=/admin/` (`vite build --base`) i router musi znać prefiks.
Jedyna zmiana w kodzie aplikacji na tej gałęzi to
[`apps/admin/src/main.tsx`](../../apps/admin/src/main.tsx):

```ts
createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })
```

Strona publiczna zostaje na `/` bez zmian. `VITE_API_URL=/api/v1` jest
względne, więc przeglądarka woła API z tego samego origin — `config/cors.php`
w ogóle nie bierze udziału.

Wariant „osobne origin/subdomeny" nie był uruchamiany. Z kodu wynika, że
kosztowałby: `VITE_API_URL` absolutny per aplikacja, wpis w `allowed_origins`
i osobne nazwy w Caddy (dwa certyfikaty albo wildcard), ale **zero zmian
w routerach i `base`**.

## Co trzeba zmienić względem dev-owego `backend/compose.yaml`

1. **Runtime produkcyjny zamiast Saila.** Obraz `php:8.5-fpm-alpine` +
   `nginx` + `supervisor`; `composer install --no-dev --optimize-autoloader`,
   bez montowania repo do kontenera. Sail zostaje dev-only.
2. **Dwa fronty budowane w obrazie.** `npm ci` + `vite build` w stage'u
   `node:24-alpine`; wynik kopiowany do obrazu. `VITE_API_URL` i
   `VITE_PUBLIC_URL` to build-argi (Vite wstawia je w czasie builda).
3. **Jedno origin wymaga `base` i `basename` w panelu.** Bez tego assetów
   i tras nie da się rozdzielić od strony publicznej (research §3.3 mówił to
   samo; prototyp potwierdza, że wystarczy jedna linia w routerze).
4. **CORS zbędny przy jednym origin.** Przy subdomenach wraca i wymaga
   produkcyjnych `allowed_origins`, nie lokalnych portów 5173/5174.
5. **Uploady na trwałym wolumenie.** `storage-data` montowany pod
   `/var/www/html/storage`; `artisan storage:link` w entrypoincie; bez tego
   każdy redeploy gubi logo i herby. Zdjęcie wolumenu = brak uploadów.
6. **`depends_on: service_healthy` nie wystarcza przy restarcie.** Działa przy
   tworzeniu kontenerów, ale `docker compose restart` podnosi bazę i aplikację
   równolegle — pierwsza wersja entrypointu wywaliła się na migracji i stack
   został bez aplikacji. Prototyp ma pętlę ponowień `migrate` (30 × 2 s)
   i `restart: unless-stopped`.
7. **`artisan optimize` wywala się na tym repo.** Woła `view:cache`, a backend
   nie ma `resources/views` (oddaje wyłącznie JSON). Prototyp robi
   `config:cache` + `route:cache`, bez `view:cache`.
8. **`php:8.5-fpm-alpine` ma już mbstring i OPcache.** `docker-php-ext-install
   mbstring opcache` kończy się błędem `modules/*`; dochodzą tylko
   `pdo_mysql`, `pcntl`, `bcmath`.
9. **`APP_URL` musi być publicznym adresem.** `logoUrl` składa się z
   `APP_URL + /storage/...`; zły `APP_URL` daje działający upload i martwy
   link w odpowiedzi API.
10. **Baza nie jest wystawiona na host.** `db` bez `ports`; aplikacja łączy się
    po nazwie serwisu. Na VPS nie trzeba forwardować 3306.
11. **Migracje i seed w entrypoincie są wygodą prototypu, nie wzorcem.**
    W produkcji to krok deployu (albo jednorazowy job), inaczej każdy restart
    kontenera dotyka bazy. Seeder demo jest idempotentny, więc restart nie
    duplikuje turniejów.
12. **Brak workera kolejki.** `QUEUE_CONNECTION=database`, ale w kodzie nie ma
    dziś jobów (`grep -rn "ShouldQueue" app` — brak trafień); przy pierwszym
    jobie dochodzi osobny proces `queue:work`.

## Sekrety i miejsce

**Sekrety konfiguracji produkcyjnej (3):**

| Sekret | Rola | Uwaga |
|---|---|---|
| `APP_KEY` | szyfrowanie/sesje Laravela | `php artisan key:generate --show`; strata klucza unieważnia sesje i dane szyfrowane |
| hasło użytkownika bazy | `DB_PASSWORD` | to samo trafia do `db` i `app` |
| hasło roota bazy | `MYSQL_ROOT_PASSWORD` | potrzebne tylko kontenerowi bazy |

Nic więcej: brak maila (kanał `log`/`stderr`), brak S3 (dysk `public`),
brak zewnętrznego cache/redis. Domyślne wartości w `compose.yaml` są **jawnie
deweloperskie**; na serwerze podaje się je z env/sekretów, nie z repo.
`APP_ENV=production`, `APP_DEBUG=false`, logi na `stderr` (`docker logs`).

**Miejsce (zmierzone `docker image inspect` / `docker system df`):**

| Element | Rozmiar |
|---|---|
| obraz `app` (Laravel + nginx + oba fronty) | 296 MB (`docker images`: 310 MB) |
| obraz `mysql:8.4` | 1,12 GB |
| obraz `caddy:2-alpine` | 93 MB |
| **razem obrazy runtime** | **~1,5 GB** |
| wolumen bazy po seedzie | 221,5 MB |
| wolumen `storage` (po jednym uploadcie) | ~3 kB |
| wolumen Caddy (lokalnie, bez certyfikatów) | ~142 B |

Na serwerze trzeba więc ~1,5 GB na obrazy + rosnący wolumen bazy + uploady
(limit pojedynczego logo to 2 MB, więc tysiąc plików to ~2 GB w najgorszym
przypadku). Obrazy build-time (`node:24-alpine`, `php:8.5-fpm-alpine`,
`composer:2`) są potrzebne tylko na maszynie/CI budującej obraz — nie na VPS.
Wolumen bazy rośnie z danymi; prototyp nie robi backupów, bo środowisko S6 ma
być showcase'em z możliwością resetu.

## Czego prototyp nie rozstrzyga

- **TLS lokalnie.** Caddy stoi na `:80` bez domeny. Na VPS ta sama konfiguracja
  dostaje nazwę domeny i robi HTTPS automatycznie (ports 80/443, DNS A/AAAA).
  Jeśli Laravel ma generować absolutne URL-e z nagłówków, trzeba ustawić
  `TrustProxies`/`X-Forwarded-Proto`; dziś `APP_URL` jawnie pokrywa `logoUrl`.
- **Wariant subdomen** — opisany wyżej z kodu, nieuruchomiony.
- **Deploy i rollback** (skrypt vs job w CI, skąd bierze się obraz, jak wraca
  poprzednia wersja) — to temat decyzji #278, nie prototypu.
- **Skalowanie i rozdzielenie nginx/php-fpm na osobne kontenery** — przy tym
  ruchu jeden kontener wystarcza, ale prototyp nie mierzył obciążenia.
- **Sprzątanie obrazu:** w środku są `tests/`, `AGENTS.md` i `composer.json`
  (49,5 MB całości). Nie slimowano, bo to nie zmienia odpowiedzi na pytanie.

## Pliki

| Plik | Rola |
|---|---|
| `compose.yaml` | trzy serwisy, wolumeny, healthchecki, build-argi |
| `Dockerfile` | stage frontów (node) + obraz runtime (php-fpm + nginx) |
| `nginx.conf` | jeden origin: `/`, `/admin/`, `/api/`, `/storage/`, `/up` |
| `Caddyfile` | edge; lokalnie HTTP, na VPS domena + auto-TLS |
| `supervisord.conf` | php-fpm + nginx w jednym kontenerze |
| `entrypoint.sh` | katalogi, `storage:link`, migracje z ponowieniami, seed, cache |
| `smoke.sh` + `fixtures/logo.png` | powtarzalny test end-to-end |
| `../../apps/admin/src/main.tsx` | jedyna zmiana w kodzie aplikacji: `basename` routera |
