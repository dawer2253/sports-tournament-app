# Playwright E2E: teraz czy po skończeniu aplikacji

Badanie na pytanie: czy wdrażać testy E2E w Playwrighcie już teraz, w trakcie
budowy aplikacji, czy dopiero po jej ukończeniu. Data: 11 października 2026.
Stan repo odczytany z gałęzi `fix/ui-drobiazgi-177`; twierdzenia o repo mają
obok polecenie, które je pokazuje. Źródła zewnętrzne: wyłącznie dokumentacja
Playwrighta i Laravela (adresy przy twierdzeniach).

## 1. Rekomendacja

**Zrobić cienką suitę dymną (smoke) teraz, pełnej suity E2E nie pisać wcześniej
niż po S4 (drabinka).** Konkretnie:

- 3–4 scenariusze na krytycznych ścieżkach, jeden job CI, jedna przeglądarka
  (Chromium), jeden worker.
- Brak jakiegokolwiek E2E dziś oznacza, że **nikt nie sprawdza szwu
  admin + Laravel jako całości**. Testy Pest sprawdzają backend względem
  kontraktu, a vitest + msw sprawdza admina względem mocka. Oba końce są zgodne
  z `openapi.yaml`, ale żaden test nie uruchamia ich razem. To jest właśnie
  luka, którą zamyka E2E i której nie zamknie rozbudowa testów jednostkowych.
- Pełna suita (każdy formularz, każdy błąd walidacji) byłaby kosztowna w
  utrzymaniu, bo UI admina zmienia się codziennie (sekcja 2), a te przypadki są
  już pokryte tańszymi testami.

Wniosek z dokumentacji, który wspiera cienką suitę: Playwright zaleca testować
to, nad czym mamy kontrolę, trzymać dane pod kontrolą i izolować testy
(https://playwright.dev/docs/best-practices). Cienka suita z kontrolowanymi
danymi spełnia to bez dużego narzutu.

## 2. Stan repo (odczytane)

| Fakt | Polecenie |
|---|---|
| Plików testowych: admin 20, public 1 | `find apps/admin/src -name '*.test.ts*' \| wc -l` oraz to samo dla `apps/public/src` |
| Plików testowych backendu: 38 Feature + 2 Unit | `find backend/tests -name '*Test.php' \| sed 's\|/[^/]*$\|\|' \| sort \| uniq -c` |
| Brak E2E; Playwright jest tylko jako silnik Vitesta w `packages/ui` | `grep -n "playwright" packages/ui/package.json` (`@vitest/browser-playwright`, `playwright`) |
| E2E jawnie odłożone: „E2E = future work", „Realtime websockety, E2E (Playwright), CD/deploy" w „poza zakresem" | `grep -n -i "e2e" docs/PLAN.md` (wiersze 31 i 286) |
| CI: kontrakt, frontend (lint, typy, vitest, stories `play`, build), backend (Pest na natywnym MySQL 8.4, tylko przy zmianach w `backend/**`, kontrakcie lub `ci.yml`) | `.github/workflows/ci.yml`, joby `contract`, `frontend`, `backend`, `changes` |
| Chromium już się instaluje w jobie Frontend (`--only-shell`, bez cache'u, ok. 23 s wg komentarza w pliku) | `grep -n -A4 "Instalacja Chromium" .github/workflows/ci.yml` |
| Churn: 359 commitów w repo, z czego 291 z ostatnich 30 dni; w tym okresie `apps/admin/src` miało zmiany w ok. 64 różnych ścieżkach | `git log --oneline \| wc -l`, `git log --since=30.days --oneline \| wc -l`, `git log --since=30.days --format= --name-only -- apps/admin/src \| sort -u \| wc -l` (liczba 64 obejmuje jedną pustą linię, więc realnie 63 do 64) |
| Ostatnie zmiany admina to kolejne ekrany i drobiazgi UI (okno meczu, terminarz, tabela, obiekty, herb) | `git log --since=14.days --oneline -- apps/admin` |
| Roadmapa: S3 = eventy + strona publiczna, S4 = drabinka + kaskada | `grep -n "^| S[0-9]" docs/PLAN.md` (wiersze 256–257) |
| Auth: token Bearer z Sanctuma, trzymany w `localStorage` | `grep -n "localStorage" apps/admin/src/lib/session.ts` oraz `docs/BACKEND.md` (sekcja „Warstwa API i autoryzacja") |
| Seed demo: `make fresh` = `migrate:fresh --seed`; login `dawid@example.com`; id fazy, kolejek i meczów zgodne z kontraktem tylko po `make fresh` | `docs/BACKEND.md`, sekcja „Dane demo" |
| Pest używa `RefreshDatabase` na bazie `testing` | `backend/tests/Pest.php` |

Wniosek: UI jest **niestabilne** (kilka commitów dziennie w `apps/admin`), więc
szczegółowe E2E na poziomie pojedynczych pól rozjeżdżałyby się nieustannie.
Stabilne są natomiast **ścieżki użytkownika** (logowanie, utworzenie turnieju,
wygenerowanie terminarza, wpisanie wyniku), bo wynikają z kontraktu, a nie z
układu ekranu.

### Ograniczenia środowiskowe warte zapamiętania

- `make fresh` bywa blokowane w sesjach agenta (klasyfikator trybu auto, bo baza
  w wolumenie Dockera jest wspólna dla równoległych sesji). Ręczne E2E w
  przeglądarce Claude robiono dotąd po `make up` i sprawdzeniu stanu tinkerem.
  Dla E2E w Playwrighcie trzeba więc **osobnej bazy** (patrz sekcja 4), a nie
  resetu bazy deweloperskiej.
- Czerwone testy admina po ustawieniu `VITE_API_URL` na Laravela w lokalnym
  `.env` to znany problem środowiska, nie regresja (poprawka w PR #68). E2E musi
  więc **jawnie ustawiać `VITE_API_URL`** w swoim `webServer.env`, a nie
  dziedziczyć go z `.env`. Przy sprawdzaniu, czy #68 już wszedł:
  `gh pr view 68 --json state,mergedAt`.
- CORS backendu dopuszcza tylko porty 5173 i 5174 (`apps/admin/.env.example`),
  więc E2E musi używać tych portów, nie losowych.
- Stack testów backendu na CI idzie natywnie, bez Saila (powody w komentarzach
  `ci.yml`). Job E2E powinien kopiować ten wzorzec, a nie wchodzić w Docker w
  Dockerze.

## 3. Co mówią źródła pierwotne

**Izolacja i dane.** Każdy test ma być niezależny, z własnym stanem; wspólną
konfigurację można dać w `beforeEach` albo w projekcie setup. Zalecane są
lokatory zorientowane na użytkownika (`getByRole`) zamiast CSS/XPath oraz
asercje z automatycznym ponawianiem (`expect(...).toBeVisible()`). Na CI
polecane są traces przy pierwszym retry zamiast wideo i zrzutów, runnery Linux
i instalacja tylko potrzebnych przeglądarek
(https://playwright.dev/docs/best-practices).

**Uwierzytelnianie.** Zapis stanu (`storageState`) obejmuje cookies,
localStorage i IndexedDB, ale **nie sessionStorage**. Zalecany wzorzec to
projekt `setup` logujący się raz i zapisujący plik, od którego zależą projekty
testowe; plik zawiera dane uwierzytelniające i ma leżeć w katalogu
ignorowanym przez git (np. `playwright/.auth`). Jeśli aplikacja ma API
logowania, można pominąć UI: `request.post(...)` i `request.storageState(...)`.
Jedno konto współdzielone przez równoległe workery jest bezpieczne tylko wtedy,
gdy testy nie zmieniają współdzielonego stanu po stronie serwera; przy
testach modyfikujących dane zalecane jest konto na workera
(https://playwright.dev/docs/auth).

Zastosowanie u nas (moje wnioskowanie, nie cytat): token Bearer leży w
`localStorage` (`apps/admin/src/lib/session.ts`), więc `storageState` wystarczy,
a login przez `POST /api/v1/login` pomija UI logowania. Samo logowanie przez UI
pokrywa jeden osobny test.

**CI.** Dokumentacja zaleca `workers: 1` na CI dla stabilności i
powtarzalności, ustawienie `globalTimeout`, instalację przez
`npx playwright install --with-deps` i **nie zaleca cache'owania binariów
przeglądarek**, bo przywrócenie cache'u trwa tyle co pobranie. Sharding
(`--shard=X/N`) jest opcją dla dużych suit. Timeout joba nie może być niższy niż
`globalTimeout` (https://playwright.dev/docs/ci). To zgadza się z naszą
praktyką z jobu Frontend (bez cache'u Chromium).

**Serwery w teście.** `webServer` przyjmuje tablicę (np. frontend i backend),
każdy wpis z własnym `command`, `url`, `timeout` i `reuseExistingServer`;
domyślny timeout startu to 60 s; gotowość to odpowiedź 2xx/3xx lub 400–403
z podanego `url` (https://playwright.dev/docs/test-webserver). Pasuje do
uruchamiania `vite` admina i `php artisan serve` jednym poleceniem.

**Laravel: baza w testach.** `RefreshDatabase` owija test w transakcję i nie
migruje, jeśli schemat jest aktualny; `DatabaseMigrations` i
`DatabaseTruncation` resetują bazę całkowicie, ale są wyraźnie wolniejsze
(https://laravel.com/docs/12.x/database-testing). Wniosek (mój): transakcji
testu nie da się przenieść na E2E, bo przeglądarka rozmawia z osobnym
procesem serwera. Dlatego E2E potrzebuje **własnej bazy** i resetu na poziomie
całego przebiegu (`migrate:fresh --seed`), a nie per test.

**Laravel: Sanctum.** Dokumentacja Sanctuma opisuje dwa tryby: tokeny API i
uwierzytelnianie SPA przez cookie sesji (z `/sanctum/csrf-cookie`, nagłówkami
`Referer`/`Origin` i wspólną domeną nadrzędną), a o tokenach pisze wprost, że
nie należy ich używać do własnego SPA pierwszej strony
(https://laravel.com/docs/12.x/sanctum). Repo używa Bearera (AGENTS.md, sekcja
„Stan projektu"). Nie sprawdzałem, czy to świadoma decyzja udokumentowana w
ADR; ma to znaczenie dla E2E tylko tyle, że przy przejściu na cookie sesji
`storageState` nadal działa (cookies są w zakresie), ale `POST /login` w
`request` wymagałby wcześniejszego `GET /sanctum/csrf-cookie`.

## 4. Konkretny plan cienkiej suity

**Zakres (dym, nie regresja):**

1. Logowanie przez UI na seedowanym koncie, wylogowanie, odmowa przy złym
   haśle (jedyny test przez formularz logowania).
2. Pełna ścieżka organizatora: utworzenie turnieju, dodanie drużyn, wygenerowanie
   terminarza, wpisanie wyniku meczu. To główna wartość: przechodzi przez
   kontrakt, walidację, autoryzację poddrzewa i obliczenie tabeli na prawdziwej
   bazie.
3. Strona publiczna pokazuje to, co zapisał panel (tabela i terminarz po
   wyniku z kroku 2), bo `apps/public` i `apps/admin` to dwie aplikacje na
   jednym backendzie.
4. Dopiero po S4: ścieżka pucharowa (drabinka + propagacja zwycięzcy), bo to
   najbardziej wielowarstwowa logika (ADR 0004).

Zgodnie z zasadą z `testing-philosophy` (asercje na niezmiennikach i podjętych
decyzjach, nie na „zapisało się"): w kroku 2 asercja ma sprawdzać pozycje w
tabeli i punkty wynikające z wpisanego wyniku, a nie sam komunikat sukcesu.

**Dane i uwierzytelnianie:**

- Osobna baza `e2e` (nie `laravel`, nie `testing`), tworzona i seedowana raz na
  przebieg (`migrate:fresh --seed`) w `globalSetup` albo w kroku CI.
- Każdy test tworzy własny turniej z unikalnym slugiem (przez API w fixture),
  zamiast polegać na id z seeda demo, które są zgodne z kontraktem tylko po
  `make fresh`.
- Projekt `setup` loguje przez `POST /login` i zapisuje `storageState` do
  `playwright/.auth/` (dopisać do `.gitignore`).
- `workers: 1` na CI (zgodnie z zaleceniem), lokalnie domyślnie; dzięki
  osobnym turniejom na test równoległość lokalna jest bezpieczna.

**Gdzie to położyć:** katalog `e2e/` w rootcie (nie w `apps/*`, bo test dotyka
dwóch aplikacji i backendu) jako osobny workspace npm z własnym
`playwright.config.ts`. Skrypt `test:e2e` poza `npm test`, żeby `npm test`
zostało szybkie.

**CI:** osobny job `e2e`, uruchamiany na PR-ach dotykających `apps/**`,
`backend/**` lub kontraktu (ten sam filtr `changes` co backend, rozszerzony).
Na początek **niewymagany** w ochronie gałęzi, wymagany dopiero po tygodniach
stabilnej zieleni. Zasoby: PHP + MySQL jak w jobie backend, plus Chromium
(`npx playwright install --with-deps --only-shell chromium`, jak w jobie
Frontend). Szacunek (mój, niezmierzony): kilka minut na przebieg przy 3–4
scenariuszach; zmierzyć po pierwszym uruchomieniu.

## 5. Koszt utrzymania przy zespole 3-osobowym

- **Niski koszt**, jeśli suita jest cienka i opiera się na `getByRole` oraz
  etykietach z UI (polskie etykiety są już stabilne dzięki wzorcowi
  FormDialog, patrz memory „Spójność UI"). Zmiana układu nie psuje testów;
  zmiana nazwy przycisku tak.
- **Wysoki koszt**, jeśli E2E duplikuje to, co robią vitest i Pest (walidacje,
  stany błędów), bo przy kilku commitach dziennie w `apps/admin` każda
  kosmetyka byłaby fałszywym alarmem.
- **Flaki** to główne ryzyko E2E z dwoma serwerami i bazą. Ograniczają je:
  asercje z ponawianiem, trace na pierwszym retry i brak zależności od
  zewnętrznych usług (https://playwright.dev/docs/best-practices). Do czasu
  stabilizacji job nie powinien blokować merge'u.
- Właściciel: jedna osoba odpowiedzialna za `e2e/` na milestone, żeby suita nie
  stała się niczyja.

## 6. Dlaczego nie „dopiero na końcu"

- Szew admin + Laravel jest dziś ręcznie sprawdzany w przeglądarce (memory
  „Ręczne E2E w przeglądarce Claude"), co jest powolne i nie zostaje w repo.
  Każdy kolejny milestone (S3, S4) rośnie ten ręczny koszt.
- Konfiguracja (osobna baza, auth, serwery, job CI) to koszt jednorazowy, który
  dojrzewa najlepiej na małej suicie; wdrażanie go na końcu, pod presją
  wydania, to gorszy moment.
- Z drugiej strony pisanie pełnej suity przed stabilizacją UI jest
  marnowaniem czasu, stąd zakres z sekcji 4.

## 7. Czego nie sprawdziłem

- Faktycznego czasu przebiegu E2E w naszym CI (nie ma jeszcze żadnej suity).
- Czy w ochronie gałęzi `main` „Frontend" jest wymaganym sprawdzeniem
  (ustawienie repo, nie plik).
- Czy decyzja o Bearerze zamiast cookie sesji jest opisana w ADR
  (`ls docs/adr` pokazuje ADR 0001–0009, żaden tytułem o tym nie mówi, treści
  nie czytałem).
- Wersji Playwrighta w `package-lock.json` względem aktualnej dokumentacji
  (dokumentacja przykładowo wymienia obraz `v1.64.0`, a `packages/ui` ma
  `^1.61.1`); przy wdrożeniu dopasować wersję do jednej.
