# ADR-0012: Sport z setami — sety przy meczu, punktacja jako dane, format zamknięty po pierwszym wyniku

Status: przyjęte
Data: 2026-10-20

## Kontekst

Siatkówka ([#301](https://github.com/dawer2253/sports-tournament-app/issues/301))
łamie trzy założenia modelu, który znał tylko piłkę i koszykówkę:

1. wynik meczu to sety, a nie suma zdobyczy, i trzeba gdzieś trzymać wynik
   każdego seta;
2. punkty w tabeli zależą od wyniku w setach (3:0 i 3:1 dają 3 i 0, a 3:2
   daje 2 i 1), a nie tylko od wygranej i porażki;
3. format seta (do ilu setów, do ilu punktów, jaka przewaga) to reguła, według
   której wynik w ogóle powstaje.

`docs/PLAN.md` §4 zakłada, że nowy sport to migracja „bez zmian w silniku”,
a decyzja #26 mówi, że kod per sport powstaje dopiero z algorytmem, którego nie
da się wyrazić danymi. Te trzy decyzje rozstrzygnięto w triage’u #301.

## Decyzja

**Sety żyją w meczu.** Kolumna JSON `matches.sets` trzyma listę `{home, away}`
w kolejności setów. `home_score` i `away_score` w sporcie z setami to sety
wygrane, wyliczane przez serwer z `sets` przy zapisie, a klient ich nie wysyła.

**Punktacja po secie decydującym to dane.** `Points` dostaje opcjonalne
`winDecidingSet` i `lossDecidingSet`, wymagane w sporcie z setami. Mecz wygrany
różnicą jednego seta daje te punkty, a pozostałe `win` i `loss`. Nie ma klasy
strategii sportu. Sport z setami poznaje się po `SportConfig.defaultSetFormat`
różnym od `null`.

**Format seta jest ustawieniem turnieju zamkniętym od pierwszego wyniku.**
`Tournament.setFormat` (`setsToWin`, `setPoints`, `decidingSetPoints`,
`minLead`) kopiuje się ze sportu przy zakładaniu i zmienia tylko do pierwszego
wpisanego seta. Później zmiana daje `422`, a zapis takiego samego formatu
przechodzi.

## Uzasadnienie

- Set zapisuje się zawsze razem z wynikiem meczu, a nikt nie odpytuje
  pojedynczego seta. JSON przy meczu daje jedną transakcję zapisu i zero
  złączeń przy odczycie. Wyliczony `home_score` zostawia bez zmian tabelę,
  drabinkę, awans i listy meczów, które czytają tylko sety wygrane.
- Punkty po secie decydującym różnią się od zwykłych wartością, a nie
  algorytmem: kalkulator tabeli wybiera parę punktów po różnicy setów. Decyzja
  #26 zostaje więc w mocy, a punktację po secie decydującym organizer zmienia
  w tym samym miejscu co resztę.
- Punktacja i kryteria tylko *oceniają* wyniki, więc działają wstecz. Format
  seta jest regułą, według której wyniki *powstały*: zmiana progu z 25 na 21
  zrobiłaby z wpisanego 25:20 wynik niepoprawny, a zmiana „do 3” na „do 2”
  zrobiłaby niepoprawnym każdy mecz 3:1.

Odrzucone:

- tabela `match_sets` — wymagałaby złączenia przy każdym odczycie meczu i nie
  daje niczego, czego potrzebuje dziś jakikolwiek widok;
- klasa strategii sportu z własnym liczeniem punktów — dublowałaby dane
  z `config` (decyzja #25) dla różnicy, która jest tylko wartością;
- format seta zmienny zawsze, z walidacją tylko przy zapisie meczu — poprawka
  literówki w starym meczu 3:1 po zmianie na „do 2” dostawałaby `422`.

## Konsekwencje

- Pierwsza reguła rozgrywek turnieju, która zamyka się po pierwszym wyniku.
  Podobny zakaz ma dotąd tylko status (turniej z meczem rozegranym nie wraca
  do `draft`). Formularz ustawień musi wysyłać format bez zmian, gdy blokada
  działa, i pokazywać pola wyłączone.
- Organizator, który pomylił format, musi usunąć wyniki setów (wrócić mecze
  do „Zaplanowany”), zanim go poprawi.
- Sport z setami nie ma dogrywki ani podziału meczu na czas. Kod, który
  sprawdza dogrywkę albo części meczu, musi pytać o format seta.
- Gdyby kiedyś trzeba było odpytywać pojedyncze sety (np. statystyka „sety
  wygrane do 20”), JSON wystarczy do odczytu w PHP, a do zapytań SQL trzeba
  będzie tabeli albo kolumn generowanych.
