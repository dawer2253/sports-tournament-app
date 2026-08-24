# Sports Tournament App

Aplikacja do prowadzenia turniejów sportowych: liga, puchar oraz grupy z playoffem.
Organizer zakłada turniej w panelu, a kibice oglądają tabelę, terminarz i wyniki
pod publicznym adresem.

Projekt inżynierski, zespół trzyosobowy. Zakres i harmonogram: [`docs/PLAN.md`](docs/PLAN.md).
Backlog z podziałem pracy: [`docs/TASKS.md`](docs/TASKS.md).

## Czego potrzebujesz

| Narzędzie | Po co | Uwagi |
|---|---|---|
| **Node 24** | frontend, kontrakt, mock | `nvm install 24` (jest `.nvmrc`) |
| **Docker** | backend | PHP, Composer i MySQL siedzą w kontenerach, na hoście ich nie instalujesz |
| **git** i **`gh`** | repo i issues | `gh auth login` |

Docker na Ubuntu: instrukcja jest w [`docs/BACKEND.md`](docs/BACKEND.md).

## Start

```bash
git clone git@github.com:dawer2253/sports-tournament-app.git
cd sports-tournament-app
nvm use
npm install
```

`npm install` uruchamiaj **z katalogu głównego**. To jedno repo z npm workspaces:
instalacja w podkatalogu rozjedzie wersje pakietów.

Teraz uruchom to, na czym pracujesz. Każde polecenie w osobnym terminalu:

```bash
npm run mock          # mock API na :4010, potrzebny obu aplikacjom
npm run dev:admin     # panel organizera, http://localhost:5173
npm run dev:public    # strona turnieju, http://localhost:5174/t/liga-osiedlowa-2026
npm run storybook     # design system, http://localhost:6006
```

Backend jeszcze nie istnieje. Aplikacje domyślnie gadają z mockiem, więc frontend
da się rozwijać bez Dockera i bez Laravela. Pierwsze postawienie backendu opisuje
[`docs/BACKEND.md`](docs/BACKEND.md), potem wystarczy `make up`.

> **Otwieraj `localhost`, nie `127.0.0.1`.** Vite nasłuchuje tu na IPv6 i pod
> adresem numerycznym dostaniesz "connection refused".

## Co gdzie leży

| Katalog | Zawartość |
|---|---|
| `packages/api-contract/` | `openapi.yaml`, jedyne źródło prawdy o API |
| `packages/api-client/` | typy i klient TypeScript generowane z kontraktu |
| `packages/ui/` | design system i ekrany w Storybooku |
| `apps/admin/` | panel organizera (logowanie) |
| `apps/public/` | strona turnieju (bez logowania) |
| `backend/` | Laravel, powstaje przy pierwszym `docs/BACKEND.md` |

## Jedna zasada, o której warto wiedzieć od razu

**API zaczyna się od kontraktu, nie od kodu.** Kolejność przy każdej zmianie:

1. zmieniasz `packages/api-contract/openapi.yaml`,
2. `npm run contract:generate`,
3. dopiero teraz piszesz backend i frontend.

Dzięki temu frontend pracuje na mocku, zanim endpoint powstanie, a backend ma czym
udowodnić zgodność w testach. CI odrzuca pull requesta, w którym wygenerowany
klient nie odpowiada specyfikacji. Uzasadnienie:
[`docs/adr/0001`](docs/adr/0001-kontrakt-openapi-jako-zrodlo-prawdy.md).

## Pozostałe polecenia

```bash
npm run contract:validate   # walidacja openapi.yaml
npm run contract:generate   # regeneracja klienta TS
npm run lint
npm run typecheck
npm run build
```

## Dokąd dalej

- [`AGENTS.md`](AGENTS.md) — konwencje repo. Czyta to agent, ale człowiekowi też się przyda.
- [`CONTEXT.md`](CONTEXT.md) — słownik domeny. Przeczytaj przed nazwaniem czegokolwiek.
- [`docs/AGENTS-SETUP.md`](docs/AGENTS-SETUP.md) — konfiguracja agenta i skilli, obojętnie czy używasz Claude Code, Cursora czy Antigravity.
- [`docs/adr/`](docs/adr/) — decyzje trudne do odwrócenia, wraz z powodami.
- [`packages/api-contract/README.md`](packages/api-contract/README.md) — praca z kontraktem i mockiem.
- [`docs/STORYBOOK.md`](docs/STORYBOOK.md) — design system.
- [`docs/BACKEND.md`](docs/BACKEND.md) — pierwsze uruchomienie Laravela.
