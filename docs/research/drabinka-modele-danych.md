# Drabinka pucharowa: jak modelują ją dojrzałe systemy turniejowe

Badanie na potrzeby rozstrzygnięcia znaczenia pól `Match.nextMatchId` i
`Match.bracketSlot` w [`packages/api-contract/openapi.yaml`](../../packages/api-contract/openapi.yaml)
(schemat `Match`, linie ok. 1373–1407). Data: sierpień 2026. Źródła: wyłącznie
dokumentacja API i kod źródłowy modeli, bez blogów i tutoriali.

## 1. Streszczenie

Żaden z przebadanych systemów nie trzyma jednego pola typu `bracketSlot`, które
naraz opisuje pozycję meczu i miejsce docelowe zwycięzcy — to zawsze są dwie
osobne informacje. **Pozycja własna** jest wszędzie modelowana tak samo:
hierarchia `stage → group → round → match` plus **numer meczu w rundzie**
(`number` w brackets-model i Toornament, `match` w tournament-organizer, `round`
+ `identifier` w Challonge i start.gg). Etykiety typu „SF1" albo „Finał" nie są
przechowywane — są wyliczane z numeru rundy i liczby rund po stronie widoku
(brackets-viewer robi to funkcją `getMatchLabel`), z jednym wyjątkiem: Challonge
i start.gg trzymają krótki `identifier` („A", „F", „AT") jako etykietę meczu.
**Propagacja zwycięzcy** dzieli świat na dwa obozy: zapis **wstecz** —
mecz zna swoich poprzedników i stronę, na której wchodzą (Challonge
`player1_prereq_match_id`, start.gg `slots[].prereqId` + `slotIndex`) — oraz
zapis **do przodu** (tournament-organizer `path.win` / `path.loss`).
Trzecia droga to brak zapisu w ogóle: brackets-manager wylicza następny mecz
arytmetycznie z numeru rundy i numeru meczu, nie trzymając żadnej krawędzi w
bazie. Wniosek dla nas: strona (gospodarz/gość) musi być zapisana jawnie razem
ze wskaźnikiem na mecz, bo systemy, które jej nie zapisują, muszą ją odgadywać
heurystyką (tournament-organizer, `eliminationSeatingFirst`).

## 2. Systemy po kolei

### brackets-manager.js / brackets-model (Drarig29)

Pozycja własna — `Match` ma tylko współrzędne hierarchiczne i numer w rundzie,
źródło: [`brackets-model/src/storage.ts`](https://github.com/Drarig29/brackets-model/blob/master/src/storage.ts):

```ts
export interface Match extends MatchResults {
    /** ID of the match. */              id: Id,
    /** ID of the parent stage. */       stage_id: Id,
    /** ID of the parent group. */       group_id: Id,
    /** ID of the parent round. */       round_id: Id,
    /** The number of the match in its round. */ number: number,
    /** The count of match games this match has. ... */ child_count: number,
}
```

`Round` ma `number` („The number of the round in its group."), `Group` ma
`number`, `Stage` ma `number` — czyli pełna współrzędna meczu to
`(stage.number, group.number, round.number, match.number)`.

Propagacji **nie ma w danych**. Następny mecz jest liczony w locie:
[`brackets-manager.js/src/base/getter.ts`](https://github.com/Drarig29/brackets-manager.js/blob/master/src/base/getter.ts)
ma `getNextMatches()` („Gets the match(es) where the opponents of the current
match will go just after.") oraz `getPreviousMatches()` („Gets the matches
leading to the given match."), które składają współrzędne arytmetycznie i
dopiero potem robią `findMatch(groupId, roundNumber, matchNumber)`. Dla rundy
poprzedzającej: `findMatch(group_id, roundNumber - 1, match.number * 2 - 1)` i
`... match.number * 2`, a w drugą stronę
[`helpers.ts`](https://github.com/Drarig29/brackets-manager.js/blob/master/src/helpers.ts)
ma `getDiagonalMatchNumber()`: „Returns the match number of the corresponding
match in the next round by dividing by two."

Strona w następnym meczu też jest wyliczana (`getNextSide*`), a przy wypełnianiu
zachowywana jest informacja o pochodzeniu zawodnika — `ParticipantResult.position`
z [`other.ts`](https://github.com/Drarig29/brackets-model/blob/master/src/other.ts):

```ts
/** If `null`, the participant is to be determined. */ id: Id | null,
/** Indicates where the participant comes from. */     position?: number,
```

W `setNextOpponent()` i `resetNextOpponent()` jest wprost komentarz
`position: nextMatch[nextSide]?.position, // Keep position.` — czyli `position`
to trwały ślad „skąd tu wchodzi ten slot" (seed w pierwszej rundzie, numer meczu
źródłowego dalej), niezależny od tego, kto aktualnie ten slot zajmuje.
Komentarz: model minimalny — pozycja własna zapisana, propagacja policzona z
kształtu drabinki, dzięki czemu nie da się jej rozspójnić.

Rysowanie: etykiety rund i meczów nie są w danych, tylko liczone w widoku —
[`brackets-viewer.js/src/lang.ts`](https://github.com/Drarig29/brackets-viewer.js/blob/master/src/lang.ts)
ma `getMatchLabel(matchNumber, roundNumber, roundCount)`, który zwraca
`match-label.standard-bracket-semi-final` gdy `roundNumber === roundCount - 1`
i `match-label.standard-bracket-final` gdy `roundNumber === roundCount`.
Do narysowania wystarcza więc runda + numer meczu + łączna liczba rund.

### Challonge (API v1)

Przykładowa odpowiedź w oficjalnej dokumentacji
[List a tournament's matches (index)](https://api.challonge.com/v1/documents/matches/index)
(dziś przekierowuje na `challonge.apidog.io`, który jest SPA — czytelny snapshot:
[web.archive.org, 2025-05-12](https://web.archive.org/web/20250512183940/https://api.challonge.com/v1/documents/matches/index))
zawiera w obiekcie `match` m.in.:

```json
"id": 23575258, "identifier": "A", "round": 1, "group_id": null,
"player1_id": 16543993, "player1_is_prereq_match_loser": false, "player1_prereq_match_id": null,
"player2_id": 16543997, "player2_is_prereq_match_loser": false, "player2_prereq_match_id": null,
"prerequisite_match_ids_csv": "", "state": "open", "winner_id": null, "loser_id": null
```

Pozycja własna: `round` + `identifier` (litera meczu, np. „A"). Propagacja:
zapisana **wstecz i per slot** — dla każdej ze stron (`player1`, `player2`)
osobno mecz źródłowy (`playerN_prereq_match_id`) i to, czy wchodzi tam zwycięzca
czy przegrany (`playerN_is_prereq_match_loser`). To ostatnie pole obsługuje
jednocześnie dolną drabinkę double elimination i mecz o 3. miejsce.
`prerequisite_match_ids_csv` to pochodna zbiorcza (lista obu poprzedników).
Komentarz: dwa niezależne wymiary — „skąd" (id meczu) i „kto" (zwycięzca vs
przegrany) — a strona wynika z tego, w którym polu (`player1_*` czy `player2_*`)
wskaźnik siedzi.

Uwagi o granicach źródła: pola `suggested_play_order` **nie ma** w archiwalnej
próbce odpowiedzi v1 — nie potwierdzam go w źródle pierwotnym. Podobnie nie
potwierdziłem w dokumentacji, że ujemne wartości `round` oznaczają dolną
drabinkę (próbka pokazuje tylko `round: 1`). Zmiana już wprowadzonego wyniku ma
osobny endpoint „Reopen a match" (pozycja w menu Match dokumentacji v1).

### start.gg (dawniej smash.gg), GraphQL

`Set` — [dokumentacja typu Set](https://smashgg-schema.netlify.app/reference/set.doc)
(kanoniczny adres `developer.start.gg/reference/set.doc` przekierowuje tam 307):

- `round` — „The round number of the set. Negative numbers are losers bracket"
- `identifier` — „The letters that describe a unique identifier within the pool. Eg. F, AT"
- `fullRoundText` — „Full round text of this set"
- `slots` — „A possible spot in a set. Use this to get all entrants in a set."

`SetSlot` — [dokumentacja typu SetSlot](https://smashgg-schema.netlify.app/reference/setslot.doc):

- `slotIndex` — „The index of the slot. Unique per set."
- `prereqId` — „Pairs with prereqType, is the ID of the prereq."
- `prereqType` — „Describes where the entity in this slot comes from."
- `prereqPlacement` — „Given a set prereq type, defines the placement required in the origin set to end up in this slot."
- `entrant` — „The entrant currently or eventually participating in this slot."

Komentarz: model wstecz jak w Challonge, ale bardziej ogólny — slot jest bytem
(`slotIndex` = strona), a jego pochodzenie opisuje trójka
`prereqType` (skąd w ogóle: inny set, seeding, faza) + `prereqId` +
`prereqPlacement` (1. miejsce = zwycięzca, 2. = przegrany).

### Toornament (API v2)

[Viewer: matches](https://developer.toornament.com/v2/doc/viewer_matches) — pola
`id`, `stage_id` („The id of the stage that contains this match."), `group_id`,
`round_id`, `number` („The match number (a relative identifier within a
round)."), `type` (`duel`, `ffa`, `bye`), `status`. Wewnątrz `opponents`:
`number` („A relative identifier between 1 and the total number of participants,
it is unique and determined by the seeding.") i `position` („The position of the
participant in the ranking."). [Viewer: rounds](https://developer.toornament.com/v2/doc/viewer_rounds)
— `number` („A number used for ordering rounds."), `name` („The name of the
round.", maks. 30 znaków), `closed`.

Komentarz: pozycja własna dokładnie jak w brackets-model (hierarchia + `number`),
a **żadne pole publicznego modelu meczu nie wskazuje na mecz następny ani
poprzedni** — struktura drabinki jest wiedzą silnika, nie kontraktu. Uwaga: w
Toornament `opponents[].position` **nie** znaczy „pozycja w drabince", tylko
miejsce w rankingu meczu; nazwa jest myląca w stosunku do brackets-model.

### tournament-organizer (slashinfty), OSS npm

[`src/interfaces/MatchValues.ts`](https://github.com/slashinfty/tournament-organizer/blob/main/src/interfaces/MatchValues.ts):

```ts
/** Round number of the match. */ round: number,
/** Match number of the match. */ match: number,
/**
 * Details about the subsequent matches for the players if the current format is elimination or stepladder.
 */
path: {
    /** ID of the next match for the winner of the current match (or `null` if none). */  win: string | null,
    /** ID of the next match for the loser of the current match (or `null` if none). */   loss: string | null
}
```

Komentarz: jedyny z przebadanych, który zapisuje propagację **do przodu**, i to
dwiema krawędziami (zwycięzca i przegrany) — ale **bez strony docelowej**.
Konsekwencja jest widoczna w kodzie: `Tournament.eliminationSeatingFirst()`
(„Places a player in an elimination match based on their previous match") musi
najpierw odnaleźć poprzedników skanem po wszystkich meczach
(`this.getMatches().filter(match => m.getId() === match.getPath().win || ...)`),
a potem trzema gałęziami `if` porównującymi numery rund i meczów zdecydować, czy
zawodnik ląduje w `player1` czy `player2`. To jest dokładnie koszt niezapisania
strony.

### FACEIT

Nie potwierdzone w źródle pierwotnym. Publiczna dokumentacja Data API
(`docs.faceit.com/docs/data-api/data`) pokazuje w obiekcie meczu `round` i
`group`, ale nie udało mi się w niej znaleźć schematu wiążącego mecze w drabinkę
(jest osobny endpoint `GET /tournaments/{tournament_id}/brackets`, którego
schematu nie zweryfikowałem). Sportradara nie badałem — publiczne schematy są za
rejestracją, więc nie mam źródła pierwotnego do zacytowania.

## 3. Tabela porównawcza

| System | Pozycja własna | Propagacja zwycięzcy | Jedno pole czy dwa |
|---|---|---|---|
| brackets-model / brackets-manager | `stage_id`, `group_id`, `round_id` + `Match.number`; `Round.number`; etykieta („SF1") liczona w widoku | brak w danych — `getNextMatches()` liczy z `round.number` i `match.number` (`getDiagonalMatchNumber`); `opponent.position` pamięta pochodzenie slotu | dwa byty, ale drugi jest **wyliczany**, nie przechowywany |
| Challonge v1 | `round` + `identifier` (litera) | wstecz, per strona: `player1_prereq_match_id` / `player2_prereq_match_id` + `playerN_is_prereq_match_loser`; pochodne `prerequisite_match_ids_csv` | rozdzielone; strona zakodowana w nazwie pola (`player1_` vs `player2_`) |
| start.gg | `Set.round` (ujemna = dolna drabinka), `Set.identifier`, `fullRoundText` | wstecz, per slot: `SetSlot.slotIndex` + `prereqId` + `prereqType` + `prereqPlacement` | rozdzielone, trzy osobne wymiary pochodzenia |
| Toornament v2 | `stage_id`, `group_id`, `round_id` + `match.number`; `round.name` | brak w publicznym modelu meczu | tylko pozycja własna |
| tournament-organizer | `round` + `match` | do przodu: `path.win`, `path.loss` (id meczu, **bez** strony) | dwa pola, ale strony brak → heurystyka w kodzie |

## 4. Rekomendacja dla nas

**Rozdzielić dwie odpowiedzialności i nie zostawiać `bracketSlot` w obecnym,
dwuznacznym kształcie.** Uzasadnienie punkt po punkcie:

1. **Pozycja własna: dodać numer meczu w rundzie, nie stringową etykietę.**
   Wszystkie cztery systemy z jawną pozycją kodują ją jako parę
   *runda × numer meczu w rundzie* (`Round.number` + `Match.number` w
   brackets-model i Toornament, `round` + `match` w tournament-organizer).
   Mamy już `Match.round` (`RoundSummary` z `order`), brakuje numeru w rundzie.
   Proponuję `matchNumber: integer` (1-based, unikalny w obrębie rundy).
   Etykiety „SF1" / „Finał" wyliczy front — dokładnie tak, jak robi to
   `brackets-viewer` w `getMatchLabel(matchNumber, roundNumber, roundCount)`.
   Trzymanie stringa `"SF1-home"` w API oznaczałoby, że kolejność rund jest
   zakodowana w tekście i przy zmianie rozmiaru drabinki (8 vs 16 drużyn) trzeba
   przepisywać dane zamiast przeliczać widok. Jeśli mimo to chcemy stabilnej
   etykiety do linkowania (jak Challonge `identifier` czy start.gg
   `fullRoundText`), to niech to będzie osobne, wyraźnie nazwane pole
   read-only — nie ta sama rzecz co pozycja.

2. **Propagacja: zostawić `nextMatchId`, ale dołożyć jawną stronę.**
   Kierunek „do przodu" jest w mniejszości (tylko tournament-organizer), ale
   jest dla nas wystarczający i najprostszy do wypełniania przez silnik.
   Krytyczne jest to, że **strona musi być zapisana**: tournament-organizer,
   który zapisuje tylko `path.win`, płaci za to funkcją
   `eliminationSeatingFirst()` zgadującą `player1`/`player2` z numerów rund i
   meczów. Challonge i start.gg stronę zapisują wprost (osobne pola
   `player1_*`/`player2_*`, `slotIndex`). Proponuję:

   ```yaml
   nextMatchId:   type: [integer, 'null']   # mecz, do którego awansuje zwycięzca
   nextMatchSlot: type: [string, 'null']    # enum: home | away — strona w meczu nextMatchId
   ```

   Niezmiennik: oba pola są `null` albo oba nie-`null`, i tylko w fazie
   `knockout`. Nazwa `nextMatchSlot` czyta się jednoznacznie („slot w meczu
   następnym"), czego `bracketSlot` nie robi.

3. **Nie duplikować krawędzi.** Jedno źródło prawdy: albo do przodu
   (`nextMatchId` + `nextMatchSlot`), albo wstecz (odpowiedniki
   `player1_prereq_match_id`). Nie oba naraz w kontrakcie. Jeżeli widok
   drabinki będzie potrzebował poprzedników („zwycięzca ĆF1 vs zwycięzca ĆF2"
   w pustym jeszcze slocie), backend zbuduje odwrotny indeks z tych samych
   danych — tak jak Challonge wystawia `prerequisite_match_ids_csv` jako
   pochodną. Alternatywnie: hint pochodzenia dla pustego slotu w postaci
   liczby, jak `ParticipantResult.position` w brackets-model („Indicates where
   the participant comes from"), zachowywanej przy resecie meczu.

4. **Konsekwencja kierunku.** Zapis do przodu ma tę wadę, że przy pustym slocie
   mecz nie wie, kto do niego przyjdzie — potrzebny jest skan albo indeks
   (widać to w tournament-organizer, linia z `getMatches().filter(...)`). Zapis
   wstecz (Challonge, start.gg) jest wygodniejszy dokładnie dla widoku
   drabinki, bo mecz sam opisuje oba swoje wejścia i renderuje etykiety „TBD"
   bez dodatkowych zapytań. Jeśli nasz priorytet to publiczny widok drabinki,
   warto rozważyć model Challonge zamiast `nextMatchId`; jeśli priorytetem jest
   prostota zapisu wyniku — zostajemy przy „do przodu". Wybór jest odwracalny
   tylko przed zamrożeniem `Match`, więc należy go podjąć teraz i zapisać jako
   ADR.

## 5. Pułapki, których warto uniknąć

- **Jedno pole kodujące dwie rzeczy.** `"SF1-home"` jako string łączy
  identyfikator meczu i stronę; parsowanie stringa po stronie klienta to
  gwarantowany błąd przy pierwszym turnieju o innym rozmiarze. Żaden z
  przebadanych systemów tego nie robi.
- **Etykiety rund w danych.** brackets-viewer wylicza „Semi Final" z
  `roundNumber === roundCount - 1`. Zapisana na sztywno etykieta rozjeżdża się,
  gdy zmieni się liczba uczestników fazy pucharowej.
- **Mecz o 3. miejsce.** Nie leży na ścieżce zwycięzcy, więc `nextMatchId` go
  nie obsłuży. Challonge rozwiązuje to flagą `playerN_is_prereq_match_loser`,
  start.gg — `prereqPlacement` (2 = przegrany), brackets-manager ma osobny typ
  grupy i `getFinalMatchLabel(finalType, ...)` z `consolation_final`. Jeśli
  chcemy mecz o 3. miejsce, potrzebujemy drugiej krawędzi (propagacja
  przegranego) albo flagi typu meczu — inaczej dopisze się to później jako
  wyjątek w kodzie.
- **Bye / wolny los.** W brackets-model slot ustawiony na `null` znaczy BYE i
  `setNextOpponentToBye()` przepycha go dalej, przeliczając `status`. Nasz
  kontrakt mówi dziś o pauzie tylko w kontekście ligi (`homeTeam` opis:
  pauza „nie tworzy meczu"). W drabince to inna sytuacja — trzeba odróżnić
  „slot jeszcze nierozstrzygnięty" (TBD) od „slot pusty na stałe" (BYE), bo
  oba wyglądają jak `homeTeam: null`.
- **Zmiana wyniku meczu, który już wypełnił dalszą drabinkę.** brackets-model
  ma na to osobny status: `Archived` — „At least one participant completed his
  following match", oraz `Locked` — „The two matches leading to this one are not
  completed yet"; `resetNextOpponent()` czyści `id`, ale zostawia `position`
  („Keep position"). Challonge daje na to osobną operację „Reopen a match".
  Nasz `MatchStatus` powinien umieć powiedzieć „tego wyniku nie da się już
  zmienić bez cofnięcia dalszych meczów".
- **Double elimination.** Wymaga dwóch krawędzi z meczu (zwycięzca i przegrany)
  — `path.win` / `path.loss` w tournament-organizer, ujemne `round` w start.gg.
  Jeśli kiedykolwiek chcemy tę drabinkę, pojedynczy `nextMatchId` będzie
  wąskim gardłem; nazwa pola powinna od razu to przewidzieć albo świadomie
  zamknąć zakres na single elimination w ADR.
