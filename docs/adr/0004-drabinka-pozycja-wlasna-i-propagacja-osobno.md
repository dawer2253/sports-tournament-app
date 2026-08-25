# ADR-0004: W drabince pozycja własna meczu i propagacja to osobne pola

Status: przyjęte
Data: 2026-08-25

## Kontekst

`Match` opisywał drabinkę dwoma polami: `nextMatchId` oraz `bracketSlot`
z przykładową wartością `SF1-home`. Opis tego drugiego dawał się przeczytać
dwojako — jako pozycja własna meczu ("ten mecz jest półfinałem pierwszym") albo
jako miejsce docelowe zwycięzcy ("zwycięzca wchodzi na stronę gospodarza
półfinału pierwszego"). Przy pierwszym czytaniu nie wiadomo, na którą stronę
awansuje zwycięzca; przy drugim finał traci jakiekolwiek współrzędne, więc widok
drabinki nie ma go z czego umiejscowić, a człon `SF1` powiela informację
niesioną już przez `nextMatchId`.

Osobno stał problem sportów dopuszczających remis: mecz pucharowy musi mieć
zwycięzcę, a sam wynik go nie wyłania.

Rozstrzygnięcie musiało zapaść przed zamrożeniem `Match`, przewidzianym
w [ADR-0001](0001-kontrakt-openapi-jako-zrodlo-prawdy.md) już w v0.1.

Przegląd cudzych modeli danych zebrany jest w
[`docs/research/drabinka-modele-danych.md`](../research/drabinka-modele-danych.md).
Najważniejsze ustalenie: żaden z przebadanych systemów (brackets-model,
Challonge, start.gg, Toornament, tournament-organizer) nie trzyma jednego pola
łączącego pozycję własną z celem propagacji, a pozycja własna jest wszędzie parą
*runda × numer meczu w rundzie*, nigdy stringową etykietą.

## Rozważane warianty

**Doprecyzować `bracketSlot` jako slot docelowy.** Odrzucone: finał zostaje bez
pozycji własnej, więc widok drabinki musiałby parsować `round.name`, a nazwa
rundy jest tekstem, który organizer może zmienić.

**Zapisać pozycję własną jako etykietę (`SF1`, `F`).** Odrzucone: etykieta zależy
od rozmiaru drabinki, więc zmiana ośmiu drużyn na szesnaście wymagałaby
przepisania danych zamiast przeliczenia widoku. Systemy, które etykiety
wystawiają (Challonge `identifier`, start.gg `fullRoundText`), trzymają je
**obok** numerycznej pozycji, nie zamiast niej.

**Zapisać propagację wstecz**, tak jak Challonge (`player1_prereq_match_id`)
i start.gg (`slots[].prereqId`). Odrzucone, choć to model częstszy: jego przewaga
polega na wygodnym rysowaniu pustych slotów, a u nas front i tak dysponuje
kompletem meczów fazy i buduje odwrotny indeks samodzielnie — endpointy
publiczne nie są stronicowane, a w panelu faza pucharowa nawet przy szesnastu
drużynach to piętnaście meczów, czyli jedna strona odpowiedzi zawężonej
`stageId`. Zapis do przodu jest prostszy przy wpisywaniu wyniku.

**Osobne pola na pozycję własną i na propagację.** Wybrane.

## Decyzja

`bracketSlot` znika. `Match` niesie zamiast tego:

- `matchNumber` — numer meczu w rundzie, liczony od jedynki. Dostają go
  wszystkie mecze, nie tylko pucharowe: w lidze daje stabilną kolejność
  w obrębie kolejki i pozwala uniknąć pola pustego w połowie przypadków.
- `winnerToMatchId` — mecz, do którego wchodzi zwycięzca.
- `loserToMatchId` — mecz, do którego wchodzi przegrany. Niepuste wyłącznie
  tam, gdzie przegrany gdzieś trafia, czyli w praktyce w półfinałach turnieju
  z meczem o 3. miejsce.
- `advancesToSlot` — strona (`home` albo `away`), na którą uczestnicy tego meczu
  wchodzą w meczu docelowym.

Niezmiennik: `advancesToSlot` jest niepuste dokładnie wtedy, gdy niepuste jest
co najmniej jedno z `winnerToMatchId` i `loserToMatchId`. Te trzy pola mają sens
wyłącznie w fazie `knockout` i poza nią są puste. `matchNumber` jest wyjątkiem:
niosą go wszystkie mecze, bo w lidze porządkuje kolejkę.

Żadnego z tych niezmienników nie da się wyrazić w schemacie. Kontrakt trzyma się
konwencji, w której wszystkie pola są obecne i nullowalne, więc
`dependentRequired` nie zadziała — sprawdza obecność klucza, a nie to, czy
wartość jest niepusta. Pilnuje ich backend i jego testy zgodności.

**Jedna strona dla obu krawędzi.** Strona nie jest cechą krawędzi, tylko pozycji
meczu źródłowego: mecz o nieparzystym `matchNumber` zasila stronę gospodarza,
o parzystym stronę gościa. Turniej pocieszenia jest lustrem drabinki głównej
i zachowuje tę samą kolejność, więc przegrany trafia na tę samą stronę, na którą
trafiłby zwycięzca. To ta sama zależność, którą brackets-manager wylicza
w `getDiagonalMatchNumber()`. Zapisujemy ją mimo to jawnie, bo reguła
parzystości jest konwencją generatora, a nie faktem obecnym w API, i musiałaby
zostać poprawnie zaimplementowana niezależnie w backendzie i w dwóch
aplikacjach.

**Mecz pucharowy rozstrzyga się karnymi.** Przy remisie o awansie decyduje seria
rzutów karnych, notowana obok wyniku i wyłącznie wtedy, gdy wynik jest remisowy.
Karne nie są zdobyczami: nie wchodzą do tabeli ani do statystyk.

**Dwie rzeczy celowo wyprowadzamy z danych, zamiast dokładać na nie pola.**
Front i tak buduje odwrotny indeks krawędzi, więc:

- **pauza** to slot w rundzie późniejszej niż pierwsza, w którym stoi drużyna,
  a nie prowadzi do niego żaden mecz. Pauza nie tworzy meczu, więc nie pojawia
  się w terminarzu ani w wynikach, a mimo to jest widoczna w kształcie drabinki;
- **mecz o 3. miejsce** to mecz, którego oba wejścia są krawędziami przegranego.
  Nie potrzebuje własnej flagi typu.

To świadomy handel: mniejszy kontrakt w zamian za dwa miejsca, w których klient
musi coś wywnioskować zamiast odczytać. Nie należy tego "naprawiać" dokładaniem
pól w rodzaju `isThirdPlaceMatch`.

**Zakres zamknięty na single elimination.** Drabinki przegranych (double
elimination) nie robimy — ani zakresem, ani kształtem.

## Konsekwencje

Kupujemy: jednoznaczny model drabinki, jedno źródło prawdy o każdej krawędzi,
widok drabinki dający się narysować bez parsowania tekstu, oraz stabilny kształt
`Match` na v0.2.

Płacimy: cztery pola zamiast dwóch i dwie reguły wyprowadzania po stronie
klienta, opisane wyżej. `matchNumber` w lidze jest polem, którego nikt na razie
nie czyta.

Gdyby drabinka przegranych miała kiedyś wejść, sam `loserToMatchId` nie
wystarczy i będzie to zmiana łamiąca. Trzeba by wtedy: rozdzielić
`advancesToSlot` na osobne pola dla zwycięzcy i przegranego (w double
elimination symetria się łamie, bo pary są odwracane, żeby uniknąć rewanżu),
dodać informację, w której drabince mecz leży (start.gg koduje to ujemnym
numerem rundy), obsłużyć przeplatanie rund górnej i dolnej drabinki oraz wielki
finał z możliwym bracket resetem. Dołożenie dziś samego pola na drugi slot nie
uczyniłoby tej zmiany nierozbijającą, dlatego świadomie tego nie robimy.

Zapisane w [`CONTEXT.md`](../../CONTEXT.md) pod hasłami `Match` i `Bye`.
