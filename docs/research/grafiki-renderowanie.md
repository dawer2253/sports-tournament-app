# Grafiki do social mediów: jak wyrenderować szablon do pliku

Badanie na potrzeby ticketu
[#321 „Grafiki: research — jak wyrenderować grafikę do pliku"](https://github.com/dawer2253/sports-tournament-app/issues/321),
część mapy [#319 „Mapa: generator grafik do social mediów"](https://github.com/dawer2253/sports-tournament-app/issues/319).
Data: 5 listopada 2026. Stan repo odczytany z gałęzi `research/grafiki-renderowanie`
(odbitej od `main` na `bf906ff`).

**Ten plik ustala fakty, nie podejmuje decyzji.** Wybór drogi należy do
ticketu rozstrzygającego. Jedyna sekcja z oceną to §9 („Rekomendacja"),
wyraźnie oddzielona od reszty.

## 0. Źródła i metoda

- Biblioteki: README i kod źródłowy w repozytoriach na GitHubie, metadane
  wydań z rejestru npm (`https://registry.npmjs.org/<pakiet>`) i Packagista
  (`https://repo.packagist.org/p2/<pakiet>.json`), rozmiary plików z
  `https://unpkg.com/<pakiet>@<wersja>/?meta`, aktywność repo z
  `gh api repos/<właściciel>/<repo>`. Wszystko odczytane 2026-11-05.
- Przeglądarki: MDN oraz surowe dane
  [`mdn/browser-compat-data`](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json),
  z których MDN składa tabele zgodności.
- Wymiary: Meta Ads Guide (strony `facebook.com/business/ads-guide/...`) i
  Centrum pomocy Instagrama.
- **Nie mierzyłam** czasu renderowania żadnej z opcji ani rozmiaru paczki po
  minifikacji i gzipie. Liczby bajtów w §2 to surowe pliki z paczki npm.
- **Nie uruchamiałam** backendu (Sail nie stał), więc zachowanie nagłówków CORS
  na `/storage` w §3 wynika z odczytu konfiguracji i kodu, nie z żądania.

## 1. Streszczenie

1. **Obrazy z `/storage` to główne ryzyko drogi przeglądarkowej.** Każda
   biblioteka przeglądarkowa (html-to-image, modern-screenshot, satori) pobiera
   herby i logo przez `fetch`, a czysty canvas bez CORS zostaje „tainted".
   Dziś CORS w Laravelu obejmuje tylko `api/*`, a pliki z `/storage` serwer
   deweloperski podaje z pominięciem Laravela (§3). Trzeba wybrać jedno z: nagłówek
   CORS na `/storage` po stronie serwera WWW, jeden origin (#278), endpoint pod
   `api/*` oddający obraz albo render na serwerze.
2. **html-to-image / modern-screenshot** renderują **ten sam komponent React**,
   który stoi w Storybooku, bo fotografują prawdziwy DOM przeglądarki (wierność
   CSS = wierność przeglądarki, w tym `oklch()` z Tailwinda 4). Słabsza strona:
   WebKit (Safari) bywa kapryśny przy obrazach osadzonych w `foreignObject`.
3. **satori** ma własny silnik układu i nie wykona hooków Reacta. Komponenty z
   `packages/ui/src/public/` używają hooków (`useImageFallback` w `Crest`), więc
   szablon dla satori byłby osobnym, „czystym" drzewem JSX. Paczka jest duża
   (~1,6 MB surowego JS z wbudowanym WASM).
4. **Na serwerze** Browsershot (Chromium przez Puppeteera) daje pełną wierność,
   ale wymaga Node, Chromium i bibliotek systemowych w obrazie produkcyjnym,
   którego jeszcze nie ma (#278). Intervention Image (GD/Imagick/libvips) nie
   wymaga nic poza rozszerzeniem PHP, ale układ grafiki trzeba pisać od zera
   w PHP, bez kodu z `packages/ui`.
5. **Wymiary Meta (Ads Guide)**: feed 4:5 zalecane **1440 × 1800**, Stories 9:16
   zalecane **1440 × 2560**, strefa bezpieczna Stories: ok. **14% góry, 35% dołu,
   6% boków** wolne od tekstu i logo. Kwadrat 1:1 mieści się w dozwolonym zakresie
   proporcji (od 4:5 do 1,91:1).
6. **Web Share z plikiem** działa w Chrome (Android od 76, desktop od 89 —
   na macOS/Linux dopiero od 128), Edge, Safari 14+ (macOS i iOS), Samsung
   Internet 11+. **Firefox nie udostępnia plików** (ani desktop, ani Android).
   Wymaga HTTPS i kliknięcia użytkownika — potrzebny fallback na pobranie pliku.
   Aktywacja z kliknięcia trwa 5 s w Chromium i WebKit (kod źródłowy, gałąź
   `main`), więc render PNG po kliknięciu „Udostępnij" musi się w nich zmieścić
   albo PNG trzeba przygotować przed kliknięciem (§6.1). Instagram na Androidzie
   przyjmuje `image/*` z intencji systemowej wg dokumentacji Meta; dla iOS
   i dla Facebooka/WhatsAppa pierwotnego źródła nie znalazłam (§6.3).

## 2. W przeglądarce

### 2.1. html-to-image

| | |
|---|---|
| Mechanizm | Klon DOM + skopiowane style obliczone, czcionki i obrazy osadzone jako data URL, całość w SVG `<foreignObject>`, potem narysowana na canvasie i odczytana ([README, „How it works"](https://github.com/bubkoo/html-to-image#how-it-works)) |
| Wierność CSS | Rysuje przeglądarka, więc gradienty, `oklch()`, zmienne CSS i pseudo-elementy są takie jak na ekranie (pseudo-elementy odtwarza z obliczonych stylów, krok 2 w README) |
| Fonty | Szuka wszystkich `@font-face` w arkuszach, pobiera pliki i osadza jako data URL. Opcje: `preferredFontFormat` (np. tylko `woff2`), `fontEmbedCSS` + `getFontEmbedCSS()` do policzenia osadzenia raz dla wielu ujęć ([README, opcje](https://github.com/bubkoo/html-to-image#preferredfontformat)) |
| Obrazy z innego originu | Pobiera je `fetch(url, init)` ([`src/dataurl.ts` w v1.11.13, wiersz 20](https://github.com/bubkoo/html-to-image/blob/v1.11.13/src/dataurl.ts)), więc serwer obrazu musi oddać nagłówek CORS. Przy błędzie wstawia `imagePlaceholder` albo pustkę (tamże, wiersz 97) — herb po prostu znika, bez wyjątku |
| Rozdzielczość | `pixelRatio` (domyślnie DPR urządzenia, `1` = skala 1), `canvasWidth`/`canvasHeight` |
| Znane słabości | WebKit potrafi narysować duży osadzony obraz pusto przy pierwszym rasterowaniu (README, gałąź v2 ma na to `stabilizationAttempts`); bardzo duży DOM przekracza limit data URI |
| Rozmiar | `dist/html-to-image.js` 20 562 B surowo (unpkg), zero zależności (npm) |
| Utrzymanie | Ostatnie wydanie na npm: **1.11.13 z 2025-02-14**, jedyny dist-tag `latest`. W `master` trwają prace nad „v2" (`createRenderer`, wtyczki), ostatni push 2026-11-02, ale v2 nie jest opublikowane na npm. Licencja MIT |

### 2.2. modern-screenshot

Fork html-to-image ([README](https://github.com/qq15725/modern-screenshot)),
ten sam mechanizm `foreignObject`. Różnice odczytane z
[`src/options.ts`](https://github.com/qq15725/modern-screenshot/blob/main/src/options.ts):
`scale`, `width`/`height`, `fetch.requestInit`, `fetch.placeholderImage`,
`fetchFn` (własna funkcja pobierania, opisana w kodzie jako sposób na
obejście CORS), `font: false | { preferredFormat, cssText, minify }`. README
dodaje `createContext({ workerUrl, workerNumber })` do pobierania zasobów w Web
Workerach i wprost przyznaje: „Partial embedding will fail due to CORS".

Wydanie **4.7.0 z 2026-04-16**, ostatni push do repo tego samego dnia
(`gh api repos/qq15725/modern-screenshot`). Licencja MIT,
`dist/index.mjs` 54 773 B surowo, zero zależności.

### 2.3. satori + resvg-wasm

| | |
|---|---|
| Mechanizm | JSX → SVG własnym silnikiem układu (Taffy: flexbox, grid, block) i własnym układem tekstu, potem SVG → PNG osobną biblioteką ([README](https://github.com/vercel/satori#documentation)) |
| Wierność CSS | „not a complete CSS implementation"; brak gwarancji zgodności 1:1 z przeglądarką. Obsługuje m.in. zmienne CSS, gradienty, `<style>` z selektorami, `@media`, `::before/::after`. Ignoruje `@font-face`, `@import`, `@keyframes`, właściwości spoza tabeli (np. `fontStretch`). `oklch()`/`lab()` konwertuje do `rgb()` ([README, Colors](https://github.com/vercel/satori#colors)) |
| React | „only accepts JSX elements that are pure and stateless" — `useState`, `useEffect` niedozwolone (README, JSX) |
| Fonty | TTF, OTF, WOFF, WOFF2, podawane jako `ArrayBuffer` w opcji `fonts`. **Fonty zmienne renderuje jako instancję domyślną** (np. regular). Tekst idzie do SVG jako ścieżki (`embedFont`), więc rasteryzator nie potrzebuje fontów (README, Fonts) |
| Obrazy | `<img src>`: URL pobierany `fetch` ([`src/handler/image.ts`](https://github.com/vercel/satori/blob/main/src/handler/image.ts)) → ten sam wymóg CORS; README zaleca podawać base64/bufor |
| Przeglądarka | Działa w przeglądarce i Web Workerze, WASM wbudowany jako base64; jest też build `standalone` z osobnym `layout.wasm` |
| SVG → PNG | README satori wskazuje Sharp (Node). W przeglądarce: `@resvg/resvg-wasm` (`initWasm`, `new Resvg(svg).render().asPng()`, [README resvg-js](https://github.com/thx/resvg-js)) albo narysowanie SVG na canvasie |
| Rozmiar | `satori@0.63.2`: `dist/index.js` 1 630 918 B, `dist/standalone.js` 937 346 B + `layout.wasm` 520 763 B; `@resvg/resvg-wasm@2.6.2`: `index_bg.wasm` 2 478 606 B (wszystko surowo, unpkg) |
| Utrzymanie | satori **0.63.2 z 2026-10-20**, MPL-2.0, push 2026-10-23. resvg-wasm **2.6.2 z 2024-03-26** (ostatnie wydanie na npm), MPL-2.0 |

Fakty o czcionkach repo istotne dla satori: Barlow i Barlow Condensed z
`@fontsource` to **kroje statyczne** z osobnymi plikami na wagę i podzbiór
(`latin`, `latin-ext`, ...), w formatach `woff` i `woff2`
(`ls node_modules/@fontsource/barlow-condensed/files | sed 's/.*\.//' | sort | uniq -c`
→ 54 × `woff`, 54 × `woff2`). Problem fontów zmiennych ich więc nie dotyczy, ale
satori trzeba podać osobno każdą użytą wagę i podzbiór `latin-ext` (polskie
znaki; komentarz w `sed -n 14,16p packages/ui/src/public/theme.css`).

### 2.4. Czysty canvas

Rysowanie `CanvasRenderingContext2D` ręcznie: zero zależności, pełna kontrola,
ale bez silnika układu (zawijanie tekstu, tabela, wyrównania liczy kod).
Obraz z innego originu bez CORS **zabrudza canvas**, a wtedy `toBlob()`,
`toDataURL()` i `getImageData()` rzucają `SecurityError`; lekarstwo to
`img.crossOrigin = "anonymous"` po stronie klienta **i**
`Access-Control-Allow-Origin` po stronie serwera
([MDN: Allowing cross-origin use of images and canvas](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image)).
Ten szablon nie byłby komponentem React ze Storybooka.

## 3. Herby i logo z `/storage`: stan repo

| Fakt | Polecenie |
|---|---|
| CORS Laravela obejmuje tylko ścieżki API | `grep -n "'paths'" backend/config/cors.php` → `'paths' => ['api/*']` |
| Dozwolone originy to tylko lokalne porty 5173/5174 | `sed -n 30,35p backend/config/cors.php` |
| URL dysku `public` składa się z `APP_URL` + `/storage` | `grep -n "/storage'" backend/config/filesystems.php` |
| Sail podaje aplikację przez `php artisan serve` | `grep -n SUPERVISOR_PHP_COMMAND backend/vendor/laravel/sail/runtimes/8.5/Dockerfile` (po `composer install`) |
| `artisan serve` oddaje istniejący plik z `public/` bez uruchamiania Laravela | `sed -n 12,14p backend/vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php` (`return false` dla istniejącego pliku) |
| Komponenty nie ustawiają `crossOrigin` na `<img>` | `grep -rni crossorigin packages/ui/src apps/*/src` nic nie zwraca |

Wniosek z odczytu (niesprawdzony żądaniem): plik `/storage/...` nie dostaje
dziś nagłówka `Access-Control-Allow-Origin`, bo nie przechodzi przez
middleware CORS Laravela ani nie pasuje do `api/*`. Na produkcji pliki
statyczne poda serwer WWW (nginx/Caddy wg
[`docs/research/srodowisko-wdrozenia-laravel-spa.md`](srodowisko-wdrozenia-laravel-spa.md) §3.1),
więc nagłówek ustawia się w jego konfiguracji, nie w `cors.php`.

Drogi, które usuwają problem (fakty, bez wyboru):

- **nagłówek CORS na `/storage`** w serwerze WWW (dev: `artisan serve` tego nie
  umie bez zmiany sposobu serwowania plików);
- **jeden origin** panelu i backendu — rozstrzyga #278 (topologia);
- **endpoint pod `api/*`** oddający bajty obrazu albo data URI (przechodzi przez
  istniejący CORS, ale to zmiana kontraktu);
- **render na serwerze**, który czyta pliki z dysku, nie przez HTTP.

Uwaga praktyczna: jeśli ten sam URL obrazu był już załadowany przez zwykły
`<img>` bez `crossOrigin`, przeglądarka może podać z cache odpowiedź bez
nagłówków CORS — stąd opcje `cacheBust` (html-to-image) i `bypassingCache`
(modern-screenshot). Nie sprawdzałam tego zachowania empirycznie.

## 4. Na serwerze

### 4.1. Browsershot (headless Chromium przez Puppeteera)

- `spatie/browsershot` **5.4.2 z 2026-10-26**, MIT, wymaga PHP ^8.2,
  `symfony/process` (Packagist).
- Wymagania ([docs v5](https://spatie.be/docs/browsershot/v5/requirements)):
  Node 22+, Puppeteer 23+, Chrome zainstalowany przez
  `npx puppeteer browsers install chrome`, na Ubuntu 24.04 lista bibliotek
  systemowych (`libgtk-3-0`, `libnss3`, `libasound2t64` …) i — na Ubuntu 23.10+ —
  zmiana `kernel.apparmor_restrict_unprivileged_*` przy błędzie sandboksa.
- Puppeteer w Dockerze ([pptr.dev/troubleshooting](https://pptr.dev/troubleshooting)):
  trzeba doinstalować brakujące biblioteki i Chrome, fonty dla pism niełacińskich;
  dokumentacja odradza `--no-sandbox` i zaleca użytkownika bez roota.
- **Co dochodzi do obrazu produkcyjnego**: Node + Chromium + biblioteki
  systemowe (setki MB — nie mierzyłam). Obrazu jeszcze nie ma
  (`find . -name "Dockerfile*" -not -path "*/node_modules/*" -not -path "*/vendor/*"`
  nic nie zwraca; por. #278). Obraz deweloperski Saila ma Node
  (`grep -n NODE_VERSION backend/vendor/laravel/sail/runtimes/8.5/Dockerfile` → 24),
  ale nie Chromium.
- **CI**: Chromium już się instaluje w jobach „Frontend" i „E2E"
  (`grep -n "playwright install" .github/workflows/ci.yml`), ale job backendu
  chodzi natywnie bez przeglądarki — test Pest z prawdziwym renderem
  potrzebowałby jej doinstalowania.
- **Szablon**: strona HTML; mógłby to być zbudowany komponent z `packages/ui`
  podany przez osobną trasę frontu, ale to dodatkowy build i adres do
  utrzymania. Czasu generowania nie mierzyłam.

### 4.2. satori w Node

Ten sam satori co w §2.3, ale jako proces Node obok PHP (sidecar albo CLI
wołane przez `symfony/process`), z Sharp lub `@resvg/resvg-js` (natywne binaria)
do PNG. Do obrazu produkcyjnego dochodzi Node; Chromium nie. Te same ograniczenia
szablonu (bez hooków, podzbiór CSS). Obrazy czyta się z dysku i podaje jako
bufor, więc CORS znika.

### 4.3. Biblioteki obrazów w PHP

`intervention/image` **4.4.1 z 2026-10-30**, MIT, PHP ^8.3, sterowniki GD,
Imagick albo libvips ([README](https://github.com/Intervention/image)).
Obraz Saila ma `php8.5-gd` i `php8.5-imagick`
(`grep -n "php8.5-gd\|php8.5-imagick" backend/vendor/laravel/sail/runtimes/8.5/Dockerfile`).
Brak silnika układu i CSS: każdy element (tekst, herb, tabela) pozycjonuje się
współrzędnymi w PHP, fonty jako pliki TTF/OTF na dysku. Szablon nie dzieli kodu
z `packages/ui` ani ze Storybookiem. Strony o renderowaniu tekstu w v4 nie udało
mi się odczytać (renderowana JS-em), więc szczegółów API tekstu nie podaję.

## 5. Formaty social mediów

Źródło: Meta Ads Guide, odczyt 2026-11-05. To specyfikacje **reklam**; Meta nie
publikuje osobnej, równie szczegółowej tabeli dla zwykłych postów.

| Miejsce | Proporcje | Zalecana rozdzielczość | Ograniczenia | Źródło |
|---|---|---|---|---|
| Instagram feed | 4:5 | 1440 × 1800 | min. szer. 500 px, proporcje od 4:5 do 1,91:1, tolerancja 1%, JPG/PNG, do 30 MB | [instagram-feed](https://www.facebook.com/business/ads-guide/update/image/instagram-feed) |
| Facebook feed | 4:5 | 1440 × 1800 | min. 600 × 750 px, tolerancja 3%, JPG/PNG, do 30 MB | [facebook-feed](https://www.facebook.com/business/ads-guide/update/image/facebook-feed) |
| Instagram Stories | 9:16 | 1440 × 2560 | min. szer. 500 px, tolerancja 1% | [instagram-story](https://www.facebook.com/business/ads-guide/update/image/instagram-story) |
| Facebook Stories | 9:16 | 1440 × 2560 | min. szer. 500 px, tolerancja 1% | [facebook-story](https://www.facebook.com/business/ads-guide/update/image/facebook-story) |

- **Strefa bezpieczna Stories** (obie strony Stories): „około 14% górnej, 35%
  dolnej i 6% bocznej" części wolne od tekstu, logo i kluczowych elementów.
  Przy 1440 × 2560 to ok. 358 px góry, 896 px dołu i 86 px z każdego boku
  (przeliczenie moje).
- **Kwadrat 1:1** nie ma osobnej rekomendacji w Ads Guide, ale mieści się w
  dozwolonym zakresie proporcji feedu (4:5 … 1,91:1).
- **Posty organiczne na Instagramie**: Centrum pomocy
  ([1631821640426723](https://help.instagram.com/1631821640426723)) w opisie
  strony mówi, że zdjęcie jest wgrywane w najlepszej rozdzielczości „up to
  1080x1080 pixels"; treść artykułu renderuje się JS-em i jej nie odczytałam.
  Liczby 1080 × 1350 i 1080 × 1920 krążą w poradnikach zewnętrznych — **nie
  potwierdziłam ich w źródle Meta**.

## 6. Udostępnianie z przeglądarki (Web Share API z plikiem)

Dane z `mdn/browser-compat-data` (`api/Navigator.json`, klucze
`share.data_files_parameter` i `canShare.data_files_parameter`); pusty wpis
oznacza w tych danych lustro przeglądarki macierzystej.

| Przeglądarka | `share()` | pliki w `share()`/`canShare()` |
|---|---|---|
| Chrome desktop | 128 (89–127 tylko ChromeOS i Windows) | od 89 (na macOS/Linux realnie od 128, bo wcześniej nie było samego `share`) |
| Chrome Android | 61 | 76 |
| Edge | 93 (81–92 tylko Windows) | 81 |
| Firefox desktop | 71 za flagą | **nie** |
| Firefox Android | 79 | **nie** (lustro desktopu) |
| Safari macOS | 12.1 | 14 |
| Safari iOS | jak Safari | jak Safari (14) |
| Samsung Internet | jak Chrome Android | 11.0 |
| Android WebView | nie | nie |

Wymogi ([MDN `share()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share),
[MDN `canShare()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare)):
tylko bezpieczny kontekst (HTTPS), `share()` wymaga aktywacji użytkownika
(kliknięcia), inaczej `NotAllowedError`; `canShare({ files })` zwraca `false`,
gdy przeglądarka nie udostępnia plików albo blokuje to Permissions Policy
`web-share`. PNG (`image/png`) jest na liście typów „usually shareable", więc
MDN zaleca sprawdzać `canShare` przed `share`. `localhost` przeglądarki traktują
jako bezpieczny kontekst, więc dev nie wymaga TLS.

Ustalenie z mapy (#319, #322): integracja z social mediami to przycisk
„Udostępnij", który otwiera systemowy arkusz udostępniania, a aplikację wybiera
organizator. Niżej szczegóły pod ten przypadek.

### 6.1. Gest użytkownika a asynchroniczny render przed `share()`

- **Spec Web Share** ([w3c.github.io/web-share](https://w3c.github.io/web-share/),
  algorytm `share()`): bez transient activation → `NotAllowedError` (krok 6),
  a samo wywołanie **zużywa** aktywację (krok 7, „consume user activation").
  `canShare()` aktywacji nie wymaga.
- **Spec HTML** ([transient activation duration](https://html.spec.whatwg.org/multipage/interaction.html#transient-activation-duration)):
  czas trwania aktywacji jest stałą implementacji, „expected be at most a few
  seconds". Aktywację dają `pointerdown`/`mousedown`, `pointerup`, `touchend`,
  `keydown` ([MDN: Transient activation](https://developer.mozilla.org/en-US/docs/Glossary/Transient_activation)).
- **Chromium**: `kActivationLifespan = base::Seconds(5)`
  ([`user_activation_state.h`](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/common/frame/user_activation_state.h),
  gałąź `main`; komentarz: ma starczyć na rundę sieciową na wolnym łączu).
- **WebKit**: `defaultTransientActivationDuration { 5_s }`
  ([`LocalDOMWindow.cpp`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/LocalDOMWindow.cpp),
  gałąź `main`; **nie sprawdzałam**, od której wersji Safari na iOS obowiązuje ta
  wartość). Blog WebKit podaje jako typowy błąd właśnie `await fetch(...)` przed
  `navigator.share({ files })` — aktywacja wygasa i `share()` odpada
  ([The User Activation API, 2023-02-15](https://webkit.org/blog/13862/the-user-activation-api/)).
  WebKit ma na to test regresji `LayoutTests/fast/web-share/share-transient-activation-expired`
  (oczekiwany wynik: `NotAllowedError`).

Wniosek dla projektu (fakt z powyższego, nie test): render PNG **po** kliknięciu
„Udostępnij" mieści się w geście tylko wtedy, gdy trwa poniżej ok. 5 s od
kliknięcia — czasu renderu żadnej biblioteki nie mierzyłam (§0), a na słabszym
telefonie i przy 1440 × 2560 może być blisko granicy. Wzorce, które problem
omijają: (a) wyrenderować `Blob` wcześniej (przy podglądzie albo po zmianie
formatu) i w kliknięciu wołać od razu `canShare`/`share`; (b) dwa kroki —
„Przygotuj grafikę", potem „Udostępnij"; (c) sprawdzić
`navigator.userActivation.isActive` przed `share()` i przy wygasłej aktywacji
pokazać drugi przycisk (API opisane we wpisie WebKit).

### 6.2. Typy i limity plików

- Spec nie wylicza typów; blokowanie typu „due to security considerations" daje
  `NotAllowedError` (krok 11). Wnioskuję ze struktury algorytmu, że `canShare()`
  tego kroku nie wykonuje, więc może zwrócić `true` dla typu, który `share()`
  odrzuci — PNG jest jednak na listach obu silników (niżej).
- **Chromium desktop** ([`share_service_impl.cc`](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/webshare/share_service_impl.cc),
  [`.h`](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/webshare/share_service_impl.h)):
  lista dozwolonych rozszerzeń i typów MIME zawiera `.png` / `image/png`;
  `kMaxSharedFileCount = 10`, `kMaxSharedFileBytes = 50 MB`; karta musi być
  aktywna i widoczna, inaczej `PERMISSION_DENIED`.
- **Chromium Android** ([`ShareServiceImpl.java`](https://chromium.googlesource.com/chromium/src/+/main/components/browser_ui/webshare/android/java/src/org/chromium/components/browser_ui/webshare/ShareServiceImpl.java)):
  te same limity (`MAX_SHARED_FILE_COUNT = 10`, `MAX_SHARED_FILE_BYTES = 50 MB`)
  i `image/png` na liście.
- **Plik**: `new File([blob], "zapowiedz.png", { type: "image/png" })` — typ
  MIME i rozszerzenie są sprawdzane osobno (Chromium: `IsDangerousFilename`
  i `IsDangerousMimeType`), więc oba muszą się zgadzać z listą.
- PNG 1440 × 2560 będzie daleko od 50 MB (rząd pojedynczych MB — nie mierzyłam).

### 6.3. Czy Instagram, Facebook, WhatsApp przyjmą obraz z arkusza

Arkusz pokazuje aplikacje, które system uzna za cele dla `image/png`; to
decyzja aplikacji docelowych, nie strony.

- **Instagram, Android**: dokumentacja Meta „Sharing to Feed"
  ([developers.facebook.com](https://developers.facebook.com/docs/instagram-platform/sharing-to-feed))
  opisuje udostępnianie obrazu do Instagrama zwykłą intencją `ACTION_SEND`
  z typem `image/*` (JPEG, GIF, PNG). Chrome na Androidzie przekazuje pliki
  do systemowego udostępniania (`ShareParams` w `ShareServiceImpl.java`), więc
  Instagram powinien być na liście — **wniosek, nie test na urządzeniu**.
- **Instagram, iOS**: ta sama strona Meta opisuje dla iOS inną drogę
  (Document Interaction API, plik `.ig`/`.igo`), nie arkusz udostępniania.
  Pierwotnego źródła potwierdzającego, że Instagram przyjmuje PNG z arkusza
  Safari, **nie znalazłam**.
- **Facebook, WhatsApp**: pierwotnego źródła o przyjmowaniu obrazu z arkusza
  (Android ani iOS) **nie znalazłam**. Do sprawdzenia na fizycznych telefonach
  w prototypie.
- Przy udostępnianiu pliku pola `text`/`url` bywają przez aplikacje docelowe
  ignorowane — tego też nie sprawdzałam; bezpieczniej nie opierać się na
  podpisie przekazanym z arkusza.

### 6.4. Desktop

- **Windows**: Chrome i Edge otwierają systemowe okno udostępniania (dane BCD:
  Chrome 89–127 tylko ChromeOS i Windows, Edge 81–92 tylko Windows).
- **macOS**: Safari 14+ (pliki), Chrome od 128 (nowość 128 w BCD; zapowiedź
  w newsletterze [„New in Chrome 128" na fugu-dev](https://groups.google.com/a/chromium.org/g/fugu-dev/c/eGi3P03iC4c)).
- **Linux**: BCD nie ma przy Chrome 128 uwagi o platformie; **nie sprawdzałam**,
  czy na Linuksie jest arkusz. Firefox desktop: `share()` tylko za flagą, plików
  brak.
- Czy desktopowy arkusz oferuje Instagram/Facebook — nie sprawdzałam. Na
  desktopie praktycznym celem jest raczej pobranie albo schowek.

### 6.5. Fallback: pobranie i schowek

- **Pobranie**: `<a download="…png" href={URL.createObjectURL(blob)}>` — działa
  wszędzie tam, gdzie `canShare({ files })` zwraca `false`. Uwaga: `share()`
  zużywa aktywację (§6.1), więc po `AbortError` (anulowanie arkusza) kolejna
  akcja wymagająca gestu potrzebuje nowego kliknięcia. Czy programowe
  `a.click()` po `await` pobiera plik w Safari na iOS — nie sprawdzałam.
- **Schowek** (`navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])`):
  tylko HTTPS ([MDN `Clipboard.write()`](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/write)),
  „commonly support writing text, HTML, and PNG image data". Dane BCD
  (`api/Clipboard.json`, `api/ClipboardItem.json`): Chrome 76+ (od 107 w geście
  albo z uprawnieniem `clipboard-write`, jeden `ClipboardItem` naraz), Firefox
  127+ (w geście, jeden element), Safari 13.1+. Konstruktor `ClipboardItem`
  przyjmuje Promise rozwiązywany do `Blob` w Chrome od 98. WebKit: zapis musi
  zajść „during a user gesture", a `ClipboardItem` mapuje typ MIME na Promise
  ([WebKit: Async Clipboard API, 2020-06-23](https://webkit.org/blog/10855/async-clipboard-api/));
  typy w WebKit: `text/plain`, `text/html`, `text/uri-list`, `image/png`. Czy
  Promise w `ClipboardItem` utrzymuje gest przez dłuższy render w Safari — wpis
  tego nie mówi, nie sprawdzałam.

## 7. Szablon jako komponent w `packages/ui` (Storybook)

| Fakt z repo | Polecenie |
|---|---|
| Język wizualny strony publicznej siedzi w `packages/ui/src/public/` | `ls packages/ui/src/public` |
| Barlow ładuje tylko arkusz strony publicznej; **panel go nie widzi** | `sed -n 4,6p packages/ui/src/public/theme.css` |
| Kolor turnieju wchodzi przez zmienne CSS z `brandVars(hex)` | `grep -n "export function brandVars" -A9 packages/ui/src/lib/brand-on-dark.ts` |
| Tokeny kolorów to `oklch()` | `grep -c oklch packages/ui/src/index.css` → 92 |
| Komponenty publiczne używają hooków (np. herb) | `grep -n useImageFallback packages/ui/src/public/crest.tsx packages/ui/src/public/tournament-logo.tsx` |
| Stories z `play` chodzą w prawdziwym Chromium (Vitest browser) | `grep -n "browser-playwright" packages/ui/package.json` |

Co z tego wynika dla każdej drogi:

- **html-to-image / modern-screenshot**: szablon to zwykły komponent React
  z `packages/ui` (z hookami, Tailwindem, `brandVars`), ten sam w Storybooku
  i w panelu; eksport fotografuje go w DOM. Panel musiałby załadować Barlow
  (dziś ładuje go tylko `theme.css` strony publicznej) — inaczej eksport
  dostanie font zapasowy. Eksport da się sprawdzić funkcją `play` w Chromium.
- **satori**: szablon musi być czystym JSX bez hooków, z obrazami podanymi z
  góry jako data URI; obecnych komponentów (`Crest`, `TournamentLogo`) nie
  użyje wprost. Klasy Tailwinda działają tylko, jeśli poda się satori skompilowany
  CSS w `<style>` — README opisuje obsługę `<style>`, ale nie mówi nic o
  Tailwindzie; nie sprawdzałam tego. Wynik (SVG) da się pokazać w story.
- **Browsershot**: komponent z `packages/ui` może być źródłem, ale potrzebuje
  zbudowanej strony pod adresem, który Chromium otworzy.
- **Intervention / czysty canvas**: szablon poza Storybookiem.

## 8. Czego nie sprawdzono

- Czasów renderowania i rozmiarów paczek po minifikacji/gzipie (żadnej opcji).
- Rzeczywistego nagłówka odpowiedzi `/storage/...` (backend nie stał).
- Zachowania html-to-image i modern-screenshot na fizycznym iPhonie/Safari.
- Treści artykułu Centrum pomocy Instagrama o rozdzielczości zdjęć.
- Obsługi Tailwinda przez satori i API tekstu w Intervention Image v4.
- Czy Instagram, Facebook i WhatsApp pojawiają się w arkuszu dla PNG z Safari
  na iOS i z Chrome na Androidzie (brak testu na urządzeniu), oraz od której
  wersji Safari na iOS aktywacja trwa 5 s.

## 9. Rekomendacja (opinia, nie fakt — do zatwierdzenia przez człowieka)

Najmniej nowej infrastruktury przy największym ponownym użyciu kodu daje
**render w przeglądarce panelu przez html-to-image albo modern-screenshot**,
z szablonem jako komponentem w `packages/ui` (story + `play`), eksportem PNG
w 1440 × 1800 (4:5) i 1440 × 2560 (9:16, ze strefą bezpieczną), oraz
`navigator.canShare({ files })` z fallbackiem na pobranie. PNG warto
renderować przy podglądzie, nie w kliknięciu „Udostępnij", żeby nie ryzykować
wygaśnięcia gestu (§6.1). Między nimi:
modern-screenshot ma świeże wydanie (2026-04) i `fetchFn` do własnego
pobierania obrazów; html-to-image ma większą społeczność, ale ostatnie wydanie
z lutego 2025, a v2 jest nieopublikowane. Warunkiem jest rozwiązanie CORS dla
`/storage` (§3) — najtańszy w kodzie wariant to endpoint pod `api/*` albo
decyzja o jednym originie w #278; to warto rozstrzygnąć razem z topologią.
Render na serwerze (Browsershot) warto trzymać jako zapas, gdyby grafiki miały
powstawać bez przeglądarki (np. automatycznie po meczu albo dla kibiców na
stronie publicznej) — co dziś jest poza zakresem mapy. Prototyp powinien
przede wszystkim sprawdzić herb z `/storage` w eksporcie i Safari na iOS.
