# Deploy Storybooka (Chromatic)

Storybook (`packages/ui`) publikujemy na Chromatic — daje stały link dla zespołu i nowy link na każdy build.

## Jednorazowa konfiguracja
1. Wejdź na https://www.chromatic.com i zaloguj się (najprościej przez GitHub).
2. Utwórz projekt: **Add project** → wskaż repo (lub wybierz „I don't have a repository yet").
3. Skopiuj **project token** (postać `chpt_xxxxxxxxxxxx`).

## Publikacja
Z katalogu `packages/ui`:
```bash
cd packages/ui
npx chromatic --project-token=<TWÓJ_TOKEN>
```
Po zakończeniu Chromatic wypisze **link do opublikowanego Storybooka** — ten wysyłasz współpracownikom.

Alternatywnie (token w zmiennej środowiskowej):
```bash
export CHROMATIC_PROJECT_TOKEN=<TWÓJ_TOKEN>
npm run chromatic
```

Skrypt `chromatic` jest już w `package.json` (buduje `build-storybook` i publikuje).

## Aktualizacja
Po zmianach w komponentach/ekranach commitujesz i uruchamiasz `npx chromatic ...` ponownie — powstaje nowy build i (opcjonalnie) diff wizualny względem poprzedniego.

## Auto-deploy na GitHub (opcjonalnie, później)
Gdy repo trafi na GitHuba, można publikować automatycznie po każdym push:
1. W repo GitHub: **Settings → Secrets and variables → Actions** → dodaj `CHROMATIC_PROJECT_TOKEN`.
2. Workflow `.github/workflows/chromatic.yml`:
```yaml
name: Chromatic
on: push
jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
        working-directory: packages/ui
      - uses: chromaui/action@latest
        with:
          workingDir: packages/ui
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

## Uwaga
Opublikowany Storybook jest dostępny pod linkiem (domyślnie publicznym). To makiety/design system — bez danych wrażliwych — więc dla projektu inżynierskiego jest to akceptowalne.
