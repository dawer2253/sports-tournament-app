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
| Testy (Storybook + Vitest, Chromium headless) | `npx vitest` |
| Regresja wizualna | `npm run chromatic` |
| Statyczny Storybook | `npm run build-storybook` |

Weryfikacja w przeglądarce jest już podpięta (`.claude/launch.json` →
Storybook na `:6006`), więc podgląd działa bez konfiguracji.

## Struktura `src/`

- `components/ui/` — prymitywy shadcn (Button, Card, Dialog, Table…). Tutaj
  trafiają komponenty z `npx shadcn add`.
- `components/layout/` — `admin-shell.tsx` (panel z sidebarem) i
  `public-shell.tsx`. Każdy ekran opakowuje się w jeden z tych shelli.
- `screens/` — ekrany aplikacji (wzorzec niżej).
- `foundations/` — dokumentacja fundamentów (paleta, tokeny) w Storybooku.
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge).
- `lib/demo-data.ts` — **jedno źródło** danych mock dla wszystkich ekranów
  (docelowo z API). Dokładając ekran, dane bierz stąd; nowe encje dopisuj tu.

## Wzorzec ekranu — trójka plików

Każdy ekran to trzy pliki o wspólnej nazwie w `src/screens/`
(`kebab-case`, prefiks `admin-` / `public-`), np. dla `admin-teams`:

1. **`admin-teams.tsx`** — komponent. Eksport nazwany PascalCase
   (`export function AdminTeams()`), opakowany w `AdminShell`/`PublicShell`,
   dane z `@/lib/demo-data`.
2. **`admin-teams.stories.tsx`** — story:
   ```tsx
   const meta = {
     title: 'Ekrany/Admin · Drużyny',
     component: AdminTeams,
     parameters: { layout: 'fullscreen' },
   } satisfies Meta<typeof AdminTeams>
   export const Domyslny: Story = {}
   ```
3. **`admin-teams.mdx`** — specyfikacja z `<Canvas of={Stories.Domyslny} />`
   i sekcjami: Cel / Dane / Reguły / Stany / Zachowanie / Otwarte pytania.

Tytuły stories po polsku: `Ekrany/Admin · Nazwa` lub `Ekrany/Public · Nazwa`.
Kolejność w sidebarze: `Wprowadzenie → Fundamenty → UI → Ekrany`.

## Reguły design systemu (nie łam)

- **Nagłówki tylko przez `<Heading>`** (`components/ui/typography.tsx`). Reguła
  „H1 = WERSALIKI" żyje w `headingVariants` — nie pisz własnych
  `<h1 className="uppercase">`. Poziomy: `page` (h1, wersaliki), `section`
  (h2), `card` (h3); `as` nadpisuje znacznik bez zmiany stylu.
- **Kolory tylko z tokenów** — zmienne CSS / klasy Tailwind (`bg-primary`,
  `text-muted-foreground`…), nigdy hexy. Motyw „pitch": jedna zieleń marki
  (`--primary` / `--brand`) to jedyny nasycony kolor chromy; reszta to
  neutralna, chłodna rampa; wielobarwność wyłącznie w danych (`--chart-1..5`).
- **Dark mode** — każdy token ma wariant w `.dark`; testuj oba przełącznikiem
  „Motyw" w toolbarze Storybooka.
- **Klasy zawsze przez `cn()`**; warianty komponentów przez
  `class-variance-authority`, nie warunkowe stringi inline.
- **Ikony `lucide-react`**, rozmiar przez `className="size-4"`.
- **Dostępność** — `aria-label` na przyciskach ikonowych (jest `addon-a11y`).
- Alias `@/` → `src/`. Font **Inter**. `--radius: 0.375rem`.

## Dodawanie komponentu shadcn

`npx shadcn@latest add <nazwa>` — styl `radix-nova`, baseColor `neutral`,
ikony lucide, `tsx: true`, bez RSC (patrz `components.json`).

## Stack (bleeding edge — sprawdzaj dokumentację, nie pamięć modelu)

Tailwind **v4** (konfiguracja w CSS przez `@theme` w `src/index.css`, **nie**
`tailwind.config.js`), Storybook **10**, Vite **8**, React **19**,
TypeScript **6**, oxlint, Chromatic. Testy: Vitest 4 + Playwright (browser
mode) przez `@storybook/addon-vitest`.
