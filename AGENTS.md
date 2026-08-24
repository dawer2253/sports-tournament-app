# Sports Tournament App

Aplikacja do zarządzania turniejami sportowymi (liga / puchar): panel **admin**
+ widoki **public**. Domena po polsku (drużyny, mecze, tabela, strzelcy,
terminarz, drabinka), nazwy w kodzie po angielsku.

Słownik pojęć: [`CONTEXT.md`](CONTEXT.md). Decyzje trudne do odwrócenia:
[`docs/adr/`](docs/adr/).

## Stan projektu (sierpień 2026)

Stoi fundament: monorepo, kontrakt API i dwie aplikacje React pracujące na mocku
kontraktu. **Backend nie istnieje** — jego pierwsze uruchomienie opisuje
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
| `backend/` | Laravel, jeszcze nie zainstalowany |

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

Aplikacje domyślnie celują w mock. Żeby przełączyć je na Laravela, skopiuj
`.env.example` do `.env` w danej aplikacji i ustaw `VITE_API_URL`.

Backend: `make up`, `make shell`, `make test` (patrz [`docs/BACKEND.md`](docs/BACKEND.md)).

Pozostałe skrypty w rootcie: `contract:validate`, `contract:generate`, `lint`,
`typecheck`, `build`.

## Zasady globalne

- **Menedżer pakietów: npm.** Instaluj z roota, nie z podkatalogów.
- Treść UI, komentarze i commity: **po polsku**; nazwy kodu (zmienne, typy, API)
  po angielsku.
- Commity: krótki tytuł po polsku z prefiksem obszaru (`DS:`, `API:`, `CI:`,
  `Design:`, `Init:`).
- Nazywając byt domenowy, użyj terminu z [`CONTEXT.md`](CONTEXT.md). Jeżeli go tam
  nie ma, to sygnał: albo wymyślasz język, którego projekt nie używa, albo słownik
  ma lukę.

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
  lint, typy, build. Job backendu dochodzi razem z Laravelem.
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
