# Gdzie postawić Laravela 13 z dwiema SPA pod stałym publicznym adresem

Badanie na potrzeby ticketu
[#275 „S6: research — gdzie postawić Laravela z dwiema SPA pod stałym publicznym adresem"](https://github.com/dawer2253/sports-tournament-app/issues/275),
część mapy [„Mapa: S6 — stabilizacja (wdrożenie i domknięcie)"](https://github.com/dawer2253/sports-tournament-app/issues/274).
Data: 18 października 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Wybór dostawcy i kształtu
wdrożenia należy do grillingu „S6: kształt wdrożenia". Tam, gdzie fakty
otwierają kilka dróg, są wypisane jako opcje z konsekwencjami i bez wskazania
zwycięzcy.

## 0. Źródła i metoda

Wyłącznie pierwotne — strony dostawców i dokumentacja, odczytane 18 października
2026. Ceny to cenniki publiczne z tego dnia; dostawcy zmieniają je bez
zapowiedzi, więc liczba bez daty jest w tym pliku zawsze liczbą z 2026-10-18.

Ceny dostawców:

- Hetzner — [Hetzner Price Adjustment 15 June 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
  (tabele cen cloud w EUR/USD, bez VAT i bez IPv4). Strona
  `hetzner.com/cloud` renderuje ceny JS-em, więc użyta jest strona
  dokumentacji z pełnymi tabelami.
- DigitalOcean — [Droplets](https://www.digitalocean.com/pricing/droplets),
  [App Platform](https://www.digitalocean.com/pricing/app-platform),
  [Spaces](https://www.digitalocean.com/pricing/spaces-object-storage),
  [Managed Databases](https://www.digitalocean.com/pricing/managed-databases).
- Render — [cennik](https://render.com/pricing),
  [Deploy for Free](https://render.com/docs/free),
  [Disks](https://render.com/docs/disks),
  [Deploy MySQL](https://render.com/docs/deploy-mysql).
- Railway — [cennik](https://railway.com/pricing),
  [Volumes](https://docs.railway.com/reference/volumes),
  [Dockerfiles](https://docs.railway.com/guides/dockerfiles),
  [Docker Compose](https://docs.railway.com/guides/docker-compose).
- Fly.io — [Resource Pricing](https://fly.io/docs/about/pricing/),
  [Volumes](https://fly.io/docs/volumes/overview/).
- Laravel — [Laravel Cloud — cennik](https://cloud.laravel.com/pricing),
  [Forge — cennik](https://forge.laravel.com/pricing),
  [Deployment (13.x)](https://laravel.com/docs/13.x/deployment).
- OVHcloud (ceny w PLN) — [VPS](https://www.ovhcloud.com/pl/vps/).
- Mikrus — [cennik](https://mikr.us/), [Mikrus dla edukacji](https://edu.mikr.us).
- Heroku — [cennik](https://www.heroku.com/pricing),
  [Dynos](https://devcenter.heroku.com/articles/dynos).
- Koyeb — [cennik](https://www.koyeb.com/pricing).
- Darmowe plany i uczelniane — [Google Cloud Free Tier](https://cloud.google.com/free/docs/free-cloud-features),
  [Oracle Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm),
  [GitHub Student Developer Pack](https://education.github.com/pack),
  [Azure for Students](https://azure.microsoft.com/en-us/free/students/).
- Trwałość plików — [Cloudflare R2 — cennik](https://developers.cloudflare.com/r2/pricing/).

Dokumentacja techniczna:

- [Vite — Building for Production](https://vite.dev/guide/build)
  i [Shared Options: `base`](https://vite.dev/config/shared-options#base);
- [Caddy — Automatic HTTPS](https://caddyserver.com/docs/automatic-https).

**Nic nie zostało postawione ani uruchomione.** Żadnego serwera, kontenera ani
dostawcy nie provisionowano; każde zdanie o zachowaniu dostawcy to odczyt jego
cennika albo dokumentacji, nie pomiar. Nie budowano też obrazu produkcyjnego ani
nie mierzono czasu deployu. Fakty o repo w §2 pochodzą z poleceń podanych przy
każdym zdaniu, uruchomionych na `main` w commicie `c870eef`.

Strona Oracle (`oracle.com/cloud/free`) odpowiada na to narzędzie kodem 403
(blokada botów), więc fakty o Always Free pochodzą ze strony dokumentacji Oracle,
nie z marketingowej. Strona `hetzner.com/cloud` renderuje ceny po stronie
przeglądarki — stąd źródłem cen jest dokumentacja.

Waluty są różne i **nie przeliczano ich na jedną** (§10): Hetzner w EUR bez VAT,
OVHcloud i Mikrus w PLN (OVHcloud podaje netto i brutto, Mikrus tylko brutto),
reszta dostawców w USD. Gdzie cena jest niejasna, tak jest napisane.

## 1. Streszczenie: fakty w skrócie

- **W repo nie ma nic produkcyjnego.** Brak Dockerfile'a i brak joba deploy
  w CI (§2). Sail jest dev-only. Cokolwiek wybierzemy, obraz produkcyjny
  Laravela (nginx + php-fpm) i skrypt/job wdrożenia powstają od zera.
- **Gracz jest jeden, a nie trzy serwery.** To Laravel + MySQL + dwa *statyczne*
  bundle'y Reacta. Oba fronty po zbudowaniu to pliki, które wystarczy podać
  przez HTTP; nie potrzebują procesu ani Dockera. Cały „ciężar" wdrożenia to
  backend, baza i trwały dysk na uploady.
- **Trwałość uploadów to oś wyboru.** Backend trzyma logo i herby na dysku
  `public` (§2), więc platforma musi dać trwały wolumen albo pliki trzeba
  przenieść do magazynu obiektowego. PaaS-y z efemerycznym dyskiem bez
  wolumenu (Render Free, DO App Platform) tracą uploady przy każdym restarcie
  (§8.1).
- **Darmowy plan a własna domena i TLS to kolizja u Railway'a** — plan Free ma
  0 custom domains (§5.2), a wymaganie S6 mówi o stałym adresie z domeną.
- **MySQL 8 bywa nieobsługiwany zarządzalnie.** Render ma zarządzalnie tylko
  Postgres (MySQL tylko jako własny obraz Dockera + dysk), Fly.io w cenniku ma
  wyłącznie Managed Postgres. Laravel Cloud ma MySQL Flex w każdym planie.
- **Jedna maszyna za kilka euro miesięcznie wystarcza na ten ruch.** Hetzner
  CX23 (2 vCPU, 4 GB, 40 GB) to 5,49 €/mies. bez VAT i bez IPv4 (§4.1);
  DigitalOcean 2 GiB/2 vCPU/60 GiB to 18 $/mies. (§4.2); OVHcloud VPS-1
  (2 vCPU, 4 GB, 40 GB NVMe, własny IPv4, dzienny backup) to 16,32 PLN netto /
  20,07 PLN brutto (§4.4). Wszystkie wymagania
  (Docker, MySQL 8, trwały dysk, domena, TLS) spełnia goły VPS.
- **W darmowym PaaS-ie nie ma kompletnego zestawu.** Fly.io i Koyeb **nie mają
  planu darmowego**, Render Free usypia i gubi pliki, Railway Free nie przyjmuje
  własnej domeny, a Heroku nie ma ani darmowego dyno, ani MySQL (§5, §7).
- **PaaS kupuje mniej pracy za wyższą cenę i mniej kontroli.** Git push
  zamiast SSH, ale bez compose, z limitami rozmiaru wolumenu i bez
  zarządzalnego MySQL u części dostawców (§5).
- **Domena i TLS są rozwiązaniami po stronie konfiguracji, nie dostawcy:**
  Caddy robi HTTPS automatycznie, gdy DNS wskazuje na serwer, a porty 80/443
  są otwarte i data dir jest trwały (§3.4).

## 2. Punkt startowy: co dokładnie trzeba wdrożyć

Fakty o repo (komendy uruchomione na `main` w `c870eef`):

- **Brak obrazu produkcyjnego i brak wdrożenia w CI.**
  `find . -iname 'Dockerfile*' -not -path './node_modules/*' -not -path './backend/vendor/*'`
  nic nie zwraca, a `grep -rn "deploy" .github/workflows/*.yml` nic nie
  znajduje. Cała automatyzacja to `contract`, `frontend`, `backend`, `E2E`
  i `chromatic`.
- **Sail jest dev-only.** `backend/compose.yaml` to stos deweloperski:
  runtime PHP 8.5, `mysql:8.4`, wolumen `sail-mysql` i montaże kodu.
- **Obie SPA stoją na `/` i nie mają `base`.**
  `grep -n "base" apps/admin/vite.config.ts apps/public/vite.config.ts` —
  brak trafień. Zbudowany panel i strona publiczna zakładają korzeń origin.
- **Adres API wsiąka w build.** `apps/admin/.env.example` i
  `apps/public/.env.example` mają `VITE_API_URL`; Vite wstawia je w czasie
  `npm run build` (komentarz w `e2e/playwright.config.ts`). Adres API to
  decyzja build-time.
- **CORS przepuszcza tylko lokalny dev.**
  `grep -n "5173" backend/config/cors.php` → `http://localhost:5173`,
  `:5174` i warianty `127.0.0.1`; `paths` to `api/*`
  (`grep -n "paths" backend/config/cors.php`).
- **Uploady lądują na dysku `public`.** `grep -n "storage:link" Makefile`
  → `$(SAIL) artisan storage:link`; `backend/config/filesystems.php` ma
  domyślny dysk z `env('FILESYSTEM_DISK','local')`, dysk `public` o korzeniu
  `storage_path('app/public')` i `url` z `APP_URL`, a także gotowy wpis `s3`.
- **Magazyn S3 nie jest zainstalowany.** `backend/composer.json` nie ma
  `league/flysystem-aws-s3-v3` (brak trafienia), więc użycie dysku `s3`
  wymaga dołożenia zależności.
- **Rejestracja jest otwarta.** `sed -n '24p' backend/routes/api.php` →
  `Route::post('/register', [AuthController::class, 'register']);`.
- **Seed demo jest.** `ls backend/database/seeders` → `DatabaseSeeder.php`,
  `DemoTournamentSeeder.php` (cztery turnieje, idempotentny).
- **Suita E2E stawia Laravela osobno.** `e2e/playwright.config.ts` odpala
  backend skryptem `./scripts/backend.sh` na porcie 8001 i bazie `e2e`.
- **Testy:** 48 plików w `backend/tests/Feature`, 2 w `Unit`
  (`ls backend/tests/Feature | wc -l`). Żadnego przepływu przekrojowego
  „cały turniej".

Wniosek dla wdrożenia: do zbudowania są (a) obraz produkcyjny backendu,
(b) dwa statyczne bundle, (c) konfiguracja serwera/origin, (d) trwały dysk na
uploady, (e) MySQL 8 z seedem, (f) domena + TLS. Nic z tego nie istnieje dziś.

## 3. Kształt procesu: obraz, build SPA, jeden origin czy subdomeny

### 3.1. Obraz produkcyjny Laravela

Dokumentacja [Deployment (13.x)](https://laravel.com/docs/13.x/deployment)
opisuje standardowy stos nginx + php-fpm, `php artisan optimize`,
`config:cache`/`route:cache`/`view:cache`, `APP_DEBUG=false` w produkcji oraz
trasę zdrowia `/up`. Sail (`backend/compose.yaml`) do tego nie służy: to
środowisko deweloperskie z montowanym kodem.

Fakty o tym, co taki obraz musi pokryć (z §2): `storage:link` (bez dowiązania
`public/storage` uploady nie są podawane), katalog `storage/` zapisywalny,
`APP_KEY` i `APP_URL` z sekretów, migracje i seed przy pierwszym starcie.
W repo nie ma jeszcze Dockerfile'a, więc obraz jest do napisania niezależnie od
dostawcy.

### 3.2. Dwie SPA

Panel i strona publiczna budują się statycznie (`npm run build`,
`grep -n '"build"' package.json` → `npm run build --workspaces --if-present`).
Zbudowane pliki nie potrzebują procesu — potrzebują miejsca, z którego HTTP je
poda. Trzy drogi:

- **jedno nginx w obrazie backendu** podaje oba bundle i API z jednego origin —
  wtedy CORS staje się zbędny, ale trzeba rozdzielić dwa fronty po ścieżkach;
- **dwa origin/subdomeny** (np. `panel.` i `public.` obok `api.`) — każdy front
  na własnym `/`, ale wracają CORS i osobne certyfikaty/konfiguracje;
- **statyczny hosting obok** (np. Render Static Sites, DO App Platform static,
  CDN) dla frontów i osobny origin dla API — najbliżej „bez procesu", ale to
  znów osobne origin i CORS.

### 3.3. Pułapka `base`: oba fronty chcą `/`

Skoro żaden `vite.config.ts` nie ustawia `base` (§2), zbudowany bundle zakłada
korzeń origin. Podanie dwóch SPA pod jednym origin po ścieżkach (np. `/admin/`
i `/`) **wymaga** ustawienia `base` przynajmniej dla jednej z nich. Dokumentacja
Vite: [`base`](https://vite.dev/config/shared-options#base) ustawia publiczny
katalog bazowy, a `base: './'` daje ścieżki relatywne
([Building for Production](https://vite.dev/guide/build)). Bez tego jeden
z frontów będzie odwoływał się do assetów z korzenia drugiego.

Dwa origin (subdomeny) omijają problem, bo każdy front zostaje na swoim `/`.

### 3.4. Domena i TLS

Na własnym VPS TLS jest kwestią konfiguracji, nie dostawcy:
[Caddy](https://caddyserver.com/docs/automatic-https) wystawia i odnawia
certyfikaty (Let's Encrypt i ZeroSSL) automatycznie, o ile nazwa w DNS wskazuje
na serwer (A/AAAA), porty 80 i 443 są otwarte, a katalog danych Caddy jest
trwały (inaczej po restarcie traci certyfikaty). Na PaaS-ach TLS jest zwykle
wliczony w „custom domain" — ale sama domena zostaje po stronie użytkownika:
trzeba ją mieć i wskazać rekordem DNS. U Railway'a darmowy plan nie przyjmuje
własnej domeny w ogóle (§5.2).

## 4. Opcja: mały VPS z Dockerem

Wspólne cechy VPS: pełny root, więc **Docker i compose działają bez ograniczeń**;
MySQL 8 stawiasz sobie sam (obraz `mysql:8.4`) i **dysk jest trwały** dopóki
istnieje wolumen/maszyna; domena i TLS to Twoja konfiguracja (§3.4); deploy jest
ręczny (SSH/rsync/git pull), chyba że dopiszesz job w CI. Cała praca jest po
Twojej stronie — to jest koszt i zaleta tej opcji.

### 4.1. Hetzner Cloud

[Price Adjustment 15 June 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
podaje ceny cloud w EUR, **bez VAT i bez IPv4** (IPv4 jest osobną, płatną
pozycją). Lokacje
Niemcy (FSN/NBG) i Finlandia (HEL), ceny miesięczne / godzinowe:

| Typ | vCPU | RAM | Dysk | Cena od 15.06.2026 | Było |
|---|---|---|---|---|---|
| CX23 | 2 (shared) | 4 GB | 40 GB | **5,49 €** | 3,99 € |
| CX33 | 4 (shared) | 8 GB | 80 GB | 8,49 € | 6,49 € |
| CX43 | 8 (shared) | 16 GB | 160 GB | 15,99 € | 11,99 € |
| CAX11 (ARM) | 2 | 4 GB | 40 GB | **5,99 €** | 4,49 € |
| CPX22 | 2 (shared, x86) | 4 GB | 80 GB | **19,49 €** | 7,99 € |

Ceny wzrosły drastycznie 15 czerwca 2026 (np. CPX22 z 7,99 € na 19,49 €,
CCX13 z 15,99 € na 42,99 €) — dla tego projektu to bez znaczenia, bo wystarcza
najtańszy CX23/CAX11. Miesięczna cena jest tylko punktem odniesienia: Hetzner
liczy też godzinowo i bierze tańszą z dwóch kwot.

Dla S6: CX23 lub CAX11 z Dockerem i compose obsłuży Laravela, MySQL 8, obie SPA
i `storage:link` na jednym dysku. Dysk jest lokalny i trwały (dopóki maszyna
istnieje). Domena + TLS: Caddy (§3.4). Deploy: ręczny albo z CI przez SSH.

### 4.2. DigitalOcean Droplets

[Droplets](https://www.digitalocean.com/pricing/droplets), ceny miesięczne;
od 1 stycznia 2026 rozliczenie per-sekunda z minimum 60 s:

| Plan | vCPU | RAM | SSD | Transfer | Cena |
|---|---|---|---|---|---|
| Basic | 1 | 512 MiB | 10 GiB | 500 GiB | 4 $ |
| Basic | 1 | 1 GiB | 25 GiB | 1000 GiB | 6 $ |
| Basic | 1 | 2 GiB | 50 GiB | 2000 GiB | 12 $ |
| Basic | 2 | 2 GiB | 60 GiB | 3000 GiB | 18 $ |
| Basic | 2 | 4 GiB | 80 GiB | 4000 GiB | 24 $ |

Publiczny IPv4 jest wliczony w plany „bundled". Backup: 20 % (tygodniowy) lub
30 % (dzienny) ceny Dropleta; snapshoty 0,06 $/GB/mies. Reszta jak w §4: Docker
i compose bez ograniczeń, MySQL 8 samemu, dysk trwały, domena + TLS po Twojej
stronie.

### 4.3. VPS „za darmo": Oracle Always Free i Google Cloud Free Tier

- **Oracle Always Free** ([dokumentacja zasobów](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)):
  2 maszyny AMD `VM.Standard.E2.1.Micro` (1 GB RAM) albo instancja Ampere A1
  (do 2 OCPU / 12 GB w ramach darmowego przydziału), 200 GB block volume,
  20 GB object storage, 10 TB/mies. ruchu. Oracle może odebrać instancję
  bezczynną (95. percentyl CPU/sieci/pamięci poniżej 20 % przez 7 dni) — dla
  showcase'a, który stoi i nic nie robi, to realne ryzyko. Rejestracja wymaga
  karty. MySQL 8: instalujesz sam; MySQL HeatWave jest w Always Free jako osobna
  usługa (darmowy węzeł).
- **Google Cloud Free Tier** ([Free cloud features](https://cloud.google.com/free/docs/free-cloud-features)):
  jedna maszyna `e2-micro` miesięcznie w `us-west1`/`us-central1`/`us-east1`
  oraz 30 GB-mies. dysku standardowego i 1 GB ruchu wychodzącego. Mikro
  instancja (2 vCPU współdzielone, 1 GB) i lokalizacja tylko w USA — dla
  Laravela i MySQL to ciasno, ale formalnie wystarczy na demo.

Oba są „darmowe" w sensie braku opłaty, nie w sensie braku pracy: stawiasz
Dockera i compose sam, jak na każdym VPS.

### 4.4. Tanie VPS-y z cenami w PLN: OVHcloud i Mikrus

Dwie oferty, których ceny są podane i rozliczane w złotych — istotne, jeśli
płatność ma iść z polskiego konta i z fakturą. Oba dają root i trwały dysk, więc
mieszczą stos z §4.

**OVHcloud** ([VPS](https://www.ovhcloud.com/pl/vps/)), ceny miesięczne,
w nawiasie brutto (z polskim VAT). W cenie: codzienny backup z ostatnich 24 h,
**dedykowany adres IPv4** i nielimitowany transfer:

| Plan | vCPU | RAM | Dysk | Netto / mies. | Brutto / mies. |
|---|---|---|---|---|---|
| VPS-1 | 2 | 4 GB | 40 GB NVMe | 16,32 PLN | **20,07 PLN** |
| VPS-2 | 4 | 8 GB | 75 GB NVMe | 30,77 PLN | 37,85 PLN |
| VPS-3 | 6 | 12 GB | 100 GB NVMe | 44,37 PLN | 54,58 PLN |
| VPS-4 | 8 | 24 GB | 200 GB NVMe | 85,08 PLN | 104,65 PLN |

VPS-1 (2 vCPU, 4 GB, 40 GB) to najtańsza w tym badaniu maszyna z **własnym
IPv4** i rozliczeniem miesięcznym, a zasoby są porównywalne z Hetznerem CX23
i DigitalOcean 2 GiB z §4.1–4.2.

**Mikrus** ([cennik](https://mikr.us/)), polska firma, serwery w Helsinkach, ale
technicznie to **LXC, nie pełna wirtualizacja**: współdzielony publiczny IPv4
z **do 7 przekierowanymi portami TCP/UDP** plus własny IPv6, moc procesora
przydzielana dynamicznie i przycinana przy dłuższym obciążeniu („nie jest to moc
gwarantowana"), jedna opłata **roczna**, ceny brutto:

| Plan | RAM | Dysk | Cena / rok | Docker |
|---|---|---|---|---|
| Mikrus 1.0 | 384 MB | 5 GB | 35 PLN | nie |
| Mikrus 2.1 | 1 GB | 10 GB | 75 PLN | tak |
| Mikrus 3.0 | 2 GB | 25 GB | 130 PLN | tak |
| Mikrus 3.5 | 4 GB | 40 GB | 197 PLN | tak |
| Mikrus 4.1 | 8 GB | 80 GB | 395 PLN | tak |
| FROG | 256 MB | 3 GB | 0 PLN | tylko Alpine |

Roczne 130 zł za 2 GB / 25 GB (Mikrus 3.0) to ok. 11 zł/mies. — najniższa
w tym zestawieniu kwota za maszynę, która udźwignie cały stos (FROG jest
darmowy, ale 256 MB bez Dockera go nie uniesie). Dla S6 liczą się dwa haczyki:
brak własnego IPv4
(adres trzeba wyprowadzić przekierowaniem portów u Mikrusa albo przez
CloudFlare) i dynamiczna, niegwarantowana moc CPU. Laravel + MySQL + dwa fronty
na 1 GB (2.1) to dolna granica, bezpieczniej celować w 3.0.

## 5. Opcja: PaaS

PaaS-y zdejmują konfigurację serwera i dają deploy z gita, ale narzucają model
kontenera (zwykle jeden proces na usługę), mają limity trwałości i bywają
droższe przy stałym ruchu.

### 5.1. Render

[Cennik](https://render.com/pricing) i [Deploy for Free](https://render.com/docs/free):

- Plan workspace: **Hobby 0 $/mies. + compute**, Pro 25 $/mies. + compute.
- Compute web service: **Free 0 $** (512 MB RAM, 0,1 CPU), <1 CPU 7 $/mies.
  (512 MB), 1 CPU 25 $/mies. (2 GB).
- Wolne instancje: **750 godzin/mies. na workspace**, usługa **usypia po 15 min
  bez ruchu** (wybudzenie ~1 min), **efemeryczny dysk** — zmiany w systemie
  plików (uploady!) giną przy każdym redeployu, restarcie i uśpieniu. Free
  **nie może** mieć trwałego dysku ([Disks](https://render.com/docs/disks)).
- Trwały dysk: **0,25 $/GB/mies.** tylko na planach płatnych; dołączenie dysku
  **wyłącza zero-downtime deploy** ([Disks](https://render.com/docs/disks)).
- Baza: zarządzalny jest tylko **Postgres** (Free: 256 MB, **wygasa po 30
  dniach**; płatny 6 $/mies. wzwyż). **Zarządzalnego MySQL nie ma** — Render
  pokazuje własny obraz MySQL z wolumenem na `/var/lib/mysql`
  ([Deploy MySQL](https://render.com/docs/deploy-mysql)).
- Domena i TLS: 2 domeny w Hobby (potem 0,25 $/domena/mies.), **automatyczny
  TLS i wildcard wliczone**; pasmo 5 GB w Hobby, potem 0,15 $/GB.
- Docker: buduje z **Dockerfile**; **compose nie jest wspierany** — każdy
  proces to osobna usługa.

### 5.2. Railway

[Cennik](https://railway.com/pricing), rozliczenie per sekunda:

| Plan | Mies. | Wliczone | Max na usługę | Max wolumen | Własne domeny |
|---|---|---|---|---|---|
| Free Trial | 0 $ | 5 $ jednorazowo / 30 dni | 2 vCPU / 1 GB | 500 MB | 1 |
| **Free** | 0 $ | 1 $/mies. | 1 vCPU / 0,5 GB | **500 MB** | **0** |
| Hobby | 5 $ | 5 $/mies. | 48 vCPU / 48 GB | 5 GB | 2 |
| Pro | 20 $ | 20 $/mies. | 1000 vCPU / 1 TB | 1000 GB | 20 |

Stawki: pamięć 10 $/GB/mies., CPU 20 $/vCPU/mies., **wolumeny 0,15 $/GB/mies.**,
egress 0,05 $/GB, object storage 0,015 $/GB/mies. z darmowym egressem.
Dockerfile wykrywany automatycznie; **import Docker Compose jest wspierany**
(„nie każda konfiguracja", [docs](https://docs.railway.com/guides/docker-compose)).
MySQL: uruchamiasz obraz/template z wolumenem.

**Pułapka pod S6:** plan Free ma **0 własnych domen** i wolumen **do 500 MB** —
czyli bez Hobby (5 $/mies.) nie ma ani stałego adresu z TLS, ani sensownego
miejsca na uploady.

### 5.3. Fly.io

[Resource Pricing](https://fly.io/docs/about/pricing/):

- **Brak darmowego planu.** Nowe konta mają trial 2 h działania maszyny albo
  7 dni. Najtańsza stale włączona aplikacja: `shared-cpu-1x` 256 MB **2,19 $/30
  dni**, 512 MB 3,69 $, 1 GB 6,70 $.
- **Wolumeny 0,15 $/GB/mies.** ([Volumes](https://fly.io/docs/volumes/overview/));
  wolumen jest przypisany do jednej maszyny i regionu, bez replikacji między
  regionami. Snapshoty 0,08 $/GB/mies. (pierwsze 10 GB darmowe).
- Bazy: w cenniku jest wyłącznie **Managed Postgres** (od 38 $/mies.);
  **zarządzalnego MySQL nie ma** — MySQL trzeba postawić samemu jako maszynę
  z wolumenem.
- Domena i TLS: pierwsze 10 certyfikatów jednej nazwy darmowe, wildcard
  1 $/mies.; domena własna + rekordy DNS po Twojej stronie. Wspólny IPv4 i IPv6
  darmowe, dedykowany IPv4 2 $/mies.
- Egress: 0,02 $/GB w Ameryce Płn. i Europie, 0,04 $/GB w Azji/Pacyfiku.

### 5.4. DigitalOcean App Platform

[App Platform](https://www.digitalocean.com/pricing/app-platform):

- **Free tier 0 $** — ale **tylko statyczne strony** (3 aplikacje, 1 GiB ruchu);
  żadnego kontenera.
- Płatny kontener od 5 $/mies. (1 vCPU / 512 MiB / 50 GiB ruchu) do 50 $/mies.
  (2 vCPU / 4 GiB).
- **Brak trwałych dysków** — kontenery są efemeryczne; uploady nie przetrwają
  redeployu.
- Bazy: „development database" to **wyłącznie Postgres** (7 $/mies., 512 MiB,
  ginie razem z aplikacją). MySQL tylko jako osobny **Managed Database**
  (rozliczany osobno, [cennik](https://www.digitalocean.com/pricing/managed-databases)).
- Docker: buduje z **Dockerfile**; **compose nie** — jeden komponent = jeden
  kontener.
- Domena i TLS: własna domena i **automatyczny HTTPS wliczone** również w free.

### 5.5. Heroku i Koyeb: PaaS-y bez planu darmowego

- **Heroku** ([cennik](https://www.heroku.com/pricing)): najtańszy dyno to
  **Eco 5 $/mies.** (0,5 GB, **usypia po 30 min bezczynności**, tylko konta
  prywatne), stale włączony **Basic 7 $/mies.** Zarządzalne zasoby danych to
  **Postgres** (Essential-0 od 5 $/mies.), Key-Value Store i Kafka — ale
  **zarządzalnego MySQL nie ma**. System plików dyno jest **efemeryczny**: pliki znikają przy
  zatrzymaniu i restarcie, także automatycznym
  ([Dynos](https://devcenter.heroku.com/articles/dynos)). Domena i TLS są
  w cenie (custom domains + ACM). Czyli: płatne, a uploady i tak wymagają
  wolumenu albo magazynu obiektowego, którego Heroku nie oferuje.
- **Koyeb** ([cennik](https://www.koyeb.com/pricing)): **brak planu
  darmowego** — Pro 29 $/mies. + zużycie, Scale 299 $/mies.; darmowy jest
  jedynie serverless Postgres (5 h, 0,25 vCPU / 1 GB / 1 GB dysku). Wolumeny
  i snapshoty NVMe wchodzą od Pro. Zarządzalnego MySQL brak. Koyeb ogłosił
  dołączenie do Mistral AI 17 lutego 2026
  ([blog Koyeba](https://www.koyeb.com/blog/koyeb-is-joining-mistral-ai-to-build-the-future-of-ai-infrastructure)),
  co jest ryzykiem dla projektu, który ma stać kilka miesięcy.

## 6. Platformy pod Laravela wprost: Laravel Cloud i Forge

### 6.1. Laravel Cloud

[Cennik](https://cloud.laravel.com/pricing):

| Plan | Cena | Wliczone |
|---|---|---|
| Starter | **5 $/mies. + zużycie**, pierwszy miesiąc darmowy | 5 $ kredytu/mies., scale-to-zero, 10 domen, 1 dzień logów |
| Growth | 20 $/mies. + zużycie | Pro compute, autoskalowanie do 10×, 50 domen, 7 dni logów |
| Business | 200 $/mies. + zużycie | autoskalowanie bez limitu, 250 domen, 30 dni logów |

- **MySQL Flex jest w każdym planie** (obok serverless Postgresa i cache
  Valkey) — to jedyna badana platforma z zarządzalnym MySQL bez stawiania
  własnego obrazu.
- Compute Flex rozliczany za sekundę, z **scale-to-zero** („wybudzenie < 500 ms")
  i limitem wydatków: po przekroczeniu budżetu compute się zatrzymuje. Cennik
  podaje miesięczne pułapy: Flex 512 MiB 6 $/mies., 1 GiB 12 $, 2 GiB 24 $.
- Domena i TLS: własne domeny i SSL/TLS **wliczone**, 10 domen już w Starterze.
- Docker: to platforma zarządzana pod aplikację Laravela — nie wystawia
  własnego Dockerfile'a/compose; deploy idzie z repo (buildpack pod PHP).
- Konsekwencja dla dwóch SPA: to nadal jeden Laravel; obie SPA trzeba albo
  wbudować w obraz/asset pipeline, albo trzymać na osobnych origin (np.
  statyczne hostingi) — format „jeden Dockerfile z nginx podaje dwa fronty"
  tu nie pasuje.

### 6.2. Laravel Forge

[Cennik](https://forge.laravel.com/pricing): **Hobby 12 $/mies.**, Growth
19 $/mies., Business 39 $/mies. Forge to **warstwa zarządzania serwerem**, a nie
hosting: podłączasz własny VPS (DigitalOcean, Hetzner, AWS…) albo **Laravel VPS**
Forge. Koszt = subskrypcja Forge **plus** koszt serwera. Daje m.in. provisiong
serwera z nginx/PHP/MySQL/Redis, deploy z gita bez przestoju i zarządzanie
domeną/certyfikatami. Compose: Forge stawia stos PHP, a nie dowolny compose —
dwa fronty to raczej osobne „sites" albo wbudowanie w serwowany katalog.

To wariant „VPS + wygoda": płacisz ok. 12 $/mies. więcej niż goły VPS, żeby nie
konfigurować nginx/TLS/deployu ręcznie.

## 7. Darmowe plany i hosting uczelniany

- **Render Free** — realny darmowy Laravel (web service 512 MB), ale usypia po
  15 min, dysk efemeryczny, baza (tylko Postgres) wygasa po 30 dniach (§5.1).
  Do pokazania „działa", nie do stałego showcase'a z uploadami.
- **Railway Free** — 1 $/mies. kredytu, ale **0 własnych domen i wolumen 500 MB**
  (§5.2), co koliduje z wymaganiem stałego adresu.
- **Fly.io** — brak darmowego planu; tylko trial (§5.3).
- **DigitalOcean App Platform Free** — tylko statyki (§5.4); nie utrzyma
  Laravela.
- **Heroku** — brak planu darmowego; najtaniej Eco 5 $/mies., który usypia,
  a i tak gubi pliki (§5.5).
- **Koyeb** — brak planu darmowego (§5.5).
- **Google Cloud Free Tier** — darmowa `e2-micro` w USA i 30 GB dysku (§4.3);
  działający Laravel + MySQL na 1 GB to ciasno, ale możliwe.
- **Oracle Always Free** — najhojniejszy darmowy zestaw (do 2 OCPU / 12 GB ARM,
  200 GB dysku, 10 TB ruchu), ale groźba odebrania bezczynnej instancji (§4.3).
- **GitHub Student Developer Pack** ([pack](https://education.github.com/pack)):
  m.in. **Azure z 100 $ kredytu** (18+), domena `.me` na rok w Namecheap
  z certyfikatem SSL, GitHub Pro i **13 $/mies. kredytu na Heroku przez 24
  miesiące**. **Azure for Students**
  ([azure.microsoft.com/free/students](https://azure.microsoft.com/en-us/free/students/)):
  100 $ kredytu bez karty, 750 h maszyn B1s/B2pts/B2ats przez 12 miesięcy.
  To finansuje mały VPS/kontener na czas projektu inżynierskiego. Kredyt na
  Heroku pokrywa Eco/Basic, ale nie zmienia efemerycznego dysku ani braku MySQL
  (§5.5).
- **Hosting uczelniany** — nie badano konkretnej oferty żadnej uczelni; to
  zależne od jednostki i nie da się tego ustalić bez zapytania. Jedyny konkretny
  ślad to **Mikrus dla edukacji** ([edu.mikr.us](https://edu.mikr.us)), gdzie
  Mikrus udostępnia VPS-y polskim szkołom i uczelniom — nie sprawdzono jednak
  warunków (rozmiar, czas, kto musi wystąpić). Jeśli zespół ma taki zasób,
  traktuj go jak zwykły VPS z §4 (root, Docker, własna domena,
  niepewna trwałość i dostępność) — ale wszystkie te cechy trzeba potwierdzić
  u dostawcy, czego w tym badaniu nie zrobiono.

## 8. Pułapki przekrojowe

### 8.1. Efemeryczny dysk a uploady

Backend trzyma logo i herby na dysku `public` (§2). Na platformie bez trwałego
wolumenu **każdy redeploy i restart kasuje uploady**:

- Render: efemeryczny na Free i bez dysku na płatnych, dopóki nie dołączysz
  dysku (0,25 $/GB/mies.); dołączenie dysku wyłącza zero-downtime deploy (§5.1).
- DO App Platform: brak trwałych dysków w ogóle (§5.4).
- Railway: wolumen trwały, ale rozmiar zależny od planu (Free 500 MB) (§5.2).
- Fly.io: wolumen trwały, ale przypisany do jednej maszyny (§5.3).

Dwie drogi: (a) platforma z trwałym wolumenem, (b) przeniesienie uploadów na
magazyn obiektowy S3-kompatybilny. DO Spaces to 5 $/mies. za 250 GiB i 1 TiB
ruchu (§4.2), Cloudflare R2 — 10 GB-mies. i egress za darmo, potem
0,015 $/GB-mies. ([cennik R2](https://developers.cloudflare.com/r2/pricing/)).
Wariant (b) wymaga dołożenia `league/flysystem-aws-s3-v3` (dziś go nie ma, §2)
i uwzględnienia, że `Storage::disk('public')->url()` składa URL z `APP_URL`
(§2) — po przejściu na obiektowy dysk adres bierze się z konfiguracji dysku.

### 8.2. MySQL na darmowych planach

- Render: **brak zarządzalnego MySQL**; darmowy Postgres wygasa po 30 dniach.
- Fly.io: w cenniku tylko Managed Postgres.
- DO App Platform: dev DB to tylko Postgres; MySQL = płatny Managed Database.
- Railway: MySQL z obrazu + wolumen; na Free wolumen 500 MB.
- Heroku: tylko Postgres i Key-Value — zarządzalnego MySQL nie ma (§5.5).
- Koyeb: tylko serverless Postgres (§5.5).
- Laravel Cloud: MySQL Flex w każdym planie (jedyne zarządzalne MySQL w tym
  zestawieniu).

Na VPS MySQL 8 stawiasz sam (§4), co daje pełną kontrolę i wersję `8.4`
zgodną z dev `compose.yaml`.

### 8.3. Limity i budżety

- Render: 750 h/instancję/mies., pasmo 5 GB (Hobby) i budżet pipeline'u budowania
  (500 min w Hobby), potem dopłaty.
- Railway: Free 1 $/mies. kredytu i brak domen; przekroczenie wliczonej kwoty to
  normalna dopłata.
- Fly.io: brak progu darmowego — każda włączona maszyna i wolumen kosztują.
- Laravel Cloud: limit wydatków zatrzymuje compute; nadwyżki pasma 0,10 $/GB.
- VPS: koszt stały i przewidywalny, ale nadmiar ruchu to zwykle dopłata u
  dostawcy (Hetzner podaje 20 TB wliczonego ruchu dla CX23
  w [opisie nowych planów cloud](https://www.hetzner.com/news/new-cloud-plans/)).

### 8.4. Własna domena warunkiem TLS

TLS wymaga nazwy w DNS. Wszędzie domena jest po stronie użytkownika; PaaS daje
„custom domain" i automatyczny certyfikat, a VPS wymaga Caddy/certbota (§3.4).
Wyjątek ostrzegawczy: Railway Free ma **0** własnych domen (§5.2), więc „stały
publiczny adres z TLS" na darmowym planie Railwaya nie jest osiągalny bez
upgrade'u.

## 9. Jak tego typu projekt wdrażają inni: wzorce i pułapki

Wzorce wynikające wprost z dokumentacji (Vite, Laravel, Caddy) i z modeli
dostawców opisanych wyżej — nie z przepytywania cudzych repozytoriów, czego nie
robiono:

- **Jeden obraz backendu na nginx + php-fpm, dwa statyczne bundle podawane przez
  ten sam nginx, API pod tym samym origin.** Zaleta: brak CORS, jeden
  certyfikat, jedno miejsce na `storage:link`. Koszt: trzeba rozdzielić fronty
  po ścieżkach i ustawić `base` (§3.3) — dziś żaden front go nie ma.
- **Osobne origin dla każdego frontu i API.** Zaleta: oba fronty zostają na `/`,
  bez `base`. Koszt: CORS (dziś wpuszcza tylko localhost, §2), więcej
  certyfikatów/konfiguracji.
- **Statyczne fronty na hostingu statycznym/CDN, API osobno.** Najlepiej pasuje
  do PaaS-ów bez trwałego dysku, ale to znów wiele origin i CORS.
- **Migracje i seed jako krok deployu** (`php artisan migrate --force`,
  `db:seed` przy pierwszym starcie), nie ręcznie — inaczej świeży kontener
  wstaje z pustą bazą.
- **`php artisan optimize` i cache konfiguracji/tras** w obrazie produkcyjnym
  (dokumentacja Deployment), z `APP_DEBUG=false`.
- **Trasa `/up`** jako health check, żeby platforma wiedziała, kiedy uznać
  deploy za udany.

Najczęstsze pułapki widoczne w samym repo, które uderzą przy pierwszym deployu:
`VITE_API_URL` wsiąka w build (§2), więc zmiana adresu API = przebudowa frontów;
`storage:link` musi się wykonać w obrazie; `APP_URL` steruje absolutnymi URL-ami
uploadów; domyślny dysk to `local`, a `s3` nie ma zależności.

Poza zakresem tego badania zostały narzędzia typu self-hosted PaaS na własnym
VPS (np. Coolify, Dokploy) — nie sprawdzano ich i nie ma o nich tu żadnych
twierdzeń.

## 10. Czego nie sprawdzono

- **Nic nie uruchomiono.** Brak provisioningu, brak builda obrazu, brak pomiaru
  czasu deployu i wybudzenia. Wszystkie liczby o zachowaniu platform pochodzą
  z ich cenników/dokumentacji.
- **Cen nie porównywano w jednej walucie ani z VAT.** Hetzner podaje EUR bez
  VAT i bez IPv4 (§4.1); OVHcloud i Mikrus w PLN (OVHcloud netto i brutto,
  Mikrus brutto), reszta w USD. Kursów nie przeliczano, więc liczby z różnych
  sekcji nie są wprost porównywalne.
- **Nie badano konkretnego hostingu uczelnianego** ani nie ustalano, czy zespół
  ma dostęp do Azure/studentów (§7) — to zależy od uczelni. Jedyny konkretny
  ślad, **Mikrus dla edukacji** ([edu.mikr.us](https://edu.mikr.us)), pozostaje
  niezweryfikowany co do warunków.
- **Nie sprawdzono Coolify/Dokploy** ani innych self-hosted PaaS-ów (§9).
- **Nie mierzono realnego zużycia RAM/CPU/ruchu** tego stacku: 48 testów
  Feature i seed demo to nie profil obciążenia. Dobór rozmiaru maszyny jest
  szacunkiem, nie pomiarem.
- **Strona Oracle była niedostępna dla narzędzia (403)** — fakty z §4.3 opierają
  się na dokumentacji Oracle, nie na stronie marketingowej. `hetzner.com/cloud`
  renderuje ceny JS-em, więc użyto strony dokumentacji Hetznera.
