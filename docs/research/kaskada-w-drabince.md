# Poprawka wyniku i kaskada w drabince

Badanie na potrzeby ticketu
[#213 „S4: research — poprawka wyniku i kaskada w aplikacjach turniejowych"](https://github.com/dawer2253/sports-tournament-app/issues/213)
(mapa [#211](https://github.com/dawer2253/sports-tournament-app/issues/211)).
Fakty do grillingu „S4: wynik, karne i kaskada”. Data: 12 października 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Opisuje, co robią biblioteki
i aplikacje turniejowe, gdy organizer poprawia wynik meczu pucharowego, którego
zwycięzca już awansował. Nie wskazuje wariantu dla nas. Modele danych drabinki
(krawędzie do przodu i wstecz, `position`, statusy brackets-model) opisuje
[`drabinka-modele-danych.md`](drabinka-modele-danych.md) i tutaj ich nie
powtarzam. Terminy według [`CONTEXT.md`](../../CONTEXT.md): mecz (Match),
drabinka, mecz zależny (mecz, do którego trafia zwycięzca lub przegrany),
karne (`homePenalties`, `awayPenalties`).

## 0. Źródła i metoda

| Źródło | Co czytane |
|---|---|
| [brackets-manager.js](https://github.com/Drarig29/brackets-manager.js) | kod `src/reset.ts`, `src/update.ts`, `src/base/updater.ts`, `src/helpers.ts` i testy `test/update.spec.js` z commita [`02027cf`](https://github.com/Drarig29/brackets-manager.js/tree/02027cff5d687068719bebbc765072f382e81390); typy z [brackets-model `59aedea`](https://github.com/Drarig29/brackets-model/tree/59aedea4c034a6eae5b88bd14f784b263164e808); [dokumentacja „Updating matches”](https://drarig29.github.io/brackets-docs/user-guide/updating-matches/) |
| [tournament-organizer](https://github.com/slashinfty/tournament-organizer) | kod `src/components/Tournament.ts` i `Match.ts` z commita [`4b2af5a`](https://github.com/slashinfty/tournament-organizer/tree/4b2af5a2d0cec695085a5df161b6a5c5caa47fae) |
| Challonge | dokumentacja API v1 „Reopen a match” (snapshot archiwalny, bo `api.challonge.com/v1/documents` przekierowuje na SPA `challonge.apidog.io`) |
| start.gg | referencja GraphQL mutacji ([smashgg-schema.netlify.app](https://smashgg-schema.netlify.app/reference/mutation.doc), na które przekierowuje `developer.start.gg`) |
| Toornament | [help.toornament.com](https://help.toornament.com/), [developer.toornament.com](https://developer.toornament.com/v2/) |
| Tournify | [help.tournifyapp.com](https://help.tournifyapp.com/en/) |
| Battlefy | [help.battlefy.com](https://help.battlefy.com/en/) |
| LeagueRepublic | [help.leaguerepublic.com](https://help.leaguerepublic.com/en/) |

Ograniczenia:

- **Kod bibliotek był czytany, nie uruchamiany.** Zachowanie opisane w §2
  wynika z lektury kodu i z asercji w testach biblioteki (testy cytuję tam,
  gdzie istnieją). Przypadki bez testu oznaczam „z kodu”.
- **W aplikacjach nic nie było klikane.** Bez kont, bez logowania. Każde
  zdanie o aplikacji to odczyt dokumentacji. Dokumentacja zwykle mówi, gdzie
  jest przycisk, a milczy o skutkach w dalszej części drabinki; luki zbiera §5.
- Strony pomocy były pobierane przez narzędzie streszczające, więc krótkie
  cytaty z dokumentacji aplikacji są bliskie oryginałowi, ale nie zawsze
  znak w znak. Cytaty z kodu bibliotek są dokładne.
- Część stron (Toornament, Tournify, Battlefy, LeagueRepublic) zebrała sesja
  pomocnicza. Twierdzenia nośne (blokada w Toornament, forfeit w Toornament,
  statusy meczu w API Toornament, ustawienia karnych w Tournify, brak
  walkowera w Tournify, reset w Battlefy) przeczytałem ponownie u źródła.

## 1. Streszczenie

- **Dwie szkoły: blokada albo kaskada.** brackets-manager i Toornament
  **blokują** poprawkę meczu, gdy mecz zależny już się zaczął: trzeba najpierw
  ręcznie wyczyścić mecz późniejszy. Challonge w API opisuje „Reopen” jako
  operację, która **sama resetuje mecze następujące**. start.gg ma mutację
  `resetSet` z argumentem `resetDependentSets`, czyli kaskada jest tam opcją
  żądania; jej dokładnej semantyki dokumentacja nie opisuje.
- **Czyszczony jest slot, nie wynik meczu zależnego.** W obu bibliotekach
  odwrócenie awansu zeruje tylko miejsce drużyny w meczu następnym
  (brackets-manager zachowuje przy tym `position`, czyli ślad pochodzenia
  slotu). Wyniku meczu zależnego nie ruszają: brackets-manager w ogóle nie
  dopuszcza do sytuacji, w której by go miał (blokada), tournament-organizer
  nie sprawdza tego wcale.
- **Zmiana zwycięzcy bez resetu.** brackets-manager pozwala zmienić
  zwycięzcę zakończonego meczu wprost, dopóki mecz następny się nie zaczął:
  zwycięzca w meczu następnym zostaje podmieniony. start.gg tego zabrania
  (`updateBracketSet` nie zmienia zwycięzcy, trzeba `resetSet`).
- **Moment awansu.** Wszędzie, gdzie to opisano, awans następuje dopiero przy
  rozstrzygnięciu meczu, nie przy wpisaniu wyniku. Wpisanie samego wyniku
  przestawia mecz w stan „trwa” (brackets-manager `Running`, Toornament
  `running`). W brackets-manager wpisanie wyniku w meczu następnym od razu
  blokuje poprawki meczów poprzednich.
- **Ostrzeżenie.** Żadne źródło nie opisuje ostrzeżenia z listą meczów do
  wyczyszczenia ani dwuetapowego potwierdzenia. Biblioteki rzucają błąd
  („The match is locked.”), API start.gg ma flagę w żądaniu.
- **Termin, obiekt, statystyki wyczyszczonego meczu.** Żadna aplikacja tego
  nie opisuje. W bibliotekach reset dotyka tylko pól uczestników i statusu,
  pozostałe pola meczu zostają.
- **Remis i karne.** Remis w drabince jest zabroniony w obu bibliotekach
  i w Toornament. Osobnego pola na karne nie ma w żadnej bibliotece ani
  w API Toornament. Tournify ma ustawienie „wpisz wynik serii karnych”
  zamiast wskazania zwycięzcy, LeagueRepublic ma statusy meczu „Home Win
  Penalties” i „Away Win Penalties”.
- **Walkower i wycofanie.** brackets-manager i Toornament mają `forfeit` na
  uczestniku meczu (przeciwnik wygrywa). tournament-organizer przy usunięciu
  gracza oddaje jego aktywny mecz przeciwnikowi i przepina ścieżki. Tournify
  nie ma walkowera (obejście: wynik umowny).

## 2. Biblioteki (kod źródłowy)

### brackets-manager.js (Drarig29)

Permalinki prowadzą do commita `02027cf`.

**Poprawka zakończonego meczu, gdy mecz zależny jeszcze się nie zaczął.**
`update.match()` na meczu `Completed` jest dozwolone. Podanie przeciwnego
zwycięzcy przelicza wynik i podmienia uczestnika w meczu następnym. Test
[`should change the winner of the match and update in the next match`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/test/update.spec.js#L80-L101)
sprawdza, że po zmianie zwycięzcy w meczu następnym siedzi nowy uczestnik.
Dokumentacja: w meczu zakończonym edytowalne są tylko wyniki, rezultaty,
forfeit i status, a uczestnicy nie
([Updating matches](https://drarig29.github.io/brackets-docs/user-guide/updating-matches/)).

**Blokada, gdy mecz zależny się zaczął.** Gdy mecz następny przechodzi w stan
`Running` lub dalej, mecze go poprzedzające dostają status `Archived`
([`updatePrevious`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/updater.ts#L249-L257)).
`Archived` oznacza w brackets-model „At least one participant completed his
following match”, ale w kodzie zapala się już przy `Running`, czyli przy
pierwszym wpisanym wyniku meczu następnego
([`isMatchStarted`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L629-L631)
to „którykolwiek wynik ustawiony”). Mecz `Archived` odrzuca aktualizację
([`isMatchUpdateLocked`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L732-L735),
[`updateMatch`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/updater.ts#L159-L164)).
Test [`should throw when one of participants already played next match`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/test/update.spec.js#L656-L662).
Kaskady nie ma: żeby poprawić mecz wcześniejszy, trzeba najpierw zresetować
mecz późniejszy.

**Reset wyniku.** `reset.matchResults(matchId)`
([`src/reset.ts`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/reset.ts#L16-L52)):

- rzuca `The match is locked.`, jeśli którykolwiek mecz następny ma status
  `Running` lub wyższy (wyjątek: mecz rozstrzygnięty wolnym losem),
- czyści `status`, `forfeit` i `result` obu uczestników, ale **zostawia
  `score`**; mecz z wpisanym wynikiem wraca do `Running`, bez wyniku do
  `Ready` (testy [L168–L196](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/test/update.spec.js#L168-L196)),
- w meczu następnym wywołuje
  [`resetNextOpponent`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L1107-L1114):
  slot dostaje `id: null` z zachowaniem `position`, a status meczu następnego
  ustawia się na `Locked`. Sięga to jednego poziomu (mecz następny dla
  zwycięzcy, a przy meczu o 3. miejsce lub dolnej drabince także mecz
  przegranego), bo dalsze mecze z definicji nie mogą mieć jeszcze wyniku.

**Zmiana wyniku bez zmiany zwycięzcy.** Kod rozróżnia „prostą zmianę wyniku”
(`// Don't update related matches if it's a simple score update.`,
[updater.ts L174–L175](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/updater.ts#L174-L175)).
Z kodu, bez testu: na meczu już zakończonym
[`setMatchResults`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L805-L844)
działa tak:

- żądanie z wynikiem i rezultatem (np. `score: 3, result: 'win'`) zostawia
  mecz zakończonym i ponownie wpisuje tego samego zwycięzcę do meczu
  następnego (operacja idempotentna),
- żądanie z samym wynikiem, bez `result` i bez `status`, trafia w gałąź
  `!completed && currentlyCompleted` i **cofa rozstrzygnięcie** (jak
  `resetMatchResults`), a w meczu następnym czyści slot.

**Moment awansu.** Wpisanie samego wyniku ustawia `Running`
([`setScores`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L1184-L1198)).
Uczestnik trafia do meczu następnego dopiero, gdy mecz jest rozstrzygnięty:
`result: 'win'`, `forfeit` albo `status: Completed` z wynikami
([`updateNext`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/updater.ts#L295-L310),
[`handleGivenStatus`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L1145-L1166)).

**Termin, obiekt, statystyki.** Model meczu nie ma takich pól. Pola własne
użytkownika („extra fields”) są przepisywane przy aktualizacji
([`setExtraFields`](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L866-L908)),
a reset i `resetNextOpponent` ich nie dotykają, czyli z kodu: zostają.

**Remis i karne.** Remis w fazie pucharowej rzuca
`Having a draw is forbidden in an elimination tournament.`
([helpers.ts L811–L812](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L811-L812)).
`score` to jedna liczba; osobnego pola na dogrywkę lub karne nie ma. Przy
remisie w wyniku zwycięzcę wskazuje się samym `result: 'win'`.

**Walkower.** `forfeit: true` u uczestnika daje zwycięstwo przeciwnikowi;
podwójny forfeit przepycha dalej wolny los (`setNextOpponentToBye`).
Dokumentacja: w fazie pucharowej podwójny forfeit dyskwalifikuje obu.

### tournament-organizer (slashinfty)

Permalinki prowadzą do commita `4b2af5a`.

**Poprawka.** Osobna operacja
[`clearResult(id)`](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/components/Tournament.ts#L1202-L1263):

- rzuca `Can not clear an active match`, gdy mecz nie jest rozstrzygnięty,
- zeruje wynik meczu i przywraca obu graczy jako aktywnych,
- w meczu ze ścieżki `path.win` (i `path.loss`) zeruje slot zajęty przez
  któregoś z graczy tego meczu i ustawia temu meczowi `active: false`.

Z kodu: `clearResult` **nie sprawdza**, czy mecz zależny ma już wynik.
`Match.set` scala obiekty (`Object.assign`), więc ustawienie samego `id: null`
zostawia w meczu zależnym liczniki `win`, `loss`, `draw`. Operacja sięga
jednego poziomu. Blokady nie ma. `enterResult` też nie sprawdza, czy mecz był
już rozstrzygnięty
([L1051–L1191](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/components/Tournament.ts#L1051-L1191)).

**Moment awansu.** `enterResult` od razu kończy mecz (`active: false`)
i wpisuje zwycięzcę do meczu następnego. Stanu „trwa z wynikiem” biblioteka
nie ma: mecz jest aktywny albo rozstrzygnięty.

**Remis i karne.** W eliminacjach `enterResult` rzuca
`Players can not draw a match during an elimination format`. Wynik to liczby
wygranych gier (`player1Wins`, `player2Wins`, `draws`). Na dane dodatkowe mecz
ma wolny obiekt `meta`.

**Wycofanie.** [`removePlayer`](https://github.com/slashinfty/tournament-organizer/blob/4b2af5a2d0cec695085a5df161b6a5c5caa47fae/src/components/Tournament.ts#L816-L941)
w eliminacjach oddaje aktywny mecz gracza przeciwnikowi (porażka wycofanego
liczbą gier równą połowie `bestOf`, zaokrągloną w górę), wpisuje przeciwnika
do meczu następnego, a gdy gracz czekał na rywala, przepina `path` meczu
poprzedzającego tak, żeby jego zwycięzca ominął pusty mecz.

## 3. Aplikacje (dokumentacja)

### Challonge

- API v1, „Reopen a match”, `POST /v1/tournaments/{tournament}/matches/{match_id}/reopen`:
  „Reopens a match that was marked completed, automatically resetting matches
  that follow it” (snapshot
  [web.archive.org, 2023-12-21](https://web.archive.org/web/20231221070820/https://api.challonge.com/v1/documents/matches/reopen)).
  Jedyny parametr poza kluczem to identyfikator meczu, bez flagi
  potwierdzenia. Opis nie mówi, jak daleko sięga reset (jeden mecz czy cała
  gałąź) ani czy dotyczy meczów już rozegranych.
- Pozostałych stron API v1 (aktualizacja meczu, oznaczanie „underway”,
  usuwanie uczestnika) nie udało mi się przeczytać: archiwum zwracało
  „Temporarily Offline”, a bieżąca dokumentacja to SPA. Patrz §5.

### start.gg (GraphQL)

[Referencja mutacji](https://smashgg-schema.netlify.app/reference/mutation.doc):

- `resetSet(setId, resetDependentSets: Boolean)`: „Resets set to initial
  state, can affect other sets and phase groups”. Argument
  `resetDependentSets` nie ma opisu.
- `reportBracketSet(setId, winnerId, isDQ, gameData)`: zgłasza zwycięzcę lub
  statystyki gier; podanie `winnerId` oznacza set jako zakończony. `gameData`
  nadpisuje wcześniej zgłoszone dane gier.
- `updateBracketSet(...)`: aktualizuje statystyki gier; zwycięzcy nie da się
  nią zmienić, dokumentacja odsyła do `resetSet`.
- `markSetInProgress`, `markSetCalled`: osobne stany „wywołany” i „w toku”.
- `isDQ` to flaga dyskwalifikacji przy zgłoszeniu wyniku.

Centrum pomocy start.gg nie ma artykułu o cofaniu zgłoszonego wyniku (szukane,
nie znalezione).

### Toornament

- **Blokada, nie kaskada.** Mecz drabinki jest zablokowany, gdy jeden z jego
  uczestników rozegrał już mecz następny; żeby go odblokować, trzeba
  zresetować wynik tego drugiego meczu
  ([Why are my matches locked?](https://help.toornament.com/faq/my-matches-are-locked-why)).
  Ta sama strona: mecz jest zablokowany także wtedy, gdy mecze do niego
  prowadzące nie są skończone.
- Jedyna opisana automatyczna zmiana struktury: w podwójnym finale zmiana
  zwycięzcy pierwszego meczu dodaje albo usuwa drugi mecz
  ([Double Finals](https://help.toornament.com/structures/double-finals)).
- **Status liczony z wyniku.** Status meczu (`pending`, `running`,
  `completed`) jest wyliczany automatycznie; `running` zapala się przy
  pierwszej informacji o wyniku, `completed` przy pełnym i poprawnym
  rozstrzygnięciu
  ([Core concepts: match](https://developer.toornament.com/v2/core-concepts/match/)).
  Ta sama strona mówi, że rozstrzygnięcie służy do postępu rozgrywek, ale nie
  mówi wprost, że awans czeka na `completed`.
- API: `opponents[].result` (`win`, `draw`, `loss`), `forfeit`, `score`,
  `rank`, `scheduled_datetime`, `played_at` („when the match was completed”)
  ([Organizer: matches](https://developer.toornament.com/v2/doc/organizer_matches)).
  Opis `PATCH` nie wspomina o propagacji ani o błędzie blokady.
- **Remis i forfeit.** Podwójny forfeit „is not possible in a bracket, just
  like a Draw”. Forfeit nie jest wyliczany z gier, trzeba go ustawić na
  meczu. Przy podwójnym forfeicie w drabince ustawia się jeden, a drugiego
  uczestnika oddaje walkowerem w jego następnym meczu
  ([The forfeit](https://help.toornament.com/match/the-forfeit)).
- Karne i dogrywka: brak pól w API. Według sesji pomocniczej uczestnik ma
  ogólny obiekt `properties`; nie sprawdzałem tego ponownie.

### Tournify

- Wynik można edytować albo wyczyścić z listy wyników
  ([Process results](https://help.tournifyapp.com/en/articles/8954782-process-results)).
  Drabinka sama przesuwa zwycięzców do następnej rundy (strona „Getting
  started”, odczyt sesji pomocniczej). Co dzieje się z następną rundą po
  zmianie wyniku: dokumentacja milczy.
- **Karne.** Ustawienie „Don't allow a draw as the end result in a group
  match” wymusza wskazanie zwycięzcy przy remisie, „even for group matches”
  (sformułowanie sugeruje, że w meczach pucharowych jest to zawsze wymagane;
  to wniosek, nie zdanie z dokumentacji). Zamiast wskazania zwycięzcy można
  wpisać pełny wynik serii karnych i wybrać, czy gole z karnych liczą się do
  bilansu bramek. Są też osobne punkty za wygraną po dogrywce, karnych lub
  złotym golu
  ([Scoring and tiebreakers](https://help.tournifyapp.com/en/articles/8955366-scoring-and-tiebreakers)).
  Wszystko opisane w kontekście grup; jak wygląda to na drabince, nie
  opisano.
- **Walkower.** Brak funkcji; obejście to wynik umowny i przeniesienie meczu
  do „Not Planned”
  ([FAQ - Results](https://help.tournifyapp.com/en/articles/9145357-faq-results)).

### Battlefy

- „Change Score”, potem „reset match” ustawia mecz na 0:0; przy włączonym
  check-inie obaj gracze muszą się zameldować ponownie
  ([reset or change score](https://help.battlefy.com/en/articles/2616722-how-do-i-reset-score-or-change-score-that-was-wrongly-inputted-on-the-bracket)).
  O meczu następnym i awansującej drużynie strona milczy.
- Według sesji pomocniczej dyskwalifikacja w eliminacjach to oddanie
  zwycięstwa przeciwnikowi, a usunięcie obu drużyn to ręczny łańcuch: wygrana
  dla jednej, potem przegrana dla niej w meczu, do którego awansowała
  ([disqualify](https://help.battlefy.com/en/articles/2616718-how-do-i-disqualify-a-player-team);
  nie czytałem ponownie).

### LeagueRepublic

Odczyt sesji pomocniczej, nie czytałem ponownie:

- Statusy meczu obejmują „Home Win Penalties”, „Away Win Penalties”,
  „Home Walkover”, „Away Walkover”
  ([glosariusz](https://help.leaguerepublic.com/en/articles/8805164-the-language-of-leaguerepublic-a-handy-glossary-for-beginners)).
- Organizer może ręcznie ustawić zwycięzcę dwumeczu albo dodać mecz
  (np. powtórkę)
  ([Changes to the tournament system](https://help.leaguerepublic.com/en/articles/2700021-changes-to-the-tournament-system)).
- Wynik „Latest Score” jest tymczasowy i nie wpływa na tabelę; oficjalny jest
  „Final Score”
  ([live results](https://help.leaguerepublic.com/en/articles/1149069-how-live-results-work-in-leaguerepublic)).
  Czy awans w pucharze czeka na „Final”, nie opisano.

## 4. Zestawienie

| Pytanie | brackets-manager | tournament-organizer | Challonge | start.gg | Toornament | Tournify | Battlefy |
|---|---|---|---|---|---|---|---|
| Mecz zależny już się zaczął | blokada (`Archived` od `Running`) | brak sprawdzenia | reset meczów następujących (zasięg nieopisany) | `resetDependentSets` w żądaniu (semantyka nieopisana) | blokada, reset ręczny od końca | nieopisane | nieopisane |
| Co się czyści | slot w meczu następnym (`id: null`, `position` zostaje), status `Locked` | slot w meczu następnym, liczniki zostają | „matches that follow it” | „can affect other sets” | nic samo | nieopisane | wynik meczu (0:0) |
| Zmiana zwycięzcy wprost | tak, gdy mecz następny się nie zaczął | nie ma osobnej ścieżki | przez Reopen | nie, tylko `resetSet` | nieopisane | edycja wyniku | reset i nowy wynik |
| Zmiana wyniku bez zmiany zwycięzcy | bez skutków dalej, o ile podano `result` (z kodu) | nieopisane | nieopisane | `updateBracketSet` | nieopisane | nieopisane | nieopisane |
| Ostrzeżenie | błąd `The match is locked.` | brak | brak opisu | flaga w żądaniu | blokada w UI | nieopisane | nieopisane |
| Moment awansu | rozstrzygnięcie, wynik daje `Running` | `enterResult` od razu | nieopisane (patrz §5) | `winnerId` kończy set | `completed` liczony z wyniku | automatycznie, kiedy dokładnie nieopisane | po wpisaniu wyniku |
| Remis w drabince | zabroniony | zabroniony | nieopisane | nie dotyczy | zabroniony | zwycięzca lub seria karnych | nieopisane |
| Karne | brak pola | brak pola (`meta`) | nieopisane | nie dotyczy | brak pola | wynik serii karnych | nie dotyczy |
| Walkower | `forfeit` | `removePlayer` | nieopisane (patrz §5) | `isDQ` | `forfeit` | brak, wynik umowny | dyskwalifikacja przez wynik |

## 5. Nie sprawdzone

- **Challonge poza „Reopen”.** Nie przeczytałem opisu `matches/update`
  (`scores_csv`, `winner_id`, czy dopuszcza zmianę zakończonego meczu),
  `mark_as_underway` ani `participants/destroy` (co dzieje się z meczami
  wycofanego uczestnika w trakcie turnieju). Archiwum zwracało „Temporarily
  Offline”, bieżąca dokumentacja to SPA. Nie wiem też, czy Reopen resetuje
  tylko mecz następny, czy całą gałąź do finału.
- **start.gg `resetDependentSets`.** Brak opisu argumentu, więc nie wiem, co
  się dzieje przy `false`, gdy set zależny ma wynik (błąd czy zostawienie).
- **Ostrzeżenie z listą meczów.** Żadne źródło nie opisuje, czy UI pokazuje
  listę meczów do wyczyszczenia. Nie klikałem w żadnej aplikacji.
- **Termin, obiekt i statystyki wyczyszczonego meczu** w aplikacjach: żadna
  dokumentacja tego nie opisuje.
- **Mecz trwający jako mecz zależny** w Challonge, start.gg i Tournify:
  nieopisane.
- **Zachowanie bibliotek** opisane „z kodu” nie było uruchamiane, w
  szczególności cofnięcie rozstrzygnięcia przez `update.match()` z samym
  wynikiem w brackets-manager oraz pozostawienie liczników w meczu zależnym
  po `clearResult` w tournament-organizer.
- Pola `properties` u uczestnika w API Toornament, artykuły Battlefy
  o dyskwalifikacji i strony LeagueRepublic znam z odczytu sesji
  pomocniczej, bez ponownego czytania.
- FACEIT, Sportlomo, Cup-manager: nie badane.
