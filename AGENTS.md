# Sports Tournament App

Aplikacja do zarządzania turniejami sportowymi (liga / puchar): panel **admin**
+ widoki **public**. Domena po polsku (drużyny, mecze, tabela, strzelcy,
terminarz, drabinka), nazwy w kodzie po angielsku.

Słownik pojęć: [`CONTEXT.md`](CONTEXT.md). Decyzje trudne do odwrócenia:
[`docs/adr/`](docs/adr/).

## Stan projektu (sierpień 2026)

Stoi fundament: monorepo, kontrakt API, dwie aplikacje React pracujące na mocku
kontraktu oraz backend. **Laravel 13 na Sailu stoi**, ma schemat bazy i warstwę
autoryzacji (Sanctum, token Bearer, `/api/v1`), a testy backendu asertują
zgodność z kontraktem. Endpointy domenowe dochodzą w kolejnych ticketach.
Uruchomienie i stan środowiska opisuje [`docs/BACKEND.md`](docs/BACKEND.md).

## Monorepo

npm workspaces, jeden `package-lock.json` w rootcie. Bez Turborepo.

| Katalog | Zawartość |
|---|---|
| `packages/api-contract/` | `openapi.yaml` — **jedyne źródło prawdy o API** |
| `packages/api-client/` | typy i klient TS generowane z kontraktu |
| `packages/ui/` | design system + ekrany w Storybooku ([własny `AGENTS.md`](packages/ui/AGENTS.md)) |
| `apps/admin/` | panel organizera (logowanie, port 5173) |
| `apps/public/` | strona turnieju (bez logowania, port 5174) |
| `backend/` | Laravel 13 + Sail (MySQL) ([własny `AGENTS.md`](backend/AGENTS.md)); autoryzacja stoi, endpointy domenowe dochodzą w kolejnych ticketach |

## Kontrakt API

Zmiana API idzie zawsze w tej kolejności:

1. zmieniasz `packages/api-contract/openapi.yaml`,
2. `npm run contract:generate` (klient jest commitowany, nie generowany przy instalacji),
3. dopiero teraz kod backendu i frontendu.

CI odrzuca pull requesta, w którym wygenerowany klient nie odpowiada specyfikacji.
Uzasadnienie: [`docs/adr/0001`](docs/adr/0001-kontrakt-openapi-jako-zrodlo-prawdy.md).

Zakres v0.1 to warstwa platformy i odczyt. Endpointy silnika rozgrywek
(generowanie terminarza, wpisywanie wyniku, zdarzenia, drabinka) wchodzą w v0.2.

## Uruchamianie

```bash
npm install
npm run mock          # mock kontraktu na :4010
npm run dev:admin     # panel na :5173
npm run dev:public    # strona publiczna na :5174, np. /t/liga-osiedlowa-2026
npm run storybook     # design system na :6006
```

Mecze mają w kontrakcie dwa przykłady: ligowy (domyślny) i pucharowy. Żeby mock
oddał drabinkę, dołóż do żądania nagłówek `Prefer: example=puchar`. Osobny
przełącznik, `Prefer: example=koszykowka`, oddaje turniej koszykarski —
obsługują go publiczne tabele **i** `/public/t/{slug}`, więc oba widoki mówią
o tym samym sporcie, a zdobycze nazywają się w nim „Punkty", a nie „Bramki".
Tabele panelu (`/tournaments/{tournament}/standings`) mają ten sam przełącznik
i te same przykłady, ale `/tournaments/{tournament}` nie ma jeszcze wariantu
koszykarskiego.

Aplikacje domyślnie celują w mock. Żeby przełączyć je na Laravela, skopiuj
`.env.example` do `.env` w danej aplikacji i ustaw `VITE_API_URL`.

Backend: `make up`, `make shell`, `make test` (patrz [`docs/BACKEND.md`](docs/BACKEND.md)).

Pozostałe skrypty w rootcie: `contract:validate`, `contract:generate`, `lint`,
`typecheck`, `test`, `build`.

### Testy frontendu

`npm test` w rootcie puszcza vitesta w tych workspace'ach, które mają skrypt
`test` — dziś `apps/admin` i `apps/public` (vitest + Testing Library + msw,
jsdom). Obie aplikacje mają ten sam układ: `vitest.config.ts` osobno od
`vite.config.ts` oraz `src/test/{server,setup}.ts`.

Żądania w testach obu aplikacji przechwytuje msw. Jedna pułapka jest na tyle
kosztowna, że warto o niej wiedzieć przed pierwszym testem: `server.listen()`
musi siedzieć **w zasięgu modułu** pliku `src/test/setup.ts` danej aplikacji,
nie w `beforeAll` — inaczej dostajesz ciche `TypeError: fetch failed`. Powód
siedzi w komentarzu przy `src/test/server.ts`, razem z zasadą, że handlerów
domyślnych nie ma, a `onUnhandledRequest: 'error'` pilnuje reszty.

Wybór tego mechanizmu — zamiast testów kontraktowych po mocku albo Chromatica
rozciągniętego na aplikacje — rozstrzyga
[#37](https://github.com/dawer2253/sports-tournament-app/issues/37).

## Zasady globalne

- **Menedżer pakietów: npm.** Instaluj z roota, nie z podkatalogów.
- Treść UI, komentarze i commity: **po polsku**; nazwy kodu (zmienne, typy, API)
  po angielsku. Jedyny wyjątek to słowo zamykające issue w opisie PR-a —
  `Closes #16`, bo GitHub nie rozpoznaje polskiego (patrz
  [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)).
- Commity: krótki tytuł po polsku z prefiksem obszaru (`DS:`, `Admin:`,
  `Public:`, `API:`, `CI:`, `Design:`, `Init:`, `Backend:`, `Docs:`).
  `Admin:` i `Public:` to zmiany w `apps/admin` i `apps/public`; `DS:` zostaje
  dla `packages/ui`. Zmiana obejmująca aplikację i design system bierze prefiks
  tego obszaru, w którym leży jej sedno.
- Nazywając byt domenowy, użyj terminu z [`CONTEXT.md`](CONTEXT.md). Jeżeli go tam
  nie ma, to sygnał: albo wymyślasz język, którego projekt nie używa, albo słownik
  ma lukę.
- Dwie nazwy w schemacie kolidują ze słowami zarezerwowanymi i **zostają**, bo są
  kanoniczne: tabela `groups` (`GROUPS` jest zarezerwowane w MySQL 8 od 8.0.2)
  oraz kolumna `order` w `stages` i `rounds`. Query Builder i Eloquent cytują
  identyfikatory backtickami, więc problem pojawia się wyłącznie w surowym SQL-u —
  **w `DB::raw`, `whereRaw` i `selectRaw` cytuj je backtickami.** Dotyczy to
  zwłaszcza `StandingsCalculator`.

### `packages/ui`

Konsumowany ze **źródeł**, bez kroku builda. Wewnątrz pakietu obowiązują ścieżki
względne: alias `@/` należy do aplikacji i wskazuje ich własne `src`. Generator
shadcn nadal wypisuje `@/`, więc po `npx shadcn add ...` uruchom
`npm run fix-imports -w @tournament/ui`.

Komponent importujący własne assety (zdjęcia) nie trafia do barrel-a `src/index.ts`,
bo Vite emituje takie pliki niezależnie od tree-shakingu. Wyjątki są opisane w tym
pliku przy odpowiednim eksporcie.

## CI/CD

- [`ci.yml`](.github/workflows/ci.yml) — walidacja kontraktu, zgodność klienta,
  lint, typy, testy frontendu, build oraz job backendu (Pint w trybie `--test`, Pest; testy
  Spectatora są bramką zgodności z `openapi.yaml`). Backend chodzi tam
  **natywnie, bez Saila**, a jego job odpala się tylko przy zmianach w
  `backend/**`, w kontrakcie i w samym `ci.yml`. Obie decyzje niosą pułapki
  (wersje PHP i MySQL-a muszą nadążać za `backend/compose.yaml`, a filtr ścieżek
  wymaga osobnego joba) — powody siedzą w komentarzach przy odpowiednich jobach,
  żeby nie rozjeżdżały się z konfiguracją.
- [`chromatic.yml`](.github/workflows/chromatic.yml) — regresja wizualna
  Storybooka. Wymaga sekretu `CHROMATIC_PROJECT_TOKEN`.

## Setup dla nowych osób

Środowisko: [`README.md`](README.md). Konfiguracja agenta i skilli, niezależnie od
używanego narzędzia: [`docs/AGENTS-SETUP.md`](docs/AGENTS-SETUP.md).

## Agent skills

### Issue tracker

Issues żyją w GitHub Issues repo `dawer2253/sports-tournament-app` (CLI `gh`).
Zobacz [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Domyślne, kanoniczne etykiety (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`). Zobacz [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` w rootcie. Zobacz
[`docs/agents/domain.md`](docs/agents/domain.md).

### Twierdzenia o stanie repo

Dotyczy wszystkiego, co agent publikuje poza kodem: briefów triage'owych,
komentarzy w trackerze, opisów PR-ów, przeglądów.

- **Twierdzenie o stanie repo wymaga polecenia, które je pokazuje.** Nie
  „`apps/admin` ma vitest", tylko „`grep vitest apps/admin/package.json`".
  Czytelnik ma móc wkleić to polecenie i zobaczyć to samo. Zmyślenie wyniku
  polecenia jest znacznie trudniejsze niż zmyślenie samego zdania — i o to chodzi.
- **Czego nie sprawdziłeś, tego nie twierdź — napisz, że nie sprawdziłeś.**
  Zdanie „nie odtwarzałem tego wiersza, biorę go z opisu" jest pełnoprawną
  częścią przeglądu, nie przyznaniem się do porażki.
- **Szczegół bez pokrycia jest gorszy niż ogólnik.** „Cztery pliki testowe"
  brzmi wiarygodniej niż „są testy", więc mniej zachęca do sprawdzenia. Liczby,
  nazwy plików i cytaty z konfiguracji podawaj wyłącznie odczytane.
- **Zanim powołasz się na precedens w repo, otwórz go.** Rekomendacja
  („zróbmy to wariantem 1") i stan faktyczny („wariant 1 już stoi w X") to dwa
  różne zdania; pomylenie ich odwraca sens ticketu.

Precedens: brief na #37 orzekł, że `apps/admin` ma vitest, Testing Library, msw
i cztery pliki testowe. Nie ma żadnej z tych rzeczy — a opis PR-a, na którym
brief się opierał, mówił to wprost.
