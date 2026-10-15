# Grupy i przydział drużyn

Badanie na potrzeby ticketu
[#248 „S5: research — tworzenie grup i przydział drużyn"](https://github.com/dawer2253/sports-tournament-app/issues/248)
(mapa [#246](https://github.com/dawer2253/sports-tournament-app/issues/246)).
Fakty do grillingu
[#249 „S5: grupy i terminarz fazy grupowej"](https://github.com/dawer2253/sports-tournament-app/issues/249).
Data: 15 października 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Opisuje, jak aplikacje
turniejowe, jedna biblioteka i jeden regulamin losowania tworzą grupy,
przydzielają do nich drużyny, układają kolejki fazy grupowej i co pozwalają
zmienić po utworzeniu grup. Nie wskazuje wariantu dla nas.

Czego tu nie ma, bo jest gdzie indziej:

- Awans z grup i rozstawienie krzyżowe do drabinki (decyzja #23) to osobny
  wątek S5 (`grep -n "Seeding drabinki (grupy+playoff)" docs/PLAN.md`).
  Kolejność rozstawienia w drabince opisuje
  [`rozstawienie-i-wolne-losy.md`](rozstawienie-i-wolne-losy.md).
- Metoda kołowa (kto z kim w której kolejce) jest w
  [`circle-method-berger.md`](circle-method-berger.md), a rozkład dat, obiekty
  i ponowne generowanie terminarza ligi w
  [`terminarz-w-aplikacjach-turniejowych.md`](terminarz-w-aplikacjach-turniejowych.md).

Punkt odniesienia w repo (stan na dziś, polecenia do wklejenia):

- Słownik: grupa to podzbiór drużyn fazy `group` z własną tabelą, mecz należy
  do jednej grupy albo do żadnej (`grep -n -A7 "^## Group" CONTEXT.md`).
- `groups` ma `stage_id`, `tournament_id` i `name` (`string('name', 40)`), bez
  numeru porządkowego
  (`grep -n "table->" backend/database/migrations/*create_groups_table.php`).
- `rounds` ma `stage_id` i unikat `['stage_id', 'order']`, bez `group_id`;
  `teams` i `matches` mają `group_id`
  (`grep -n "group\|unique" backend/database/migrations/*create_{teams,rounds,matches}_table.php`).

Terminy według [`CONTEXT.md`](../../CONTEXT.md): faza (Stage), grupa (Group),
kolejka (Round), mecz (Match), pauza (Bye). Tam, gdzie źródło ma własną
nazwę („pool", „phase group", „poule", „division"), podaję ją w cudzysłowie.
„Rozstawienie" (seeding) to kolejność drużyn podana na wejściu, „koszyk"
(pot) to zbiór drużyn o podobnej sile losowanych do różnych grup.

## 0. Źródła i metoda

| Źródło | Co z niego wzięte |
|---|---|
| [brackets-manager.js](https://github.com/Drarig29/brackets-manager.js) @ [`02027cf`](https://github.com/Drarig29/brackets-manager.js/tree/02027cff5d687068719bebbc765072f382e81390) i [brackets-model](https://github.com/Drarig29/brackets-model) @ [`59aedea`](https://github.com/Drarig29/brackets-model/tree/59aedea4c034a6eae5b88bd14f784b263164e808) | kod źródłowy: ustawienia etapu `round_robin`, podział na grupy, kolejki w grupie, zmiana rozstawienia |
| Toornament | [developer.toornament.com](https://developer.toornament.com/v2/core-concepts/stages) (pojęcia, referencja API grup, kolejek i placement), [help.toornament.com](https://help.toornament.com/) |
| Challonge | [kb.challonge.com](https://kb.challonge.com/en/), API v2.1 na [challonge.apidog.io](https://challonge.apidog.io/llms.txt) (wersje `.md` stron) |
| start.gg | [help.start.gg](https://help.start.gg/en/), referencja GraphQL na [developer.start.gg](https://developer.start.gg/reference/phase.doc.html) |
| Tournify | [help.tournifyapp.com](https://help.tournifyapp.com/en/) |
| LeagueRepublic | [help.leaguerepublic.com](https://help.leaguerepublic.com/en/) |
| 360Player | [help.360player.com](https://help.360player.com/en/articles/16640008-create-a-tournament) (aplikacja klubowa z turniejami i ligami) |
| FIFA | komunikat o procedurze losowania MŚ 2026 na [inside.fifa.com](https://inside.fifa.com/organisation/media-releases/procedures-final-draw-world-cup-2026-revealed) |

Ograniczenia:

- **Nic nie było klikane w aplikacjach.** Zdania o Toornament, Challonge,
  start.gg, Tournify, LeagueRepublic i 360Player to odczyt dokumentacji, nie
  obserwacja.
- **brackets-manager nie był instalowany.** Podziały dla konkretnych n (tabela
  w §3) pochodzą z odtworzenia trzech funkcji w Node; skrypt jest
  w [Dodatku](#dodatek-odtworzenie-podziału-na-grupy-w-brackets-manager).
- **Regulaminów rozgrywek z fazą grupową nie przeczytałam w oryginale.**
  Strony regulaminu UEFA EURO 2022-24 na `documents.uefa.com` w dniu badania
  zwracały „Not Found" (także w przeglądarce), a pełnego PDF-u procedury
  losowania MŚ 2026 na domenie FIFA nie znalazłam. Z FIFA biorę tylko to, co
  stoi w komunikacie prasowym.
- Wyszukiwanie artykułów Challonge, LeagueRepublic i Tournify szło po
  kategoriach centrów pomocy. Artykułu Challonge o tym, jak drużyny trafiają do
  grup w UI, nie znalazłam.

## 1. Streszczenie

- **Wejściem jest albo liczba grup, albo rozmiar grupy.** Liczbę grup biorą
  brackets-manager (`groupCount`), Toornament (`nb_groups` obok `size` całego
  etapu) i start.gg („Number of Pools"). Rozmiar grupy bierze Challonge
  (`group_size`, domyślnie 4). Tournify buduje grupy na stronie „Format",
  360Player dodaje je pojedynczo albo przyciskiem „Generate groups", a
  formularza LeagueRepublic znalezione artykuły nie opisują.
- **Górne limity rozmiaru są niskie i różne:** LeagueRepublic do 6 drużyn
  w grupie, Toornament „10 players per group" w grupach round robin. Nierówne
  grupy dopuszczają wprost 360Player („Groups don't need to be the same size")
  i brackets-manager (pierwsze grupy dostają o jedną drużynę więcej).
- **Nazwy:** Toornament ma edytowalne `name` (do 30 znaków, przykład
  „Group B") i `number` do kolejności; start.gg `displayIdentifier`;
  brackets-model nie ma nazwy wcale, tylko `number`.
- **Przydział to wszędzie ręczne miejsca plus jakiś automat.** Tournify:
  ręcznie albo „automated draw"; 360Player: „Generate groups" albo „Assign
  teams"; start.gg: przeciąganie między pulami; Toornament: rozstawienie
  w etapie i metoda „arrival" (`adjacent`, `sequential`, `snake`, `branch`)
  mapująca numery na grupy, z blokadą wybranych numerów przy losowaniu.
  brackets-manager ma trzy porządki grupowe (domyślny `groups.effort_balanced`)
  albo `manualOrdering` — listę numerów per grupa.
- **Koszyki w sensie FIFA (losowanie po jednej drużynie z koszyka do każdej
  grupy, z ograniczeniem konfederacji) nie występują w żadnej przeczytanej
  dokumentacji aplikacji.** Najbliżej są porządek „snake" (Toornament,
  `groups.seed_optimized` w brackets-manager) i blokada numerów przed
  losowaniem reszty (Toornament).
- **We wszystkich trzech modelach danych, które to pokazują, kolejka należy do
  grupy, nie do fazy:** Toornament (`group_id` w kolejce, „a small step inside
  a group"), brackets-model (`group_id`, „The number of the round in its
  group"), start.gg (`rounds` i `numRounds` na „PhaseGroup"). Tournify planuje
  kolejki filtrem w obrębie wybranej grupy. Wspólnej „Kolejki 1" dla wszystkich
  grup nie opisuje żadne źródło.
- **Grupy o różnej liczbie drużyn mają różną liczbę kolejek:** w
  brackets-manager grupa nieparzysta n ma n kolejek z pauzą, parzysta n − 1.
- **Zmiany po starcie są blokowane na poziomie meczu albo przez reset.**
  Toornament pozwala przestawiać uczestników nawet po starcie, ale uczestnik
  z wynikiem jest zablokowany, a zmiana rozmiaru etapu resetuje mecze.
  start.gg blokuje rozstawienie po starcie puli; zmiana wymaga resetu, który
  kasuje wyniki. Challonge do dopisania uczestnika każe zresetować turniej.
  360Player blokuje grupy na czas publikacji. brackets-manager odrzuca zmianę
  rozstawienia, jeśli dotyka meczu, który już trwa.

## 2. Tworzenie grup

### 2.1. Co jest wejściem

| System | Wejście | Uwagi | Źródło |
|---|---|---|---|
| brackets-manager | `groupCount` — „Number of groups in a round-robin stage" | bez niego: `throw Error('You must specify a group count for round-robin stages.')`; musi być > 0 | [`input.ts` L97–100](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/input.ts#L97-L100), [`creator.ts` L653–658](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L653-L658) |
| Toornament | `size` — „The number of competitors in the stage" i `nb_groups` — „The number of groups" | `size` dotyczy całego etapu, nie grupy | [Stages](https://developer.toornament.com/v2/core-concepts/stages) |
| start.gg | „Pools: Number of Pools" w ustawieniach fazy; w API `Phase.groupCount` — „Number of phase groups in this phase" | przykład z centrum pomocy: 32 pule round robin, po 2 awansujące | [Bracket Configuration Examples](https://help.start.gg/en/articles/13766168-bracket-configuration-examples), [Phase](https://developer.start.gg/reference/phase.doc.html) |
| Challonge | `group_stage_options.group_size` (domyślnie 4) i `participant_count_to_advance_per_group` (domyślnie 2), przy `group_stage_enabled: true` | liczba grup nie jest parametrem; co przy liczbie uczestników niepodzielnej przez `group_size` — nie opisano | [Create Tournament](https://challonge.apidog.io/create-tournament-23619740e0.md), [Running a Two-Stage Tournament](https://challonge.apidog.io/running-a-two-stage-tournament-1726921m0.md) |
| Tournify | grupy budowane na stronie „Format", z gotowych formatów albo od zera | liczby grup i rozmiaru jako parametru dokumentacja nie wymienia | [Create a format](https://help.tournifyapp.com/en/articles/8953884-create-a-format), [Format](https://help.tournifyapp.com/en/articles/8909549-format) |
| 360Player | „add groups one by one or click Generate groups to auto-distribute enrolled teams" | wybór „Round robin" albo „Double round robin" na poziomie zakładki grup | [Create a tournament](https://help.360player.com/en/articles/16640008-create-a-tournament) |
| LeagueRepublic | przykład w przewodniku: „4 groups of 4 teams", round robin w grupie, awans 2 najlepszych | sam formularz tworzenia nie jest opisany w znalezionych artykułach | [Stages, Rounds, Ties & Legs Explained](https://help.leaguerepublic.com/en/articles/634280-stages-rounds-ties-legs-explained-tournament-terminology-guide) |

### 2.2. Nazwy grup

- **Toornament:** grupa ma `number` („A number used for ordering groups") i
  `name` (maks. 30 znaków, przykład „Group B"); `name` można zmienić przez
  `PATCH /groups/{id}`
  ([Groups](https://developer.toornament.com/v2/doc/organizer_groups)).
- **brackets-model:** `Group` ma tylko `id`, `stage_id` i `number`, a komentarz
  mówi, że te poziomy „don't have a `name` property" i są nazywane numerem
  ([`storage.ts` L46–60](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/storage.ts#L46-L60)).
- **start.gg:** `PhaseGroup.displayIdentifier` — „Unique identifier for this
  group within the context of its phase"
  ([PhaseGroup](https://developer.start.gg/reference/phasegroup.doc.html)).
- **FIFA:** grupy „A to L", a pozycje w grupie jako litera z numerem, np. „A1"
  ([komunikat FIFA](https://inside.fifa.com/organisation/media-releases/procedures-final-draw-world-cup-2026-revealed)).
- Challonge, Tournify, LeagueRepublic, 360Player: nazewnictwa grup
  dokumentacja nie opisuje.

### 2.3. Rozmiar grupy i grupy nierówne

- **LeagueRepublic:** „the system only allows you to enter up to 6 teams in
  each group"; dla większych grup radzi użyć „divisions" i dodać fazę
  pucharową później
  ([Can I create a tournament with more than 6 teams in each group?](https://help.leaguerepublic.com/en/articles/3123193-can-i-create-a-tournament-with-more-than-6-teams-in-each-group)).
- **Toornament:** grupy round robin mają „limited capacity (10 players per
  group)"; cały etap „Round Robin Groups" w planie darmowym do 32
  uczestników, w płatnych do 1 024
  ([Which format for my tournament](https://help.toornament.com/structures/which-format-for-my-tournament)).
  Co przy `size` niepodzielnym przez `nb_groups` — nie opisano.
- **brackets-manager:** `makeGroups` liczy rozmiar jako
  `Math.floor(n / groupCount)`, a resztę rozdaje po jednej **pierwszym**
  grupom (`i < extraGroups`). Dla n = 10 i 3 grup daje 4, 3, 3
  ([`helpers.ts` L171–191](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L171-L191)).
  Przy `manualOrdering` rozmiary grup są dowolne, bo grupa to po prostu podana
  lista numerów
  ([`creator.ts` L660–676](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L660-L676)).
- **360Player:** „Groups don't need to be the same size"
  ([Create a tournament](https://help.360player.com/en/articles/16640008-create-a-tournament)).
- **Tournify** zauważa skutek nierównych grup dopiero przy awansie: „najlepsze
  trzecie" porównuje „based on points > goal difference > goals scored", bez
  wzmianki o wyrównaniu liczby meczów
  ([Best placed teams and byes](https://help.tournifyapp.com/en/articles/8958025-best-placed-teams-and-byes)).
- Minimalnej wielkości grupy nie podaje żadne źródło.

## 3. Przydział drużyn do grup

### 3.1. Przegląd

| System | Ręcznie | Automat | Rozstawienie / koszyki | Źródło |
|---|---|---|---|---|
| Tournify | „manually by selecting the positions in the groups" | „the automated draw" | nie opisano | [Format](https://help.tournifyapp.com/en/articles/8909549-format) |
| 360Player | „Use Assign teams on a group to move teams in and out by hand" | „Generate groups to auto-distribute enrolled teams" | nie opisano | [Create a tournament](https://help.360player.com/en/articles/16640008-create-a-tournament) |
| start.gg | „dragging and dropping players within or across pools"; upuszczenie na gracza zamienia ich miejscami | dodawanie uczestników do fazy automatycznie przy zapisie („Automatically add entrants as they are added to the event"); reguła podziału na pule nie opisana | widok przełącza numer ogólny i numer w puli; API `updatePhaseSeeding` z `seedNum` i opcjonalnym `phaseGroupId` | [Pools & Seeding](https://help.start.gg/en/articles/13764646-pools-seeding), [UpdatePhaseSeedInfo](https://developer.start.gg/reference/updatephaseseedinfo.doc.html) |
| Toornament | edycja numerów rozstawienia „in the list on the left, or directly inside the preview"; w API `PATCH /stages/{id}/slots` z parami `number`/`participant_id` | automatyczne umieszczanie w kolejności tworzenia uczestników; losowanie z blokadą wybranych numerów | metoda „arrival" mapuje numery na grupy; w UI „Group Composition", np. „Seed optimized (Snake)" | [How Placement works](https://help.toornament.com/placement/how-placement-works), [Placement](https://developer.toornament.com/v2/doc/organizer_placement), [Stages](https://developer.toornament.com/v2/core-concepts/stages) |
| Challonge | nie opisano dla grup | `PUT /participants/randomize` — „Randomizes the Participant Seeding" | uczestnik ma `seed` i `group_id`; jak `seed` przekłada się na grupę — nie opisano | [Randomize Participants](https://challonge.apidog.io/randomize-participants-23619756e0.md), [List Participants](https://challonge.apidog.io/list-participants-23619749e0.md) |
| brackets-manager | `manualOrdering` — „a list of seeds per group" | brak losowania; kolejność podaje wywołujący | `seedOrdering` z przedrostkiem `groups.`: `effort_balanced` (domyślny), `seed_optimized`, `bracket_optimized` | [`input.ts` L71–118](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/input.ts#L71-L118), [`unions.ts` L37–38](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/unions.ts#L37-L38) |
| LeagueRepublic | zakładka „Teams" dodaje drużyny do turnieju; przydział do grup nie opisany | nie opisano | nie opisano | [Changes to the Tournament system](https://help.leaguerepublic.com/en/articles/2700021-changes-to-the-tournament-system) |

### 3.2. Porządki grupowe brackets-manager

Trzy funkcje w
[`ordering.ts` L37–150](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/ordering.ts#L37-L150)
przestawiają listę numerów, a potem `makeGroups` tnie ją kolejno na grupy.
Domyślną wybiera `getRoundRobinOrdering()` — `groups.effort_balanced`
([`creator.ts` L688–690](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L688-L690)).
Wynik odtworzenia (numery rozstawienia w grupach 1…g):

| n, grupy | `groups.effort_balanced` | `groups.seed_optimized` | `groups.bracket_optimized` |
|---|---|---|---|
| 16, 4 | [1,5,9,13] [2,6,10,14] [3,7,11,15] [4,8,12,16] | [1,8,9,16] [2,7,10,15] [3,6,11,14] [4,5,12,13] | [1,7,12,14] [2,8,11,13] [3,5,10,16] [4,6,9,15] |
| 10, 3 | [1,4,7,10] [2,5,8] [3,6,9] | [1,6,7,10] [2,5,8] [3,4,9] | jak `seed_optimized` |
| 8, 2 | [1,3,5,7] [2,4,6,8] | [1,4,5,8] [2,3,6,7] | [1,2,5,6] [3,4,7,8] |

- `effort_balanced` rozdaje numery po kolei 1, 2, 3, 4, 1, 2… (każda grupa
  ma tę samą „kolumnę" siły).
- `seed_optimized` to wąż: przebieg parzysty idzie od grupy 1, nieparzysty od
  ostatniej.
- `bracket_optimized` paruje numery jak w drabince (`inner_outer`) i kładzie
  parę do przeciwległych grup, „so these opponents never end up in the same
  round-robin group"; przy nieparzystej liczbie grup wraca do
  `seed_optimized`. Dla n = 8 i 2 grup numery 1 i 2 lądują w tej samej
  grupie (wiersz wyżej) — to wynik odtworzenia, nie opis z dokumentacji.

### 3.3. Toornament: rozstawienie etapu i „arrival"

- Rozstawienie dotyczy **etapu**, nie grupy: uczestnicy dostają numer „depending
  on the order you picked them", a ich miejsce w strukturze wynika z numeru
  ([How Placement works](https://help.toornament.com/placement/how-placement-works)).
- Ustawienie etapu `arrival` — „The arrival method used to distribute
  competitors in the groups"; wartości `adjacent`, `sequential`, `snake`,
  `branch`. Symetryczne `departure` (domyślnie `mirror`) przydziela z grup z
  powrotem do etapu ([Stages](https://developer.toornament.com/v2/core-concepts/stages)).
  Czym różnią się `adjacent`, `sequential` i `branch` — referencja nie
  definiuje.
- Blokada numeru: zablokowane numery „won't change if you randomize the
  participants into the stage", więc można losować resztę wokół ustalonych
  ([How Placement works](https://help.toornament.com/placement/how-placement-works)).
  W API slot ma pole `locked`
  ([Placement](https://developer.toornament.com/v2/doc/organizer_placement)).

### 3.4. Koszyki w regulaminie: losowanie MŚ 2026

Jedyne przeczytane źródło z koszykami
([komunikat FIFA](https://inside.fifa.com/organisation/media-releases/procedures-final-draw-world-cup-2026-revealed)):

- 48 drużyn, 12 grup po 4. Gospodarze w koszyku 1, pozostałe 39
  zakwalifikowane drużyny rozdzielone do czterech koszyków po 12 według
  rankingu FIFA z 19 listopada 2025; miejsca po barażach w koszyku 4.
- Najpierw cały koszyk 1 do grup A–L, potem koszyki 2, 3 i 4 „in that order".
- Koszyk 1 trafia na pozycję 1 w grupie; gospodarze na z góry ustalone
  A1, B1, D1. Pozycję drużyn z koszyków 2–4 wyznacza „predefined allocation
  pattern" z dokumentu procedury (tabeli nie czytałam).
- Ograniczenie: w zasadzie najwyżej jedna drużyna z tej samej konfederacji
  w grupie, poza UEFA (16 drużyn): „at least one, but no more than two UEFA
  teams" w każdej grupie.

Ograniczenia typu „ten sam klub / region w różnych grupach" nie opisuje żadna
z przeczytanych aplikacji. Wyszukiwarka zwróciła taki zapis dla Profixio, ale
strona pomocy Profixio odpowiadała 404, więc go nie potwierdziłam.

## 4. Terminarz fazy grupowej

### 4.1. Kolejka: w grupie czy wspólna dla fazy

| System | Gdzie wisi kolejka | Źródło |
|---|---|---|
| Toornament | „A round represents a small step inside a group"; zasób `round` ma `group_id` i `number` porządkowy; struktura to etap → grupy → kolejki → mecze | [Structure](https://developer.toornament.com/v2/core-concepts/structure), [Rounds](https://developer.toornament.com/v2/doc/organizer_rounds) |
| brackets-model | `Round` ma `group_id`; `number` — „The number of the round in its group" | [`storage.ts` L62–77](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/storage.ts#L62-L77) |
| brackets-manager | `createRoundRobinGroup` wstawia grupę, a potem jej kolejki `createRound(stageId, groupId, i + 1, …)` — numeracja od 1 w każdej grupie | [`creator.ts` L227–240](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L227-L240) |
| start.gg | `PhaseGroup` ma `rounds`, `numRounds`, `startAt` i `firstRoundTime`; faza ma tylko `groupCount` i „waves" | [PhaseGroup](https://developer.start.gg/reference/phasegroup.doc.html), [Phase](https://developer.start.gg/reference/phase.doc.html) |
| Tournify | planer: „Start by selecting a group, then Round 1", potem kolejny dzień i „Round 2" | [Schedule matches automatically](https://help.tournifyapp.com/en/articles/9064758-schedule-matches-automatically) |
| Challonge | mecz ma `round` (integer); uczestnik ma `group_id`; czy numer kolejki jest wspólny dla grup — nie opisano | [List Matches](https://challonge.apidog.io/list-matches-23619745e0.md), [List Participants](https://challonge.apidog.io/list-participants-23619749e0.md) |
| LeagueRepublic | „Is a group stage a round? No. A group stage is a stage. It can contain multiple matchdays."; w ustawieniach awansu pojawia się „Stage: Group Stage, Round: Group Stage, Position: 2" | [Stages, Rounds, Ties & Legs](https://help.leaguerepublic.com/en/articles/634280-stages-rounds-ties-legs-explained-tournament-terminology-guide), [Advancing teams](https://help.leaguerepublic.com/en/articles/1518244-advancing-teams-from-a-group-stage-of-a-tournament) |
| 360Player | „Generate matchups" dla grup, potem „Schedule matches" z wyborem etapu, zakresu dat i „how frequently to schedule rounds" | [Create a tournament](https://help.360player.com/en/articles/16640008-create-a-tournament) |

Toornament pozwala ułożyć kolejki ręcznie per grupa: „Pairing Table", w
której „Each line represents a day/round", a mecz zapisuje się numerami
rozstawienia w grupie (`1v2 3v4`); zmiana tabeli resetuje mecze
([The Pairing/Matching Table](https://help.toornament.com/placement/the-pairing-table)).
To samo w API: `pairing_values` per grupa
([Stages](https://developer.toornament.com/v2/core-concepts/stages)).

### 4.2. Grupy o różnej liczbie drużyn

`makeRoundRobinDistribution` w brackets-manager dla nieparzystego n dokłada
puste miejsce (`n1 = n + 1`), robi `n1 − 1` kolejek i pomija mecz z pustym
miejscem, czyli grupa 5 drużyn ma 5 kolejek po 2 mecze, a grupa 4 drużyn
3 kolejki po 2 mecze
([`helpers.ts` L94–132](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L94-L132)).
Tryb `double` dokleja te same kolejki z zamienionym gospodarzem
([`helpers.ts` L74–92](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L74-L92)).

Jak aplikacje wyrównują daty grup o różnej liczbie kolejek — żadne źródło
nie opisuje.

### 4.3. Daty i obiekty między grupami

- **Tournify:** planer bierze wybrane grupy i boiska („select your desired
  groups or brackets, then choose the playing fields"); planować można
  wszystko naraz albo w kilku akcjach; brak parametrów typu „bez meczów pod
  rząd" ([Schedule matches automatically](https://help.tournifyapp.com/en/articles/9064758-schedule-matches-automatically)).
- **360Player:** „books games in parallel across your available fields
  automatically" ([Create a tournament](https://help.360player.com/en/articles/16640008-create-a-tournament)).
- **start.gg:** grupa może mieć własną falę i stanowisko —
  `updatePhaseGroups` z `PhaseGroupUpdateInput { phaseGroupId, stationId,
  waveId }`
  ([Mutation](https://developer.start.gg/reference/mutation.doc.html),
  [PhaseGroupUpdateInput](https://developer.start.gg/reference/phasegroupupdateinput.doc.html)).
- **Toornament:** data per mecz albo hurtowo przez filtr meczów; kolejność
  meczów zmienia się tabelą par
  ([How do I schedule my Tournament?](https://help.toornament.com/faq/how-do-i-schedule-my-tournament)).
- **Challonge:** czas ustawia się per mecz przy stanowisku („station")
  ([How to Set Times for Matches](https://kb.challonge.com/en/article/how-to-set-times-for-matches-1jooy8g/)).
- Toornament mówi ogólnie, że grupy „are usually played simultaneously,
  because they involve different participants"
  ([Structure](https://developer.toornament.com/v2/core-concepts/structure)).

## 5. Zmiany po utworzeniu grup

| System | Przeniesienie / zmiana składu | Dodanie, usunięcie drużyny | Ponowne utworzenie | Od kiedy blokada | Źródło |
|---|---|---|---|---|---|
| Toornament | ręczne umieszczanie „even after the stage matches have started" | zmiana rozmiaru etapu go regeneruje, „resetting all its matches"; numery rozstawienia zostają | ponowne losowanie z zablokowanymi numerami | uczestnik z wynikiem w meczu „will become locked"; zatwierdzona grupa „is no longer editable" | [How Placement works](https://help.toornament.com/placement/how-placement-works), [Change the Size](https://help.toornament.com/structures/change-the-size-of-your-tournament), [Group & Round Validation](https://help.toornament.com/match/group-round-validation) |
| start.gg | przeciąganie między pulami; „no way to revert your seeding" po zapisie | nie opisano | reset drabinki / puli | ikona kłódki po starcie puli; reset kasuje wpisane wyniki | [Pools & Seeding](https://help.start.gg/en/articles/13764646-pools-seeding) |
| Challonge | nie opisano | dopisanie „last minute participant" wymaga resetu, który kasuje wyniki; usunięcie uczestnika w trakcie = walkower w otwartych meczach | reset | po starcie fazy grupowej (`start_group_stage` → stan `group_stages_underway`) | [Resetting a Tournament](https://kb.challonge.com/en/article/resetting-a-tournament-omeed8/), [Forfeits by Removing Participants](https://kb.challonge.com/en/article/how-to-report-indicate-forfeits-by-removing-participants-vsb6tt/), [Tournament States](https://challonge.apidog.io/tournament-states-1726857m0.md) |
| Tournify | „You can always make changes later." | nie opisano dla grup | nie opisano | kłódka na terminarzu; nadpisanego terminarza „cannot be restored" | [Format](https://help.tournifyapp.com/en/articles/8909549-format), [FAQ - Schedule](https://help.tournifyapp.com/en/articles/8974711-faq-schedule) |
| 360Player | „Assign teams" | nie opisano | — | grupy i format zablokowane, gdy turniej jest opublikowany; trzeba cofnąć publikację („unpublishing only hides matches") | [Manage a tournament](https://help.360player.com/en/articles/16640009-manage-a-tournament) |
| LeagueRepublic | nie opisano | — | „Clear Tournament Structure" usuwa etapy, kolejki, mecze i wyniki, drużyny zostają | nie opisano | [Clearing the structure](https://help.leaguerepublic.com/en/articles/2702987-clearing-the-structure-of-a-tournament) |
| brackets-manager | `manager.update.seeding()` tworzy etap od nowa w trybie aktualizacji | rozmiar etapu = długość nowego rozstawienia, chyba że `keepSameSize` | to samo wywołanie | `assertCanUpdateSeeding` rzuca „A match is locked.", gdy zmiana dotyka meczu o stanie ≥ `Running` | [`update.ts` L159–168](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/update.ts#L159-L168), [`base/updater.ts` L21–51, L106–122](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/updater.ts#L106-L122) |

Uwaga do brackets-manager: dla etapu `round_robin` `getSeedingMatches` bierze
wszystkie mecze etapu
([`getter.ts` L518–520](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/getter.ts#L518-L520)),
a `updateSeeding` woła porządek grupowy bez `groupCount`
(`ordering[method](slots)`, `updater.ts` L47). Jak to wpływa na sprawdzenie
blokady w grupach, nie odtwarzałam.

## 6. Zestawienie per źródło

| | Wejście | Rozmiar | Przydział | Kolejka | Blokada zmian |
|---|---|---|---|---|---|
| **brackets-manager** | liczba grup | równy ±1, nadmiar w pierwszych | 3 porządki albo ręczna lista per grupa | w grupie | mecz w toku |
| **Toornament** | uczestnicy etapu + liczba grup | do 10 w grupie RR | numery + „arrival" (np. snake), losowanie z blokadą | w grupie | uczestnik z wynikiem; zatwierdzona grupa |
| **start.gg** | liczba pul | nie opisano | przeciąganie, numer w puli | w puli | start puli; reset kasuje wyniki |
| **Challonge** | rozmiar grupy | domyślnie 4 | losowanie rozstawienia | nie opisano | start fazy grupowej; reset |
| **Tournify** | budowane ręcznie | nie opisano | ręcznie albo losowanie | w grupie (filtr planera) | „changes later"; kłódka terminarza |
| **360Player** | budowane ręcznie albo „Generate groups" | dowolny, nierówny | automat albo ręcznie | nie opisano | publikacja |
| **LeagueRepublic** | nie opisano | do 6 | nie opisano | faza ma „matchdays" | czyszczenie struktury |
| **FIFA MŚ 2026** | 12 grup po 4 | stały | koszyki po kolei + ograniczenie konfederacji | — | — |

## 7. Czego nie sprawdzono

„Nie opisano" w tabelach znaczy: nie znaleziono w źródłach z §0, a nie:
aplikacja tego nie robi.

- **Reguła automatu przydziału** w Tournify („automated draw"), 360Player
  („Generate groups"), start.gg i Challonge — losowo, wężem czy kolejno.
- **Definicje `adjacent`, `sequential`, `branch`** w Toornament.
- **Ograniczenia typu „ten sam klub w różnych grupach"** — strona Profixio
  niedostępna (404).
- **Wspólna kolejka dla wszystkich grup** — żadne źródło jej nie opisuje;
  regulaminów turniejowych z dniami meczowymi wspólnymi dla grup (UEFA) nie
  udało się otworzyć.
- **Wyrównanie terminarza grup o różnej liczbie kolejek** (kto pauzuje kiedy,
  czy daty kolejek grup się pokrywają) — żadne źródło.
- **Minimalna wielkość grupy** — żadne źródło.
- **Dodanie drużyny do istniejącej grupy przed startem** — poza Challonge
  (reset) i brackets-manager (nowe rozstawienie) nie opisano.

## Dodatek: odtworzenie podziału na grupy w brackets-manager

Funkcje `groups.effort_balanced`, `groups.seed_optimized` i
`groups.bracket_optimized` z
[`ordering.ts`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/ordering.ts#L37-L150)
oraz `makeGroups` z
[`helpers.ts`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L171-L191)
przepisane 1:1, usunięte tylko typy TypeScriptu. Uruchomienie: `node plik.js`.

```js
const ordering = {
  'groups.effort_balanced': (array, groupCount) => {
    const result = [];
    let i = 0, j = 0;
    while (result.length < array.length) {
      result.push(array[i]);
      i += groupCount;
      if (i >= array.length) i = ++j;
    }
    return result;
  },
  'groups.seed_optimized': (array, groupCount) => {
    const groups = Array.from({ length: groupCount }, () => []);
    const minGroupSize = Math.floor(array.length / groupCount);
    const extraGroups = array.length % groupCount;
    const groupSizes = groups.map((_, group) => minGroupSize + (group < extraGroups ? 1 : 0));
    let index = 0;
    for (let run = 0; index < array.length; run++) {
      const groupOrder = run % 2 === 0 ? groups.map((_, g) => g) : groups.map((_, g) => groupCount - g - 1);
      for (const group of groupOrder) {
        if (index >= array.length) break;
        if (groups[group].length >= groupSizes[group]) continue;
        groups[group].push(array[index]);
        index++;
      }
    }
    return groups.flat();
  },
  'groups.bracket_optimized': (array, groupCount) => {
    if (groupCount < 2) return [...array];
    if (groupCount % 2 === 1) return ordering['groups.seed_optimized'](array, groupCount);
    const participantCount = array.length;
    const halfGroupCount = groupCount / 2;
    let positions = [1, 2];
    while (positions.length < participantCount) {
      const size = positions.length * 2;
      const next = [];
      for (const pos of positions) next.push(pos, size + 1 - pos);
      positions = next;
    }
    const baseGroupForPair = (i) => {
      const t = i % halfGroupCount;
      const r = Math.floor(i / halfGroupCount);
      const inverted = Math.floor(r / 2) % 2 === 1;
      if (r % 2 === 0) return inverted ? (halfGroupCount - 1 - t) : t;
      return inverted ? (halfGroupCount + t) : (groupCount - 1 - t);
    };
    const groups = Array.from({ length: groupCount }, () => []);
    const pairCount = Math.floor(positions.length / 2);
    for (let i = 0; i < pairCount; i++) {
      const base = baseGroupForPair(i);
      const aIndex = positions[2 * i] - 1;
      if (aIndex < array.length) groups[base].push(array[aIndex]);
    }
    for (let i = 0; i < pairCount; i++) {
      const base = baseGroupForPair(i);
      const bIndex = positions[2 * i + 1] - 1;
      if (bIndex < array.length) groups[(base + halfGroupCount) % groupCount].push(array[bIndex]);
    }
    const indexByItem = new Map(array.map((v, i) => [v, i]));
    for (const g of groups) g.sort((a, b) => indexByItem.get(a) - indexByItem.get(b));
    return groups.flat();
  },
};
function makeGroups(elements, groupCount) {
  const result = [];
  const minGroupSize = Math.floor(elements.length / groupCount);
  const extraGroups = elements.length % groupCount;
  let cursor = 0;
  for (let i = 0; i < groupCount; i++) {
    const groupSize = minGroupSize + (i < extraGroups ? 1 : 0);
    result.push(elements.slice(cursor, cursor + groupSize));
    cursor += groupSize;
  }
  return result;
}
for (const [n, g] of [[16, 4], [10, 3], [8, 2]]) {
  const seeds = Array.from({ length: n }, (_, i) => i + 1);
  console.log(`n=${n}, groupCount=${g}`);
  for (const m of Object.keys(ordering)) {
    const groups = makeGroups(ordering[m](seeds, g), g);
    console.log('  ' + m.padEnd(26) + groups.map(x => '[' + x.join(',') + ']').join(' '));
  }
}
```
