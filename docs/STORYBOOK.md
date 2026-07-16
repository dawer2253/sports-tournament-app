# Design system i Storybook (packages/ui)

Biblioteka komponentów, ekrany (makiety) i specyfikacje UI aplikacji TournamentApp.

## Stack
- React + TypeScript + Vite
- Tailwind v4 (`@tailwindcss/vite`, tokeny oklch, `@theme inline`)
- shadcn/ui (styl `radix-nova`, na Radix UI) — `components.json`
- Storybook 10 (react-vite) + addon-docs (MDX)
- Motyw: **northern-lights** (tweakcn)

## Uruchomienie
```bash
cd packages/ui
npm install
npm run storybook   # http://localhost:6006
```
Przełącznik **Motyw** (pasek narzędzi u góry) zmienia tryb jasny/ciemny.

Inne komendy:
```bash
npm run build-storybook   # statyczny build (storybook-static/)
npx tsc -b                # type-check
```

## Struktura
```
src/
  components/
    ui/          — komponenty shadcn (button, card, table, tabs, dialog…)
    layout/      — AdminShell, PublicShell (wspólne layouty)
  screens/       — ekrany: <nazwa>.tsx + <nazwa>.stories.tsx + <nazwa>.mdx (spec)
  lib/
    demo-data.ts — spójne dane demo dla wszystkich ekranów
    utils.ts     — cn()
  index.css      — tokeny motywu (:root / .dark), @theme inline, custom variants
  Introduction.mdx — strona startowa design systemu
```

## Ekrany
- **Admin:** Logowanie, Dashboard, Kreator turnieju, Drużyny, Terminarz, Wynik meczu, Drabinka, Obiekty, Statystyki, Branding i ustawienia.
- **Public:** Przegląd, Tabela, Terminarz, Wyniki, Drabinka, Strzelcy.

Każdy ekran ma stronę specyfikacji (`.mdx`) w formacie: Cel → Dane → Reguły → Stany → Zachowanie → Otwarte pytania.

## Konwencje
- Importy przez alias `@/` (`@/components/ui/...`, `@/lib/...`).
- Kolory wyłącznie przez tokeny motywu (`bg-primary`, `text-muted-foreground`, `bg-brand`…), nie surowe kolory Tailwind.
- Typy importowane przez `import type` (verbatimModuleSyntax).
- Ekrany admina owinięte w `AdminShell`, publiczne w `PublicShell`.

## Zmiana motywu
Motyw to zestaw zmiennych CSS. Aby podmienić: wygeneruj theme w tweakcn i wklej bloki `:root` / `.dark` do `src/index.css` (zachowując `--brand`, `@theme inline` i sekcję custom variants). Alternatywnie:
```bash
npx shadcn@latest add <url-theme-z-tweakcn> -o
```

## Uwaga: custom variants
Komponenty `radix-nova` wymagają wariantów `data-horizontal`, `data-vertical`, `data-active`
(zdefiniowanych w `src/index.css`). Bez nich m.in. `Tabs` renderują się błędnie.
