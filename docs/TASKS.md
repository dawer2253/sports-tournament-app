# Backlog — Sports Tournament App

Oznaczenia: **D**=Dawid, **W**=Wojtek, **J**=Julka, **(zespół)**=parowanie.

## S0 — Fundament (zespół)
- [ ] Monorepo: `/backend`, `/apps/admin`, `/apps/public`, `/packages/{ui,api-client}` (zespół)
- [ ] Docker compose (PHP, MySQL, node) + `make up` (W)
- [ ] Laravel + Sanctum (Bearer) + szkielet `/api/v1` (J)
- [ ] Migracje bazowe: users, tournaments, teams, players, venues, stages, rounds, matches, match_events, sports (zespół)
- [ ] Scaffolding 2× React/Vite + shadcn + react-router (D)
- [ ] `packages/ui` + Storybook + motyw/tokens (J)
- [ ] `packages/api-client` (typowany fetch) (D)
- [ ] CI: GitHub Actions (Pint, Pest, ESLint) (W)
- Kamień: login end-to-end

## S1 — Dane podstawowe (J prowadzi)
- [ ] CRUD turnieje (+ slug, branding, format, sport) — BE+admin (J)
- [ ] CRUD drużyny + zawodnicy — BE+admin (J)
- [ ] CRUD venues — BE+admin (W)
- [ ] Seed sportów (piłka, kosz) + `SportRules` (D)
- [ ] Policies + nested route binding (autoryzacja przez Tournament.user_id) (J)

## S2 — Liga (D prowadzi) → Demo #1
- [ ] Generator round-robin (circle method + bye + 1/2 rundy) (D)
- [ ] Auto-rozkład dat (start + interwał) + ostrzeżenia kolizji (W)
- [ ] StandingsCalculator on-read (D)
- [ ] Tiebreaki + rejestr komparatorów + head-to-head mini-tabela (D)
- [ ] Admin: terminarz + wpisywanie wyniku (D)
- [ ] Drag&drop kolejności tiebreaków (admin) (D)
- [ ] Testy Pest: generator, tabela, tiebreaki (D)

## S3 — Eventy + Public (J prowadzi)
- [ ] MatchEvent CRUD (typy wg sportu) (J)
- [ ] Statystyki/strzelcy (agregacja z eventów) (J)
- [ ] Public: tabela + terminarz + wyniki (po slug) (J)
- [ ] Public: branding (logo/kolor) + polling (W)
- Kamień: publiczny link do pokazania

## S4 — Puchar (W prowadzi)
- [ ] BracketService (seeding, pary, `next_match_id`) (W)
- [ ] Cykl życia meczu + kaskada propagacji zwycięzcy (W)
- [ ] Admin: kreator/podgląd drabinki (W)
- [ ] Public: widok drabinki (W)
- [ ] Testy Pest: drabinka + kaskada (W)

## S5 — Grupy + playoff + dopięcie (W prowadzi)
- [ ] Faza grupowa (round-robin per grupa) (W)
- [ ] Kwalifikacja N najlepszych → zasilenie drabinki (W)
- [ ] Dopracowanie strzelców + brandingu (J)
- Kamień: pełny zakres formatów

## S6 — Stabilizacja (zespół)
- [ ] Feature-testy API kluczowych ścieżek (zespół)
- [ ] Poprawki UX po testach z makiet (zespół)
- [ ] Deploy + dane demo (seeders) (W)
- [ ] Dokumentacja / rozdziały pracy (każdy swój wycinek)
