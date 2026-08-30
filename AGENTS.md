# Sports Tournament App

Aplikacja do zarządzania turniejami sportowymi (liga / puchar): panel **admin**
+ widoki **public**. Domena po polsku (drużyny, mecze, tabela, strzelcy,
terminarz, drabinka), nazwy w kodzie po angielsku.

Słownik pojęć: [`CONTEXT.md`](CONTEXT.md). Decyzje trudne do odwrócenia:
[`docs/adr/`](docs/adr/).

## Stan projektu (sierpień 2026)

Stoi fundament: monorepo, kontrakt API, dwie aplikacje React pracujące na mocku
kontraktu oraz szkielet backendu. **Laravel 13 na Sailu już stoi**, ale nie ma
jeszcze warstwy API — uruchomienie i stan środowiska opisuje
[`docs/BACKEND.md`](docs/BACKEND.md).

## Monorepo

npm workspaces, jeden `package-lock.json` w rootcie. Bez Turborepo.

| Katalog | Zawartość |
|---|---|
| `packages/api-contract/` | `openapi.yaml` — **jedyne źródło prawdy o API** |
| `packages/api-client/` | typy i klient TS generowane z kontraktu |
| `packages/ui/` | design system + ekrany w Storybooku ([własny `AGENTS.md`](packages/ui/AGENTS.md)) |
| `apps/admin/` | panel organizera (logowanie, port 5173) |
| `apps/public/` | strona turnieju (bez logowania, port 5174) |
| `backend/` | Laravel 13 + Sail (MySQL) ([własny `AGENTS.md`](backend/AGENTS.md)); API dochodzi w kolejnych ticketach |

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
oddał drabinkę, dołóż do żądania nagłówek `Prefer: example=puchar`.

Aplikacje domyślnie celują w mock. Żeby przełączyć je na Laravela, skopiuj
`.env.example` do `.env` w danej aplikacji i ustaw `VITE_API_URL`.

Backend: `make up`, `make shell`, `make test` (patrz [`docs/BACKEND.md`](docs/BACKEND.md)).

Pozostałe skrypty w rootcie: `contract:validate`, `contract:generate`, `lint`,
`typecheck`, `build`.

## Zasady globalne

- **Menedżer pakietów: npm.** Instaluj z roota, nie z podkatalogów.
- Treść UI, komentarze i commity: **po polsku**; nazwy kodu (zmienne, typy, API)
  po angielsku. Jedyny wyjątek to słowo zamykające issue w opisie PR-a —
  `Closes #16`, bo GitHub nie rozpoznaje polskiego (patrz
  [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md)).
- Commity: krótki tytuł po polsku z prefiksem obszaru (`DS:`, `API:`, `CI:`,
  `Design:`, `Init:`, `Backend:`, `Docs:`).
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
  lint, typy, build. Job backendu (Pint, Pest) jeszcze nie wchodzi w skład CI.
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
