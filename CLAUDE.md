# Sports Tournament App

Aplikacja do zarządzania turniejami sportowymi (liga / puchar): panel **admin**
+ widoki **public**. Domena po polsku (drużyny, mecze, tabela, strzelcy,
terminarz, drabinka).

## Stan projektu (lipiec 2026)

Na razie istnieje **tylko design system + statyczne ekrany w Storybooku**
(`packages/ui`). Reszta (backend, API, baza, właściwy frontend) jest
**planowana** — `.gitignore` rezerwuje już `/backend/`.

## Monorepo

- **`packages/ui/`** — design system (shadcn/ui) + ekrany w Storybooku.
  **Cała dzisiejsza praca dzieje się tutaj** → szczegóły w
  [`packages/ui/CLAUDE.md`](packages/ui/CLAUDE.md).
- _(przyszłość)_ `backend/`, `apps/…` — jeszcze nie istnieją.

Root nie ma jeszcze `package.json` ani workspaces — każdy pakiet jest
samodzielny. Polecenia npm uruchamiaj po `cd packages/ui`.

## CI/CD

- **Chromatic** (regresja wizualna Storybooka) w
  [`.github/workflows/chromatic.yml`](.github/workflows/chromatic.yml). Odpala
  się na każdym PR-ze i po merge do `main`; buduje Storybooka w `packages/ui`
  (`build-storybook`) i publikuje snapshoty. Wymaga sekretu repo
  `CHROMATIC_PROJECT_TOKEN` (Settings → Secrets and variables → Actions).

## Zasady globalne

- **Menedżer pakietów: npm** (jest `package-lock.json`; nie pnpm/yarn).
- Treść UI, komentarze i commity: **po polsku**; nazwy kodu (zmienne, typy,
  API) po angielsku.
- Commity: krótki tytuł po polsku z prefiksem obszaru — jak w historii
  (`DS:`, `Font:`, `Design:`, `Init:`).

## Setup dla nowych osób

Konfiguracja skilli (`docs/agents/`, sekcja niżej) jest w repo — nie trzeba jej
odtwarzać. Dwie rzeczy trzeba jednak zrobić lokalnie u siebie:

1. **Wtyczka `mattpocock-skills`** w Claude Code (`/plugin`) — bez niej komendy
   `/triage`, `/to-tickets`, `/to-spec`, `/wayfinder` po prostu nie istnieją.
   Pliki w `docs/agents/` mówią skillom _jak_ działać, ale ich nie dostarczają.
2. **`gh` CLI** zainstalowany i zalogowany (`gh auth login`) — na nim opiera się
   cała obsługa issues.

Etykiety triage są już założone po stronie GitHuba — nic z nimi nie robisz.

## Agent skills

### Issue tracker

Issues żyją w GitHub Issues repo `dawer2253/sports-tournament-app` (CLI `gh`).
Zobacz [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Domyślne, kanoniczne etykiety (`needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`). Zobacz
[`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` w rootcie. Zobacz
[`docs/agents/domain.md`](docs/agents/domain.md).
