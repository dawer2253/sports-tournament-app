# Backlog — Sports Tournament App

Oznaczenia: **D**=Dawid, **W**=Wojtek, **J**=Julka, **(zespół)**=parowanie.

## S0 — Fundament (zespół)

Kolejność jest tu istotna: kontrakt API powstaje **przed** kodem, żeby trzy osoby
mogły ruszyć równolegle. Szczegóły w [`docs/adr/0001`](adr/0001-kontrakt-openapi-jako-zrodlo-prawdy.md).

Zrobione:
- [x] Monorepo na npm workspaces: `/apps/{admin,public}`, `/packages/{ui,api-contract,api-client}` (D)
- [x] Kontrakt `openapi.yaml` v0.1 + mock (Prism) + generowany klient TS (D)
- [x] `packages/ui` jako pakiet workspace, konsumowany ze źródeł (D)
- [x] Scaffolding 2× React/Vite + react-router + TanStack Query, podpięte pod mock (D)
- [x] CI: walidacja kontraktu, lint, typy, build frontendu (D)

Do zrobienia:
- [ ] **Wspólny przegląd `openapi.yaml`** przed pisaniem kodu przeciw niemu (zespół)
- [ ] Laravel + Sail (`make up` działa u wszystkich trzech) — [`docs/BACKEND.md`](BACKEND.md) (W)
- [ ] Sanctum (Bearer) + prefiks `/api/v1` + Spectator wpięty w Pest (W)
- [ ] CI: dołożyć joba backendu (Pint, Pest, asercje zgodności z kontraktem) (W)
- [ ] Migracje bazowe: users, sports, tournaments, stages, groups, rounds, teams, players, venues, matches, match_events (zespół)
- [ ] Seed sportów + dane demo pod mock i pod testy (zespół)
- [ ] `apps/admin`: layout panelu i ekran listy turniejów na mocku (J)
- Kamień: login end-to-end (najpierw przeciw mockowi, potem przeciw Laravelowi)

## S1 — Dane podstawowe (J prowadzi)
- [ ] CRUD turnieje (+ slug, branding, format, sport) — BE+admin (J)
- [ ] CRUD drużyny + zawodnicy — BE+admin (J)
- [ ] CRUD venues — BE+admin (W)
- [ ] Seed sportów (piłka, kosz) + `SportRules` (D) — tu ustalamy domyślną punktację i kolejność tiebreaków per sport (decyzja #25)
- [ ] Policies + nested route binding (autoryzacja przez Tournament.user_id) (J)

## S2 — Liga (D prowadzi) → Demo #1
- [ ] Generator round-robin (circle method + bye + 1/2 rundy) (D) — bye zostaje wewnątrz generatora, nie trafia do terminarza (decyzja #24)
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
- [ ] Kwalifikacja N najlepszych → automatyczne rozstawienie krzyżowe drabinki (W)
- [ ] Ręczna korekta par przed startem fazy (nadpisuje automat, decyzja #23) (W)
- [ ] Dopracowanie strzelców + brandingu (J)
- Kamień: pełny zakres formatów

## S6 — Stabilizacja (zespół)
- [ ] Feature-testy API kluczowych ścieżek (zespół)
- [ ] Poprawki UX po testach z makiet (zespół)
- [ ] Deploy + dane demo (seeders) (W)
- [ ] Dokumentacja / rozdziały pracy (każdy swój wycinek)
