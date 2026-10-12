# Rozstawienie i wolne losy w drabince

Badanie na potrzeby ticketu
[#212 „S4: research — rozstawienie i wolne losy w drabince"](https://github.com/dawer2253/sports-tournament-app/issues/212)
(mapa [#211](https://github.com/dawer2253/sports-tournament-app/issues/211)).
Fakty do grillingu „S4: generowanie drabinki". Data: 12 października 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Opisuje, jak biblioteki,
aplikacje turniejowe i jeden regulamin federacji rozstawiają drużyny w drabince
single elimination, komu dają wolne losy i jak organizator ustala kolejność.
Nie wskazuje wariantu dla nas.

Czego tu nie ma, bo jest gdzie indziej:

- Jak systemy **zapisują** wolny los i krawędzie drabinki w danych opisuje
  [`drabinka-modele-danych.md`](drabinka-modele-danych.md)
  (`grep -n -A6 "Bye / wolny los" docs/research/drabinka-modele-danych.md`).
- Nasz model jest przesądzony w
  [ADR 0004](../adr/0004-drabinka-pozycja-wlasna-i-propagacja-osobno.md), a
  słownik mówi, że pauza nie jest meczem i w drabince widać ją tylko w kształcie
  (`grep -n -A8 "^## Bye" CONTEXT.md`).
- Rozstawienie krzyżowe z grup (decyzja #23) to S5. `docs/PLAN.md` mówi o
  drabince bez grup tylko tyle, że „seeding jest manualny albo losowy"
  (`grep -n "seeding jest manualny" docs/PLAN.md`).

Terminy według [`CONTEXT.md`](../../CONTEXT.md): drabinka, mecz, runda, pauza
(Bye). Słowo „rozstawienie" (seeding) i „numer rozstawienia" (seed) oznaczają
tu kolejność drużyn podaną na wejściu generatora, a „pozycja" to miejsce
w pierwszej rundzie drabinki (slot).

## 0. Źródła i metoda

| Źródło | Co z niego wzięte |
|---|---|
| [brackets-manager.js](https://github.com/Drarig29/brackets-manager.js) @ [`02027cf`](https://github.com/Drarig29/brackets-manager.js/tree/02027cff5d687068719bebbc765072f382e81390) i [brackets-model](https://github.com/Drarig29/brackets-model) @ [`59aedea`](https://github.com/Drarig29/brackets-model/tree/59aedea4c034a6eae5b88bd14f784b263164e808) | kod źródłowy: kolejność rozstawienia, wolne losy, ustawienia etapu, zmiana rozstawienia |
| [tournament-organizer](https://github.com/slashinfty/tournament-organizer) @ [`4b2af5a`](https://github.com/slashinfty/tournament-organizer/tree/4b2af5a2d0cec695085a5df161b6a5c5caa47fae) i jego generator par [tournament-pairings](https://github.com/slashinfty/tournament-pairings) @ [`611fb9a`](https://github.com/slashinfty/tournament-pairings/tree/611fb9a59598a8b33c4aee0bd4f0f95d27e3eb2d) | kod źródłowy: kolejność, runda wstępna, losowanie, mecz o 3. miejsce |
| Challonge | [kb.challonge.com](https://kb.challonge.com/en/) (centrum pomocy), API v2.1 na [challonge.apidog.io](https://challonge.apidog.io/llms.txt) (wersje `.md` stron) |
| Toornament | [help.toornament.com](https://help.toornament.com/), [developer.toornament.com](https://developer.toornament.com/v2/core-concepts/stages) |
| start.gg | [help.start.gg](https://help.start.gg/en/), [developer.start.gg](https://developer.start.gg/docs/e2e/update-phase-seeding) |
| Tournify | [help.tournifyapp.com](https://help.tournifyapp.com/en/) |
| BWF (badminton) | General Competition Regulations, Section 5.1, wersja z 6 marca 2020 ([kopia na usabadminton.org](https://usabadminton.org/wp-content/uploads/2021/04/Section-5.1-General-Competition-Regulations-6-March-2020.pdf)); Section 5.3.8 „Technical Diagrams and Tables – Seeding and Byes", w mocy od 1.01.2018 ([kopia federacji chilijskiej](https://fedebadchile.cl/wp-content/uploads/2019/05/3.3.8-Technical-Diagrams-and-Tables-Seeding-and-Byes.compressed.pdf)) |

Ograniczenia:

- **Nic nie było klikane w aplikacjach.** Zdania o Challonge, Toornament,
  start.gg i Tournify to odczyt dokumentacji, nie obserwacja.
- **Biblioteki nie były instalowane.** Wyniki dla konkretnych n (tabele w §2)
  pochodzą z odtworzenia funkcji w Node: `inner_outer` i `balanceByes`
  przepisane z brackets-manager, `SingleElimination` skopiowana z
  tournament-pairings bez zmian poza usunięciem typów i losowania. Skrypt
  odtwarzający brackets-manager jest w [Dodatku](#dodatek-odtworzenie-brackets-manager).
- **Regulaminy BWF czytane z kopii**, bo oficjalna strona
  `corporate.bwfbadminton.com/statutes/` zwraca 403 bez przeglądarki. Obie
  kopie mają nagłówki BWF i daty obowiązywania podane wyżej; nie sprawdzałem,
  czy BWF zmienił te przepisy później.
- Dawne `api.challonge.com/v1/documents` przekierowuje na apidog (API v2.1), a
  web.archive.org był w dniu badania niedostępny (503), więc parametrów API v1
  (np. `hold_third_place_match`) nie potwierdziłem.

## 1. Streszczenie

- **Kolejność „1–16, 8–9, 4–13, 5–12…" jest w obu bibliotekach ta sama i liczy
  się ją jedną regułą:** zaczynając od `[1, 2]`, każdą pozycję `p` zastępuje
  się parą `p, 2s+1−p`, gdzie `2s` to nowy rozmiar. brackets-manager nazywa to
  `inner_outer` i używa domyślnie, tournament-pairings buduje identyczną listę
  od `[1, 4, 2, 3]`. W każdym meczu pierwszej rundy suma numerów rozstawienia
  wynosi rozmiar drabinki + 1, a 1 i 2 mogą się spotkać dopiero w finale.
- **Nie jest jedyna.** Regulamin BWF stawia 1 na górze, 2 na samym dole, a
  numery 3–4, 5–8 i 9–16 **losuje** do odpowiednich ćwiartek, ósemek i
  szesnastek. brackets-manager ma też pięć innych porządków (`natural`,
  `reverse`, `half_shift`, `reverse_half_shift`, `pair_flip`), a Challonge
  przełącznik `sequential_pairings`, który ignoruje reguły rozstawienia.
- **Wolne losy dostają najwyżej rozstawieni** we wszystkich źródłach, które to
  opisują (brackets-manager w trybie domyślnym, tournament-pairings, Challonge,
  BWF). Liczba wolnych losów to zawsze „najbliższa wyższa potęga dwójki minus n"
  (BWF mówi to wprost: 17 uczestników → 15 wolnych losów).
- **Są dwa sposoby zapisu tej samej drabinki.** brackets-manager tworzy pełną
  drabinkę potęgi dwójki z meczami „drużyna kontra BYE". tournament-pairings i
  przykład z centrum pomocy Challonge tworzą **rundę wstępną** tylko dla
  najniżej rozstawionych, a najwyżej rozstawieni startują od rundy 2 bez meczu.
  Wynik sportowy jest ten sam, kształt danych inny.
- **Rozkład wolnych losów po połówkach:** w BWF tabela pozycji rozkłada je
  możliwie równo między połówki i ćwiartki. W brackets-manager przy standardowym
  porządku i bez `balanceByes` wynika to z samej reguły `inner_outer`; z
  `balanceByes: true` losy przestają trafiać do najwyżej rozstawionych (np. 9
  drużyn w drabince 16: seed 2 gra z seedem 9 w pierwszej rundzie).
- **Losowanie bez rozstawienia to losowanie kolejki rozstawienia, nie par.**
  tournament-pairings tasuje listę (Fisher–Yates) i wkłada ją w tę samą
  regułę pozycji. Challonge ma „Shuffle Seeds", Toornament „randomize the
  participants into the stage". Wolne losy trafiają więc w ustalone miejsca
  drabinki, a los decyduje tylko, kto na nich stanie. Tournify jako jedyny opisuje
  ręczny wybór, komu dać wolny los, albo osobne losowanie wolnych losów.
- **Ręczna korekta przed pierwszym meczem jest wszędzie.** Numer wpisywany ręcznie
  albo przeciąganie (Challonge, start.gg), zamiana slotów w podglądzie drabinki
  (Toornament, start.gg). Blokada przychodzi z pierwszym wynikiem: Challonge
  „before starting", start.gg tylko gracze bez rozegranego meczu, Toornament
  blokuje uczestnika z wynikiem, brackets-manager odrzuca zmianę, gdy mecz jest
  zablokowany albo ruszyła runda 2.
- **Częściowe rozstawienie:** Toornament ma zamykanie wybranych seedów przed
  losowaniem reszty, start.gg zachowuje „top X" w generatorze seedów. W BWF jest
  to reguła: rozstawionych jest 2–16 w zależności od liczby zgłoszeń, resztę
  pozycji się losuje.
- **Mecz o 3. miejsce jest wszędzie opcją, domyślnie wyłączoną tam, gdzie
  default jest zapisany** (brackets-manager `consolationFinal`,
  tournament-organizer `consolation`). Siedzi w ustawieniach etapu albo
  turnieju, nie w kroku generowania: Challonge „Settings" (włączyć przed
  startem), Toornament `third_decider` w ustawieniach etapu (wymaga ≥ 4
  uczestników), Tournify jako osobny mecz klasyfikacyjny dobudowany przez
  organizatora.
- **Limity liczby drużyn:** minimum 2 w obu bibliotekach; brackets-manager
  wymaga rozmiaru etapu będącego potęgą dwójki (resztę dopełnia BYE), Tournify
  w ogóle nie ma drabinek innego rozmiaru, Toornament ogranicza turniej do
  2–256, tournament-organizer ma opcjonalne `maxPlayers` (0 = bez limitu).

## 2. Kolejność rozstawienia

### Reguła i biblioteki

**brackets-manager.js.** Pierwsza runda single elimination dostaje porządek
z ustawienia `seedOrdering`, a jeśli go nie podano, domyślnie `inner_outer`
([`creator.ts` L695–697](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L695-L697):
`return this.getOrdering(0, 'elimination', 'inner_outer');`). Sama reguła
([`ordering.ts` L16–35](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/ordering.ts#L16-L35)):

```ts
// Generate standard bracket seeding positions iteratively.
let positions: number[] = [1, 2];
while (positions.length < participantCount) {
    const size = positions.length * 2;
    const next: number[] = [];
    for (const pos of positions)
        next.push(pos, size + 1 - pos);
    positions = next;
}
```

Dla 16 daje kolejność slotów `1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11`
(odtworzenie, patrz Dodatek). Typ `SeedOrdering` w brackets-model zna jeszcze
`natural`, `reverse`, `half_shift`, `reverse_half_shift`, `pair_flip` i trzy
porządki grupowe
([`unions.ts` L37–38](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/unions.ts#L37-L38)).
Dla single elimination ustawienie przyjmuje dokładnie jedną metodę („For a
simple elimination stage, 1 item required … Used to distribute in round 1",
[`input.ts` L71–83](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/input.ts#L71-L83)).
Zamiast porządku można podać `manualOrdering`: „A list of seeds to manually
order the stage … Seed ordering is ignored if this property is given"
([`input.ts` L110–118](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/input.ts#L110-L118)).
Plik `ordering.ts` w pierwszej linii odsyła do wątku na tl.net o rozstawieniu
w dolnej drabince double elimination — to źródło porządków `defaultMinorOrdering`,
nie reguły `inner_outer`.

**tournament-pairings** (generator, którego używa tournament-organizer,
[`Tournament.ts` L153](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/components/Tournament.ts#L153)).
[`SingleElimination.ts`](https://github.com/slashinfty/tournament-pairings/blob/611fb9a59598a8b33c4aee0bd4f0f95d27e3eb2d/src/SingleElimination.ts)
buduje listę od `[1, 4, 2, 3]` i dla kolejnych potęg wstawia `2 ** i + 1 - bracket[j]`
obok każdego elementu. Dla 8 i 16 drużyn wynik jest identyczny z `inner_outer`
(odtworzenie: pierwsza runda 16 drużyn to `1-16 | 8-9 | 4-13 | 5-12 | 2-15 | 7-10 | 3-14 | 6-11`).

Z samej reguły wynikają dwie własności, które łatwo sprawdzić na liście wyżej:
w każdym meczu pierwszej rundy suma numerów to rozmiar drabinki + 1, a numery
1 i 2 leżą w przeciwnych połówkach, 1–4 w różnych ćwiartkach, 1–8 w różnych
ósemkach.

### Regulamin federacji: BWF

General Competition Regulations (Section 5.1, wersja 6.03.2020, s. 24–25):

- 11.7.1: liczba rozstawionych zależy od zgłoszeń — maks. 16 przy 64+,
  8 przy 32–63, 4 przy 16–31, 2 poniżej 16.
- 11.8: numer 1 „placed at the top of the draw", numer 2 „placed at the bottom
  of the draw".
- 11.10: numery 3 i 4 „drawn by lot to the remaining two quarters", 5–8 losowane
  do pozostałych ósemek, 9–16 do szesnastek.
- 11.11.2: zawodnicy z jednego związku nie powinni się spotkać w pierwszej
  rundzie, „wherever possible".

Section 5.3.8, Table 1 (drabinka 16): przy 16 zgłoszeniach seed 1 na pozycji 1,
seed 2 na 16, seedy 3–4 na pozycjach 5 i 12. W brackets-manager przy 16 seed 2
stoi na pozycji 9, a seedy 3 i 4 na 13 i 5 (lista wyżej). Obie drabinki
rozdzielają 1–2 na połówki i 1–4 na ćwiartki, różnią się układem i tym, że
w BWF część pozycji jest losowana.

### Aplikacje

- **Challonge** API v2.1: `seeding_options.sequential_pairings` — „When true,
  seeding rules are ignored and participants are placed in the bracket from top
  to bottom" (domyślnie `false`,
  [Create Tournament](https://challonge.apidog.io/create-tournament-23619740e0.md)).
  Jakie są „seeding rules" przy `false`, dokumentacja nie mówi.
- **Toornament, start.gg, Tournify**: żadna przeczytana strona nie podaje,
  w jakiej kolejności seed trafia na pozycję drabinki.

## 3. Wolne losy przy n niebędącym potęgą dwójki

### Kto je dostaje

**brackets-manager.** Rozmiar etapu eliminacyjnego musi być potęgą dwójki:
`ensureValidSize` rzuca „The library only supports a participant count which is
a power of two."
([`helpers.ts` L393–406](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L393-L406)).
Krótsza lista jest dopełniana `null` (BYE) na końcu przez `fixSeeding`
([L368–376](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L368-L376)),
czyli BYE dostają numery n+1…rozmiar. Po regule `inner_outer` stają naprzeciw
najwyżej rozstawionych. Odtworzenie:

| n / rozmiar | Pierwsza runda (domyślnie) |
|---|---|
| 5 / 8 | 1-BYE, 4-5, 2-BYE, 3-BYE |
| 6 / 8 | 1-BYE, 4-5, 2-BYE, 3-6 |
| 7 / 8 | 1-BYE, 4-5, 2-7, 3-6 |
| 12 / 16 | 1-BYE, 8-9, 4-BYE, 5-12, 2-BYE, 7-10, 3-BYE, 6-11 |

Opcja `balanceByes` („This prevents having BYE against BYE in matches",
[`input.ts` L85–90](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/input.ts#L85-L90))
przestawia listę **przed** nałożeniem porządku
([`creator.ts` L545–546](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L545-L546),
porządek nakładany po `getSlots()` w
[L132–135](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L132-L135)).
Wtedy wolne losy przestają iść do najwyżej rozstawionych:

| n / rozmiar | Pierwsza runda z `balanceByes: true` |
|---|---|
| 5 / 8 | 1-BYE, BYE-4, 2-5, 3-BYE |
| 6 / 8 | 1-BYE, 4-5, 2-6, 3-BYE |
| 12 / 16 | 1-BYE, 8-9, 4-11, 5-BYE, 2-12, 7-BYE, 3-BYE, 6-10 |
| 9 / 16 | 1-BYE, BYE-6, BYE-8, 4-BYE, 2-9, 5-BYE, 3-BYE, BYE-7 |

Mecz z BYE **jest** w brackets-manager meczem w danych, ze zwycięzcą liczonym
z góry (`byeWinner`,
[`helpers.ts` L483–494](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L483-L494)).

**tournament-pairings.** Nie dopełnia do potęgi dwójki. Liczy `remainder` =
n − 2^⌊log₂n⌋, tworzy tyle meczów rundy wstępnej, a drabinkę główną buduje dla
2^⌊log₂n⌋. Do rundy wstępnej schodzą ci, których indeks na liście jest
`>= 2^⌊log₂n⌋ − remainder`, czyli najniżej rozstawieni, a rywala dostają
z drugiego końca listy (`playerArray[2^⌈log₂n⌉ − index − 1]`). Najwyżej
rozstawieni nie mają meczu w rundzie 1 — stoją od razu w rundzie 2. Odtworzenie:

| n | Runda 1 (wstępna) | Runda 2 |
|---|---|---|
| 5 | 4-5 | 1-?, 2-3 |
| 6 | 4-5, 3-6 | 1-?, 2-? |
| 7 | 4-5, 2-7, 3-6 | 1-?, ?-? |
| 12 | 8-9, 5-12, 7-10, 6-11 | 1-?, 4-?, 2-?, 3-? |

Pary w rundzie 1 są takie same jak w brackets-manager bez `balanceByes`;
różni się tylko to, że wolny los nie ma meczu. To jest kształt, który opisuje
nasz słownik: drużyna stoi w rundzie, do której nie prowadzi żaden mecz.

**Challonge.** Artykuł
[„Why some participants go straight to round 2"](https://kb.challonge.com/en/article/why-some-participants-go-straight-to-round-2-1r639q3/)
pokazuje 5 uczestników: zamiast „1 v 5, 2 v 4, 3 v ?" gra się rundę
kwalifikacyjną 4 kontra 5, a zwycięzca dołącza do 1, 2 i 3. Wolne losy
„cannot be avoided unless the number of participants is a power of two".
Dokumentacja nie podaje ogólnej reguły dla innych n.

**BWF.** 11.4.2: przy n niebędącym potęgą dwójki „there shall be byes in the
first round", a ich liczba to różnica do najbliższej wyższej potęgi dwójki.
11.4.3 i 11.9: pozycje wolnych losów i seedów według Section 5.3.8. Tabela 1
(drabinka 16) podaje pozycje BYE, np.:

| Zgłoszenia | Seed 1 / Seed 2 | Wolne losy | Pozycje BYE |
|---|---|---|---|
| 14 | 1 / 16 | 2 | 2, 15 |
| 12 | 1 / 16 | 4 | 2, 6, 11, 15 |
| 10 | 1 / 16 | 6 | 2, 4, 6, 11, 13, 15 |
| 9 | 1 / 16 | 7 | 2, 4, 6, 8, 11, 13, 15 |

Pierwsze wolne losy stoją obok seedów 1 i 2 (pozycje 2 i 15), kolejne
rozchodzą się po pozostałych ćwiartkach. Przy mniej niż 16 zgłoszeniach
rozstawieni są tylko dwaj, więc część wolnych losów przypada na pozycje
losowane (np. przy 12 zgłoszeniach pozycje 5 i 12 dostają wolny los, a nie są
miejscami seedów).

### Rozkład po połówkach

- BWF: w tabelach 1 i 2 pozycje są symetryczne między połówkami (przy parzystej
  liczbie wolnych losów po równo w górnej 1–8 i dolnej 9–16), przy nieparzystej
  górna połówka ma o jeden więcej (np. 9 zgłoszeń: 4 w górnej, 3 w dolnej).
- brackets-manager bez `balanceByes` i tournament-pairings: wynika z reguły,
  bo wolne losy idą do seedów 1, 2, 3…, a te są rozdzielone po połówkach
  naprzemiennie (12/16: dwa w każdej połówce; 5/8: 1 i 2 w różnych połówkach,
  3 w dolnej z 2). Żadna z bibliotek nie ma kodu, który to osobno wyrównuje.
- Challonge, Toornament, start.gg, Tournify: brak opisu.

### Losowanie a ustalone miejsca

Tam, gdzie losowanie jest opisane, losuje się kolejkę rozstawienia, a nie
pozycje wolnych losów. tournament-pairings przy `ordered = false` robi
`shuffle(players)` i dalej ten sam kod
([`SingleElimination.ts`](https://github.com/slashinfty/tournament-pairings/blob/611fb9a59598a8b33c4aee0bd4f0f95d27e3eb2d/src/SingleElimination.ts),
[`Shuffle.ts`](https://github.com/slashinfty/tournament-pairings/blob/611fb9a59598a8b33c4aee0bd4f0f95d27e3eb2d/src/Shuffle.ts)),
więc wolne losy dostają ci, którzy wylosowali najwyższe numery. Wyjątek to
Tournify: wolny los przydziela się albo wybierając „bye" jako rywala dla
wysoko notowanych, albo „perform a draw to assign byes randomly"
([Best placed teams and byes](https://help.tournifyapp.com/en/articles/8958025-best-placed-teams-and-byes)).

## 4. Losowanie bez rozstawienia

| System | Co się losuje | Źródło |
|---|---|---|
| tournament-organizer | kolejka: `sorting: 'none'` (domyślne) → `Pairings.SingleElimination(..., ordered = false)` → tasowanie listy | [`Tournament.ts` L68, L153](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/components/Tournament.ts#L153), [`TournamentValues.ts` L47–51](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/interfaces/TournamentValues.ts#L47-L51) |
| brackets-manager | nic; kolejność podaje wywołujący (`seeding`) | `creator.ts` `getSlots()` |
| Challonge | kolejka: „randomize seeds by clicking 'Shuffle Seeds'"; w API `PUT /participants/randomize` — „Randomizes the Participant Seeding" | [Participant management](https://kb.challonge.com/en/article/participant-management-1m6ooqe/), [Randomize Participants](https://challonge.apidog.io/randomize-participants-23619756e0.md) |
| Toornament | kolejka: „randomize the participants into the stage", z możliwością zablokowania wybranych seedów | [How placement works](https://help.toornament.com/placement/how-placement-works) |
| start.gg | brak opisu losowania; jest „Seed Generator" po poziomach umiejętności | [Using the Seed Generator](https://help.start.gg/en/articles/13768804-using-the-seed-generator) |
| Tournify | drabinkę wypełnia się klikając pustą pozycję („clicking on the empty spot and assign teams"); losowanie opisane dla grup („automated draw") i dla wolnych losów | [Create a format](https://help.tournifyapp.com/en/articles/8953884-create-a-format), [Format](https://help.tournifyapp.com/en/articles/8909549-format) |

Toornament przy automatycznym umieszczaniu bez losowania bierze kolejność
utworzenia uczestników: `auto_placement_enabled` — „participants will
automatically be placed in the stage using their creation order as seeding"
([organizer stages](https://developer.toornament.com/v2/doc/organizer_stages)).

Aplikacji amatorskich lig poza Tournify nie badałem pod tym kątem.

## 5. Ręczne rozstawienie i korekta przed pierwszym meczem

| System | Jak organizator ustala kolejność | Częściowe rozstawienie | Do kiedy |
|---|---|---|---|
| Challonge | wpisanie numeru („clicking the numeric seed value") albo przeciąganie za uchwyt; zmiany z listy uczestników widać w drabince | brak opisu | „before starting the tournament" |
| start.gg | przeciąganie w „Pools & Seeding"; w drabince „Edit Mode" i zamiana graczy przeciąganiem; import listy w kolejności przez Bulk Add (do 50 naraz); API `updatePhaseSeeding` z parami `seedId`/`seedNum` | generator seedów może „preserve exact seed order for top X players" | blokada po starcie drabinki; „You may only move and swap players who have not played a match in the current phase"; zmiana później wymaga resetu, który kasuje wyniki |
| Toornament | wybór uczestników w kolejności (seed według kolejności klikania), edycja numerów, podgląd z zapisem; w „Configure Bracket" zamiana wolnego seeda z innym na tym samym poziomie | zablokowanie wybranych seedów, potem losowanie reszty | także po starcie etapu, ale uczestnik z wynikiem jest zablokowany; zmiana rozmiaru etapu regeneruje mecze, seedy zostają |
| Tournify | przypisanie drużyny do pustej pozycji kliknięciem | wolny los ręcznie albo losowaniem | brak opisu |
| brackets-manager | `manualOrdering` (lista seedów na pozycjach) przy tworzeniu; `manager.update.seeding()` później | `null` w seedingu = BYE, `confirmSeeding()` zamienia TBD na BYE | `assertCanUpdateSeeding` odrzuca zmianę, gdy mecz rundy 1 jest `Archived` („round 2 was started") albo gdy zmiana dotyczy meczu z zablokowanymi uczestnikami |

Źródła: Challonge
[Participant management](https://kb.challonge.com/en/article/participant-management-1m6ooqe/);
start.gg [Pools & Seeding](https://help.start.gg/en/articles/13764646-pools-seeding),
[Rearranging/swapping players](https://help.start.gg/en/articles/13764666-rearranging-swapping-players-in-a-bracket),
[Importing custom seeding](https://help.start.gg/en/articles/13764592-importing-custom-seeding-using-the-bulk-add-feature),
[Update Phase Seeding](https://developer.start.gg/docs/e2e/update-phase-seeding);
Toornament [How placement works](https://help.toornament.com/placement/how-placement-works),
[Configure your bracket](https://help.toornament.com/placement/configure-your-bracket),
[Change the size](https://help.toornament.com/structures/change-the-size-of-your-tournament);
brackets-manager [`update.ts` L159–190](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/update.ts#L159-L190),
[`base/updater.ts` L21–50, L106–122](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/updater.ts#L106-L122).

## 6. Mecz o 3. miejsce

| System | Domyślnie | Gdzie jest opcja | Źródło |
|---|---|---|---|
| brackets-manager | wyłączony (`consolationFinal || false`) | ustawienie etapu `consolationFinal` — „Optional final between semi-final losers." | [`creator.ts` L53](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L53), [`input.ts` L120–123](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/input.ts#L120-L123) |
| tournament-organizer | wyłączony (`consolation: false`) | `stageOne.consolation` / `stageTwo.consolation` — „If there is a third place match for single elimination." | [`Tournament.ts` L77–91](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/components/Tournament.ts#L77-L91), [`TournamentValues.ts` L132–135](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/interfaces/TournamentValues.ts#L132-L135) |
| Challonge | nie podano wprost (patrz niżej) | „Settings" turnieju, „Placement Matches" od 3. do 16. miejsca; wybór „3" to sam mecz o 3. miejsce; „must be enabled prior to the start of the tournament"; tylko single i double elimination | [Placement matches](https://kb.challonge.com/en/article/placement-matches-includes-3rd-place-match-eliminate-ties-in-both-single-and-double-elimination-tournaments-1xmxkv/) |
| Toornament | nie podano | ustawienie etapu `third_decider` — „requires at least 4 competitors in the stage" | [Stages](https://developer.toornament.com/v2/core-concepts/stages) |
| Tournify | brak przełącznika w opisie | osobny „single match" albo „sub bracket" klasyfikacyjny, który organizator dobudowuje | [Format](https://help.tournifyapp.com/en/articles/8909549-format) |
| start.gg | nie znaleziono | nie znaleziono | — |

W API Challonge v2.1 odpowiednikiem jest
`match_options.consolation_matches_target_rank` — „consolation matches will be
run to break ties up to this final placement", z wartością `default: 3`
w schemacie ([Create Tournament](https://challonge.apidog.io/create-tournament-23619740e0.md)).
Czy to „default" oznacza, że mecz o 3. miejsce powstaje bez ustawiania pola,
czy jest tylko przykładową wartością w schemacie apidog, nie sprawdziłem.

W tournament-pairings mecz o 3. miejsce dostaje numer rundy finału i numer
meczu o jeden większy niż finał, a półfinały dostają krawędź `loss` do niego
([`SingleElimination.ts`](https://github.com/slashinfty/tournament-pairings/blob/611fb9a59598a8b33c4aee0bd4f0f95d27e3eb2d/src/SingleElimination.ts),
blok `if (consolation)`).

## 7. Minimalna i maksymalna liczba drużyn

| System | Minimum | Maksimum / rozmiar | Źródło |
|---|---|---|---|
| brackets-manager | 2 („Impossible to create a stage with less than 2 participants.") | rozmiar etapu eliminacyjnego musi być potęgą dwójki; górnego limitu w kodzie brak | [`helpers.ts` L393–406](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L393-L406) |
| tournament-organizer | 2 (4 dla double elimination), błąd „Insufficient number of players" przy starcie | `maxPlayers`, 0 = „There is no maximum" | [`Tournament.ts` L943–958](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/components/Tournament.ts#L943-L958), [`TournamentValues.ts` L144–147](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/interfaces/TournamentValues.ts#L144-L147) |
| Toornament | 2 | rozmiar turnieju „can range from 2 to 256", więcej po kontakcie; zmiana rozmiaru etapu „will re-generate it, thus resetting all its matches" | [Change the size](https://help.toornament.com/structures/change-the-size-of-your-tournament) |
| Tournify | — | drabinka tylko w rozmiarze potęgi dwójki („like 2, 4, 8, 16, 32 or 64"), „brackets of other sizes are not available"; brakujące miejsca to wolne losy | [Best placed teams and byes](https://help.tournifyapp.com/en/articles/8958025-best-placed-teams-and-byes) |
| Challonge | nie znaleziono | `registration_options.signup_cap` — limit, po którym „the waitlist kicks in"; limitów planów nie potwierdziłem | [Create Tournament](https://challonge.apidog.io/create-tournament-23619740e0.md) |
| start.gg | nie znaleziono | nie znaleziono | — |
| BWF | 3 (najmniejszy wiersz Tabeli 1) | tabele do 256 pozycji (Tabele 6 i 7) | Section 5.3.8 |

## 8. Czego nie sprawdziłem

- **Skąd historycznie pochodzi porządek 1–16, 8–9…** Nie znalazłem źródła
  pierwotnego, które by go definiowało; opisuję tylko, jak liczą go dwie
  biblioteki i czym różni się od regulaminu BWF. Innych federacji (ITF, ATP,
  FIFA, PZPN, ZPRP) nie czytałem.
- **Jakie „seeding rules" stosuje Challonge**, gdy `sequential_pairings` jest
  wyłączone, i jak rozkłada wolne losy dla n innego niż 5. Dokumentacja tego
  nie mówi, a w aplikacji nie klikałem.
- **Czy mecz o 3. miejsce w Challonge v2.1 jest domyślnie włączony**
  (`consolation_matches_target_rank` z `default: 3`) i czy API v1 miało
  `hold_third_place_match` domyślnie `false` — archiwum było niedostępne.
- **start.gg:** jak seed przekłada się na pozycję w drabince, gdzie idą wolne
  losy, czy jest mecz o 3. miejsce i jakie są limity uczestników — przeczytane
  artykuły tego nie opisują.
- **Toornament:** jak seedy mapują się na pozycje drabinki, czy rozmiar etapu
  single elimination może nie być potęgą dwójki i gdzie wtedy idą wolne losy,
  oraz domyślna wartość `third_decider`.
- **Limity planów Challonge** (strona cennika zwraca 403).
- **Aktualność przepisów BWF:** czytałem GCR z 6.03.2020 i Section 5.3.8
  w mocy od 1.01.2018, obie z kopii poza domeną BWF. Z Section 5.3.8 czytałem tabele 1–3;
  tabele 4–7 (65–256 zgłoszeń) i Diagram 2 (rozmieszczenie wolnych losów na
  arkuszu) są w kopii, ale ich nie analizowałem.
- **Zachowanie bibliotek po instalacji.** Tabele w §2–3 to odtworzenie kodu,
  nie wynik uruchomienia paczek z npm.

## Dodatek: odtworzenie brackets-manager

Funkcje przepisane z
[`ordering.ts`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/ordering.ts)
(`inner_outer`) i
[`helpers.ts`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts)
(`balanceByes`, `setArraySize`). Uruchomienie: zapisać jako `sim.js`, `node sim.js`.

```js
const inner_outer = (array) => { if (array.length === 2) return array; let p = [1, 2]; while (p.length < array.length) { const s = p.length * 2, n = []; for (const x of p) n.push(x, s + 1 - x); p = n; } return p.map(x => array[x - 1]); };
const setArraySize = (a, l, v) => Array.from({ length: l }, (_, i) => a[i] ?? v);
function balanceByes(seeding, pc) {
  seeding = seeding.filter(v => v !== null);
  if (seeding.length < pc / 2) return setArraySize(seeding.flatMap(v => [v, null]), pc, null);
  const nn = seeding.length, nc = pc - nn;
  const ae = seeding.slice(0, nn - nc).filter((_, i) => i % 2 === 0).map((_, i) => [seeding[2 * i], seeding[2 * i + 1]]);
  const an = seeding.slice(nn - nc, nn).map(v => [v, null]);
  return setArraySize([...ae.flat(), ...an.flat()], pc, null);
}
const pairs = a => { const r = []; for (let i = 0; i < a.length; i += 2) r.push(`${a[i] ?? 'BYE'}-${a[i + 1] ?? 'BYE'}`); return r.join(' | '); };
console.log('inner_outer 16:', inner_outer([...Array(16).keys()].map(i => i + 1)).join(','));
for (const [n, size] of [[5, 8], [6, 8], [7, 8], [12, 16], [9, 16]]) {
  const seeds = [...Array(n).keys()].map(i => i + 1);
  console.log(`n=${n}/${size} domyślnie:   `, pairs(inner_outer(setArraySize(seeds, size, null))));
  console.log(`n=${n}/${size} balanceByes:`, pairs(inner_outer(balanceByes(seeds, size))));
}
```
