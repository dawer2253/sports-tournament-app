# packages/ui — Design system & ekrany

React 19 + TypeScript 6 + Vite 8. Biblioteka komponentów (shadcn/ui, styl
`radix-nova`) oraz statyczne ekrany aplikacji turniejowej, prezentowane w
**Storybooku 10**. Nie ma jeszcze logiki ani API — ekrany renderują mocki z
`src/lib/demo-data.ts`.

## Komendy (uruchamiaj z `packages/ui/`)

| Cel | Komenda |
|---|---|
| Storybook (dev, `:6006`) | `npm run storybook` |
| Lint | `npm run lint` (oxlint) |
| Typy + build | `npm run build` (`tsc -b` + `vite build`) |
| Testy (Storybook + Vitest, Chromium headless) | `npx vitest` (CI: `npx vitest run`, patrz „Testy frontendu" w root `AGENTS.md`) |
| Testy reguł w `src/**/*.test.ts` (projekt `unit`, node) | `npx vitest run --project unit` |
| Regresja wizualna | `npm run chromatic` |
| Statyczny Storybook | `npm run build-storybook` |

Weryfikacja w przeglądarce jest już podpięta (`.claude/launch.json` →
Storybook na `:6006`), więc podgląd działa bez konfiguracji.

## Struktura `src/`

- `components/ui/` — prymitywy interfejsu (Button, Card, Dialog, Table…). Tutaj
  trafiają komponenty z `npx shadcn add`, ale też pisane ręcznie, gdy shadcn
  nie ma odpowiednika (`empty-state.tsx`). Nie dzielimy prymitywów po tym,
  skąd pochodzą.
- `components/data/` — komponenty prezentujące dane z API (np.
  `tournaments-table.tsx` na TanStack Table). Same przyjmują dane propsami:
  pakiet nie zna klienta API ani TanStack Query. Typ wiersza mieszka w osobnym
  pliku obok komponentu (`tournament-row.ts`), żeby `lib/demo-data.ts` mogło go
  użyć bez importowania komponentu — inaczej dane demo i komponent zamykają się
  w cyklu. Zgodność takiego typu z kontraktem pilnuje strażnik w aplikacji
  (`apps/admin/src/lib/contract-guard.ts`), bo pakiet nie zna kontraktu.
- `components/layout/` — `admin-shell.tsx` (panel z sidebarem) i układ
  panelu. Każdy ekran panelu opakowuje się w ten shell. Shell strony
  publicznej leży w `src/public/` (niżej).
  **Komponenty z `components/` nie importują `lib/demo-data.ts`**: dane mock
  należą do `screens/`. Dlatego `AdminShell` wymaga propsa `user`, a ekrany
  Storybooka biorą `screens/shell-demo.tsx`, który dokłada konto demo. Fikcyjne
  konto jako wartość domyślna trafiałoby do bundla panelu i przy pominiętym
  propsie wyglądałoby jak prawdziwe.
- `screens/` — ekrany aplikacji (wzorzec niżej) oraz wrappery dla nich. Wrapper
  nie jest ekranem: nie bierze prefiksu `admin-`/`public-` i nie ma
  `.stories.tsx` ani `.mdx` (`shell-demo.tsx`).
- `foundations/` — dokumentacja fundamentów panelu (paleta, tokeny) w Storybooku.
- `public/` — **strona publiczna** (S7, #289): shell, klocki i ekrany
  w osobnym języku (wariant C „Kolejka”), bez shadcn. Szczegóły w sekcji
  „Strona publiczna” niżej.
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge).
- `lib/demo-data.ts` — **jedno źródło** danych mock dla wszystkich ekranów
  (docelowo z API). Dokładając ekran, dane bierz stąd; nowe encje dopisuj tu.
- `test/` — pomocnicze asercje dla funkcji `play` w stories (np.
  `expectDarkPortal` w `theme.ts`). Nie myl z `src/test/` w aplikacjach, gdzie
  leży setup msw.

## Tytuły stories i sidebar

Tytuł story (`meta.title`) to ścieżka pliku: sidebar powtarza układ `src/`,
a separatorem grup jest `/`. Znaku `·` nie używamy — Storybook go nie
interpretuje i zrobiłby z całej ścieżki jeden liść.

Sidebar ma **dwa korzenie**: `Panel/…` i `Strona publiczna/…`.

**Panel** (wszystko poza `src/public/`):

- **Ekrany**: `Panel/Ekrany/Admin/Nazwa` (nazwa liścia po polsku).
- **Komponenty**: `Panel/UI/<sekcja>/Nazwa`, gdzie sekcja bierze nazwę
  z funkcji katalogu: `components/layout` → `Układ`, `components/data` →
  `Dane`, `components/ui` → `Prymitywy`.
- **Fundamenty**: `Panel/Fundamenty/…` (tytuł strony „Panel/Fundamenty/Design
  system" siedzi w `<Meta>` pliku `.mdx`, nie w stories).

**Strona publiczna**:

- `Strona publiczna/Wprowadzenie` i `Strona publiczna/Fundamenty` (`.mdx`
  w `src/public/`).
- `Strona publiczna/Komponenty/Nazwa` — shell i klocki z `src/public/`.
- `Strona publiczna/Ekrany/Nazwa` — ekrany z `src/public/screens/`; ekran
  z kilkoma formatami dostaje podgałąź z plikiem na format
  (`Strona publiczna/Ekrany/Przegląd/Puchar`).

Kolejność: `Panel` (`Wprowadzenie → Fundamenty → UI → Ekrany`), potem
`Strona publiczna` (`Wprowadzenie → Fundamenty → Komponenty → Ekrany`);
`parameters.options.storySort.order` w `.storybook/preview.tsx`.

## Wzorzec ekranu panelu — trójka plików

**Ekran jest odbiciem wdrożonego ekranu.** Ten sam układ, ten sam nagłówek
i te same wspólne komponenty co w `apps/*`; różni się tylko źródłem danych (demo
z `../lib/demo-data`) i tym, że akcje są nieaktywne. Zanim narysujesz ekran,
przeczytaj jego odpowiednik w aplikacji.

- Czego aplikacja nie ma, tego ekran nie rysuje. Makieta funkcji bez endpointu
  albo bez trasy w aplikacji to fikcja, która rozjeżdża się w pierwszą stronę.
- Co w aplikacji jest oknem, zostaje oknem i nie dostaje osobnego ekranu.
- Gdy i aplikacja, i ekran potrzebują tego samego komponentu, komponent idzie
  do `packages/ui` (tak trafił tu `ChoiceCards`), żeby obie strony miały jedną
  kopię. Ekran nie kopiuje znaczników z aplikacji.
- Ekran bez odpowiednika w aplikacji usuwamy razem z jego stories i `.mdx`.

Każdy ekran to trzy pliki o wspólnej nazwie w `src/screens/`
(`kebab-case`, prefiks `admin-`; ekrany strony publicznej mają własny
wzorzec, sekcja „Strona publiczna” niżej), np. dla `admin-teams`:

1. **`admin-teams.tsx`** — komponent. Eksport nazwany PascalCase
   (`export function AdminTeams()`), opakowany w `screens/shell-demo.tsx`
   (`ShellDemo` / `TournamentShellDemo`), dane
   z `../lib/demo-data`.
2. **`admin-teams.stories.tsx`** — story:
   ```tsx
   const meta = {
     title: 'Panel/Ekrany/Admin/Drużyny',
     component: AdminTeams,
     parameters: { layout: 'fullscreen' },
   } satisfies Meta<typeof AdminTeams>
   export const Domyslny: Story = {}
   ```
3. **`admin-teams.mdx`** — specyfikacja z `<Canvas of={Stories.Domyslny} />`
   i sekcjami: Cel / Dane / Reguły / Stany / Zachowanie / Otwarte pytania.

Tytuły stories po polsku: `Panel/Ekrany/Admin/Nazwa` (patrz „Tytuły stories
i sidebar"). Ekran strony publicznej idzie wzorcem z sekcji „Strona
publiczna” niżej.

## Reguły design systemu (nie łam)

- **Nagłówki tylko przez `<Heading>`** (`components/ui/typography.tsx`). Reguła
  „H1 = WERSALIKI" żyje w `headingVariants` — nie pisz własnych
  `<h1 className="uppercase">`. Poziomy: `page` (h1, wersaliki), `section`
  (h2), `card` (h3); `as` nadpisuje znacznik bez zmiany stylu.
- **Kolory tylko z tokenów** — zmienne CSS / klasy Tailwind (`bg-primary`,
  `text-muted-foreground`…), nigdy hexy. Motyw „pitch": jedna zieleń marki
  (`--primary` / `--brand`) to jedyny nasycony kolor chromy; reszta to
  neutralna, chłodna rampa; wielobarwność wyłącznie w danych (`--chart-1..5`).
  Wyjątek: treść obrazka w danych demo i stories (np. logo w adresie `data:`)
  ma własne kolory, jak plik wgrany przez organizera, bo nie jest chromą
  interfejsu.
- **Dark mode** — każdy token ma wariant w `.dark`; w Panelu testuj oba
  przełącznikiem „Motyw" w toolbarze Storybooka. Strona publiczna jest zawsze
  ciemna i przełącznika „Motyw” nie słucha.
- **Klasy zawsze przez `cn()`**; warianty komponentów przez
  `class-variance-authority`, nie warunkowe stringi inline.
- **Ikony `lucide-react`**, rozmiar przez `className="size-4"`.
- **Dostępność** — `aria-label` na przyciskach ikonowych (jest `addon-a11y`).
- Importy **względne** wewnątrz pakietu (alias `@/` należy do `apps/*`).
  `--radius: 0.375rem`.
- **Kroje** z `@fontsource`, bez CDN: panel **Inter** (400–800, import
  w `src/index.css`), strona publiczna **Barlow** (400–600) i **Barlow
  Condensed** (500–800), import w `src/public/theme.css`, więc panel ich nie
  ładuje.

## Dodawanie komponentu shadcn

`npx shadcn@latest add <nazwa>` — styl `radix-nova`, baseColor `neutral`,
ikony lucide, `tsx: true`, bez RSC (patrz `components.json`).

## Stack (bleeding edge — sprawdzaj dokumentację, nie pamięć modelu)

Tailwind **v4** (konfiguracja w CSS przez `@theme` w `src/index.css`, **nie**
`tailwind.config.js`), Storybook **10**, Vite **8**, React **19**,
TypeScript **6**, oxlint, Chromatic. Testy: Vitest 4 + Playwright (browser
mode) przez `@storybook/addon-vitest`.

## Strona publiczna (`src/public/`)

Decyzje: #287, #288, #289 (mapa S7 #286). Wzorzec z rozstrzygnięcia #289
pkt 8 zastępuje tu trójkę plików panelu.

- **Kod**: shell (`shell.tsx`), klocki (`crest.tsx`, `tournament-logo.tsx`,
  `form.tsx`, `score-cell.tsx`, `live.tsx`, `button.tsx`, `board.tsx`,
  `skeleton.tsx`, `heads.tsx`, `anchor.tsx`), wiersz meczu i lista kolejek
  Terminarza i Wyników (`match-row.tsx`, `round-sections.tsx`; porcje liczy
  `roundsPage` w `components/data/round-groups.ts`), tabela z formą i pasem
  „Mistrz” (`standings-table.tsx`, wiersz w `standings-table-row.ts`, fakty
  terminarza z `schedule-progress.ts`; forma w kodach kontraktu
  `win`/`draw`/`loss`, litery mapuje tylko `form.tsx`), Drabinka
  (`bracket.tsx`: kafle i drzewo w oknie rund; zdania notki o rozjeździe
  i wychodzących z grup w `bracket-notes.ts`), zakładki
  (`public-nav.ts`), typ turnieju w pasku (`public-shell-tournament.ts`),
  Statystyki (`stats.tsx`: zakładki, lider, klasyfikacja i liderzy
  pozostałych), strona meczu (`match-board.tsx`, `match-relation.tsx`),
  Przegląd (`stage-band.tsx`: pas etapu z tablicami meczów,
  `teams-showcase.tsx`: prezentacja drużyn przed terminarzem; wybór etapu
  w `overview-stage.ts`) i ekrany w `screens/`. Panelowy `MatchRow`
  z `components/data` zostaje dla panelu.
- **Barrel** `src/public/index.ts`, import `@tournament/ui/public`, nazwy bez
  przedrostka. Re-eksportuje logikę, której strona potrzebuje (`brandVars`,
  `groupByRound`, `formatKickoff`…); ta logika zostaje tam, gdzie jest.
  Barrel panelu (`src/index.ts`) `src/public` nie re-eksportuje.
- **Reguła lintera** (`.oxlintrc.json`, `overrides`): w `src/public/**` nie
  wolno importować z `components/ui` ani `components/layout`. Logikę wspólną
  przenosimy do `lib/` (tak trafiły tam `teamAbbr` i `useImageFallback`),
  a klocek piszemy w `src/public/`. `components/data` wolno.
- **Motyw** w `src/public/theme.css`: tokeny `--pub-sunken`, `--pub-hairline`,
  `--pub-rule`, kroje `--font-display`/`--font-body`, skala 13 / 14 / 16 /
  20 / 28 / 40 / 64 / 120 i narzędzia `pub-score`, `pub-title`, `pub-h2`,
  `pub-h3`, `pub-num`, `pub-tab`, `pub-brand-fill`. Tokeny `.dark` w
  `src/index.css` zostają bez zmian. Storybook ładuje oba arkusze w jednym
  przebiegu Tailwinda (`.storybook/preview.css`).
- **Zawsze ciemna**: `class="dark"` na `<html>` (`apps/public/index.html`),
  korzeń shella ma `.public-site` i `brandVars(primaryColor)` z
  `lib/brand-on-dark.ts` (`--brand`, `--brand-foreground`, `--brand-line`
  ≥ 3:1 z kartą, `--brand-text` ≥ 4,5:1, `--brand-line-foreground`).
  Wypełnienie kolorem turnieju zawsze przez `pub-brand-fill` (obrys w
  `--brand-line`). „Na żywo” zawsze w `--destructive`.
- **Wersaliki** tylko w nazwie turnieju w pasku, nazwach drużyn na tablicach
  i tytule nagłówka ekranu. Nagłówki sekcji i belki zdaniem. Barlow
  Condensed na wyniki, liczby, godziny, nagłówki i zakładki, Barlow na tekst.
- **Nagłówki**: nazwa turnieju w pasku to `h1`, nagłówek ekranu (`PageHead`)
  `h2`, belka sekcji (`SectionHead`) i stan pusty `h2`/`h3`. Klocki strony
  nie używają `<Heading>` z panelu.
- **Ekran** strony to komponent w `src/public/screens/` z danymi w propsach,
  bez pobierania i routera; adresy i nawigację dostaje jako `href` +
  `onNavigate` (`Anchor`). Story podaje demo, strona w `apps/public` pobiera
  dane i wybiera stan (`LoadingScreen`, `LoadError`, `MatchNotFound`…).
- **Stories** pod „Strona publiczna” są zawsze ciemne (dekorator w
  `.storybook/preview.tsx` + `public-root.tsx`) i owinięte w `.public-site`.
  Globalny przełącznik **„Kolor turnieju”** (próbki `BRAND_COLOR_SAMPLES`)
  nadpisuje kolor każdego `.public-site`, także korzenia shella. Story, które
  trzyma kolor z danych albo pokazuje kilka próbek naraz, ustawia
  `parameters: ownBrand` (`src/test/brand.ts`). Format i stan to osobne
  stories, bez pływających przełączników.

