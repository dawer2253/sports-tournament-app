# Sports Tournament App — Plan wdrożenia (MVP / projekt inżynierski)

> Aplikacja do organizowania pojedynczych lig/turniejów (podobna do Tournify).
> Zespół: **Dawid**, **Julka**, **Wojtek**. Horyzont: **~1 semestr (3–4 mies.)**.

---

## 1. Decyzje (decision log)

| # | Temat | Decyzja | Uzasadnienie / uwagi |
|---|-------|---------|----------------------|
| 1 | Stack | Laravel 11 + Laravel Boost (REST API) · React + shadcn/ui (Vite, react-router) · MySQL | Bez SSR |
| 2 | Integracja FE/BE | **Osobne REST API + 2 osobne aplikacje React**: `admin` (CMS) i `public` | Czyste rozdzielenie |
| 3 | Repo | **Monorepo**: `/backend`, `/apps/admin`, `/apps/public`, `/packages/*` | Jeden setup dla 3 osób |
| 4 | Multi-tenancy | **Jedna baza**, izolacja przez właściciela | patrz #5 |
| 5 | Własność/Autoryzacja | **Organizer = User**; jedyny korzeń własności to `Tournament.user_id`; dzieci autoryzowane przez relację (Policies + nested route binding). **Bez** `organizer_id` w głąb. | Brak odnormalizacji; future work: globalne kluby |
| 6 | Konto organizatora | **Jeden owner + współdzielone konto** (bez ról współpracownika na MVP) | Prosty model |
| 7 | Formaty | **Liga (round-robin)**, **Puchar (single-elimination)**, **Grupy + playoff** (kompozycja) | Fazowane w czasie |
| 8 | Team / Player | **Per-turniej** (bez reużycia między turniejami) | Trade-off: brak historii międzysezonowej (→ future work) |
| 9 | Detal meczu | **Wynik + kluczowe eventy** (strzelcy, kartki) → rankingi/statystyki | |
| 10 | Sporty | **Predefiniowane w kodzie** (piłka, koszykówka) + **konfiguracja per-turniej w UI** (punktacja + kolejność tiebreaków drag&drop) | Nowy sport = zadanie dev |
| 11 | Tiebreaki | Uporządkowana, konfigurowalna lista per turniej (JSON), komparatory w rejestrze. **Head-to-head: mini-tabela + zejście do następnego kryterium (bez rekurencji)** | patrz §5 |
| 12 | Standings (tabela) | **Liczona on-read** z meczów (brak materializacji) | Zawsze spójna; materializacja = future work |
| 13 | Terminarz | **Auto-harmonogram** (data startu + interwał) + ręczne korekty | patrz §6 |
| 14 | Generator | Circle method + bye (nieparzyste) + równe odstępy dat + **ostrzeżenia o kolizjach** (bez solvera) | |
| 15 | Edycja wyniku | **Cykl życia meczu + kaskada w drabince** (zmiana zwycięzcy czyści dalsze rundy z ostrzeżeniem) | patrz §7 |
| 16 | Branding public | **Podstawowy**: logo + kolor wiodący + nazwa; publiczny link `/t/{slug}` | |
| 17 | Live | **Polling** (auto-odświeżanie co X s) na stronie publicznej | Realtime = future work |
| 18 | Auth API | **Token Bearer** (Sanctum, token w nagłówku Authorization); public bez auth | Prościej przy osobnych originach |
| 19 | Pliki (logo) | Lokalny dysk (`storage/`) | Nie S3 |
| 20 | Testy/CI | Pest (silnik + feature API) + GitHub Actions (lint+test na PR); front lekko | E2E = future work |
| 21 | API | `/api/v1`, API Resources, paginacja, spójny format błędów | |
| 22 | Język UI | Polski (stringi gotowe pod ewentualne EN) | |

---

## 2. Architektura wysokopoziomowa

```
apps/admin  (React SPA)  ─┐
                          ├─► Laravel REST API (/api/v1)  ─► MySQL
apps/public (React SPA)  ─┘            │
                                        └─ storage/ (logo)
packages/ui        — wspólne komponenty shadcn / design tokens
packages/api-client — typowany klient HTTP + typy DTO
```

- `admin` — wymaga logowania (Bearer token), zarządzanie turniejem.
- `public` — read-only, dane po `slug`, polling do odświeżania.
- Trzy obszary logiczne: **Panel/CMS**, **Strona publiczna**, **Silnik rozgrywek** (BE).

---

## 3. Model domeny (ERD — tekstowo)

```
User (owner)
  └──< Tournament  [user_id, sport_id, slug, name, branding(logo,color), format, tiebreakers(json), status]
         ├──< Team          [tournament_id, name, logo]
         │      └──< Player [team_id, name, number, position]
         ├──< Venue         [tournament_id, name, address]
         └──< Stage         [tournament_id, type: group_phase|knockout, order]
                ├──< Group   [stage_id, name]            (faza grupowa)
                │     └──< GroupTeam [group_id, team_id]
                ├──< Round   [stage_id, name, order]     (kolejka ligi / runda drabinki)
                │     └──< Match
                └──  (knockout: Round = runda drabinki)

Match  [round_id, home_team_id, away_team_id, home_score, away_score,
        status: scheduled|live|finished, kickoff_at, venue_id,
        next_match_id (drabinka), bracket_slot]
  └──< MatchEvent [match_id, team_id, player_id, type, minute, meta(json)]

Sport  [code, name, config(json: event_types, default_points, allowed_tiebreakers, stats)]
```

Uwagi:
- `Standing` **nie** jest tabelą — liczony on-read z `Match`.
- `MatchEvent` generyczny; dozwolone `type` zależą od `Sport.config`.
- `slug` globalnie unikalny (publiczne URL-e).
- Soft-deletes + guard: nie usuwamy bytów powiązanych z rozegranymi meczami.

---

## 4. Sporty i konfiguracja (rozszerzalność)

- Sport = **konfiguracja (DB/JSON) + strategia (PHP)**. Interfejs `SportRules`:
  - `pointsFor(result): int` — np. piłka W=3/R=1/P=0; kosz W=2/P=1.
  - `allowedEventTypes(): array` — goal, card (piłka); points, foul (kosz)…
  - `availableTiebreakers(): array`, `availableStats(): array`.
- Piłka i koszykówka seedowane w kodzie + seedzie DB.
- Per turniej organizator konfiguruje w UI: **wartości punktowe** i **kolejność tiebreaków** (drag&drop).
- Dodanie nowego sportu = nowa klasa `SportRules` + seed (bez zmian w silniku) → rozdział „rozszerzalność".

---

## 5. Klasyfikacja (standings) i tiebreaki

Algorytm (on-read):
1. Zbierz zakończone mecze w fazie/grupie → agreguj per drużyna (M, W, R, P, bramki+/−, pkt).
2. Sortuj wg **uporządkowanej listy tiebreaków** turnieju, np. `["points","head_to_head","goal_diff","goals_for"]`.
3. Każdy tiebreak = komparator z rejestru.

**Head-to-head (decyzja #11):**
- 2 drużyny remisują → porównaj ich bezpośrednie mecze.
- 3+ drużyn remisuje → policz **mini-tabelę** tylko z meczów między nimi i posortuj wg niej.
- Jeśli po mini-tabeli nadal remis → **zejdź do następnego kryterium** z listy (brak rekurencji).
- Future work: pełna rekurencja FIFA/UEFA.

---

## 6. Generator terminarza

- **Round-robin (circle method)**: każdy z każdym; nieparzysta liczba drużyn → „pauza" (bye); 1 lub 2 rundy (rewanż = odwrócenie gospodarza).
- **Daty**: `start_date` + `interval` (np. 7 dni) → kolejki rozkładane automatycznie; korekty ręczne.
- **Venue**: przypisanie ręczne + **ostrzeżenie o kolizji** (ta sama drużyna/miejsce w nakładającym się oknie). Brak automatycznego solvera.
- **Drabinka (single-elimination)**: seeding (z rang grup w grupy+playoff albo manualny/losowy), pary, `next_match_id` do propagacji.
- **Grupy + playoff**: tabele grup → kwalifikacja N najlepszych → zasilenie drabinki (np. 1A vs 2B).

---

## 7. Cykl życia meczu i kaskada

- Status: `scheduled → (live) → finished`.
- Wpisanie/edycja wyniku przelicza tabelę on-read (liga) automatycznie.
- **Drabinka**: jeśli edycja zmienia zwycięzcę, kolejne rundy zależne zostają **wyczyszczone/zresetowane** z wyraźnym ostrzeżeniem dla admina (propagacja przez `next_match_id`).

---

## 8. API (zarys)

```
POST /api/v1/register | /login | /logout            (Sanctum, Bearer)
# admin (auth + Policy przez Tournament.user_id)
GET/POST/PATCH/DELETE  /tournaments[/{t}]
                       /tournaments/{t}/teams[/{team}]
                       /teams/{team}/players[/{player}]
                       /tournaments/{t}/venues
                       /tournaments/{t}/stages
POST  /tournaments/{t}/generate-schedule
PATCH /matches/{m}            (wynik, status)
CRUD  /matches/{m}/events
PATCH /tournaments/{t}/tiebreakers   (kolejność drag&drop)
# public (bez auth, po slug)
GET /public/t/{slug}
GET /public/t/{slug}/standings | /fixtures | /results | /top-scorers
```

Standard: Form Requests (walidacja), Policies (autoryzacja), API Resources (DTO), paginacja, spójny format błędów.

---

## 9. Frontend

- **admin**: layout nawigacji turnieju; kreator (sport → format → drużyny → generuj terminarz); ekran wyniku + eventów; ustawienia/branding; drag&drop tiebreaków. react-hook-form + zod, TanStack Table.
- **public**: `/t/{slug}` z brandingiem (kolor jako CSS var); zakładki Tabela / Terminarz / Wyniki / Strzelcy; drabinka; polling.
- **packages/ui**: shadcn + motyw; **packages/api-client**: typowany klient + typy.

---

## 10. Podział pracy (równy, wertykalne kolumny)

**Zasada:** wspólny fundament (parowanie) → 3 pionowe wycinki **end-to-end (BE+FE)**, równe co do wysiłku, każdy = osobny rozdział pracy. Przypisanie wymienne wg preferencji.

**Faza 0 — fundament (cały zespół, ~1–2 tyg., parowanie):** monorepo, Docker, Laravel + Sanctum, schemat DB + migracje, scaffolding 2× React + shadcn, `api-client`, CI.

| Osoba | Wycinek | Backend | Frontend | Rozdział w pracy |
|-------|---------|---------|----------|------------------|
| **Dawid** | **Liga** | round-robin generator, standings on-read, tiebreaki + head-to-head | admin: terminarz + ekran wyniku/eventów; public: Tabela | „Round-robin i klasyfikacja (tabele, tiebreaki)" |
| **Wojtek** | **Puchar + Grupy** | bracket service, kaskada/propagacja, kompozycja grupy→playoff | admin: kreator drabinki/grup; public: Drabinka | „Systemy pucharowe i kompozycja faz" |
| **Julka** | **Platforma** | auth/Sanctum, CRUD turnieje/drużyny/zawodnicy/venue, sport-config, eventy/statystyki, branding | admin: CRUD + ustawienia/branding; public: branding + Strzelcy | „Platforma: dane, bezpieczeństwo, statystyki, prezentacja" |

**Zasady współpracy:** każdy PR czyta ktoś inny (cross-review — wszyscy rozumieją całość na obronę); wspólne komponenty `packages/ui` rotacyjnie; kontrakt API (typy w `api-client`) jako pierwszy krok każdej kolumny.

---

## 11. Harmonogram (~14 tyg., sprinty 2-tyg.)

| Sprint | Tyg. | Cel | Kamień milowy |
|--------|------|-----|---------------|
| S0 | 1–2 | Fundament, schemat, auth, CI | login end-to-end |
| S1 | 3–4 | CRUD turnieje/drużyny/zawodnicy/venue + sporty | można założyć turniej |
| S2 | 5–6 | **Liga: round-robin + tabela + tiebreaki** + admin wyniki | **Demo #1: działająca liga (piłka+kosz)** |
| S3 | 7–8 | Eventy (strzelcy/kartki) + strona publiczna (tabela/terminarz/wyniki) | publiczny link do pokazania |
| S4 | 9–10 | **Drabinka + kaskada** | format pucharowy działa |
| S5 | 11–12 | **Grupy + playoff** + strzelcy + branding | pełny zakres formatów |
| S6 | 13–14 | Testy, poprawki, deploy, **dokumentacja/praca** | wersja na obronę |

---

## 12. Jakość

- BE: Pest (silnik: generator, tabela, tiebreaki, kaskada; feature: API), Pint, factories+seeders (dane demo).
- FE: ESLint/Prettier, Vitest na logice, Zod na granicy API.
- CI: GitHub Actions (lint+test na PR), Docker compose do startu jednym poleceniem.

---

## 13. Ryzyka i mitygacje

- **Przeszacowanie zakresu** → fazowanie formatów; twarde DoD MVP po S3.
- **Rozjazd kontraktu API** → typowany `api-client` jako pierwszy krok kolumny.
- **Nierówny wkład** → wertykalne kolumny + cross-review + metryki w pracy.
- **Złożoność head-to-head/kaskady** → wcześnie pokryte testami; wersja bez rekurencji.

---

## 14. Pola otwarte / future work

- Postgres zamiast MySQL (odrzucone na rzecz MySQL).
- Globalne kluby + roster (historia międzysezonowa).
- Materializacja standings (optymalizacja przy skali).
- Pełna rekurencja head-to-head (FIFA/UEFA).
- Realtime websockety (live score), E2E (Playwright), CD/deploy.
- Subdomeny `cms.*` per organizator, role współpracowników.
- Zaawansowany branding/sloty sponsorów.
- i18n (EN) — potwierdzić język UI.

---

## 15. Do potwierdzenia z zespołem

1. Seeding drabinki w grupy+playoff: krzyżowy (1A–2B) automatyczny vs manualny.
2. Czy „pauza" (bye) w lidze nieparzystej pokazywana jawnie w terminarzu.
3. Dokładne domyślne reguły punktacji i tiebreaków per sport.
