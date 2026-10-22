# ADR-0013: Zdarzenie w meczu trwającym zmienia wynik

Status: przyjęte
Data: 2026-10-22

## Kontekst

[#188](https://github.com/dawer2253/sports-tournament-app/issues/188) (reguła 11)
rozstrzygnął, że zdarzenie meczu nie zmienia wyniku: wynik wpisuje organizator
osobno, a API nie sprawdza zgodności liczby bramek z wynikiem. Research
[#189](https://github.com/dawer2253/sports-tournament-app/issues/189) uzasadniał
to tym, że zdarzenia bywają niepełne (bramka bez zawodnika, mecz bez zdarzeń),
a wynik ma być prawdą o meczu.

Przy stoliku wyszło z tego podwójne wpisywanie: organizator klika „Bramka”
i zawodnika, a potem osobno przepisuje wynik i minutę z zegara
([#317](https://github.com/dawer2253/sports-tournament-app/issues/317)). Strona
publiczna odpytuje serwer co kilkanaście sekund, więc wynik, który czeka na
„Zapisz”, spóźnia się o tyle, o ile organizator zwleka.

## Decyzja

Rozważone dwa warianty:

- **A. Wynik liczony ze zdarzeń.** Wynik meczu przestaje być polem, a staje się
  sumą zdobyczy. Odrzucony: zdarzenia bywają niepełne, organizator nadal musi
  móc poprawić wynik ręcznie (i robi to w meczach zakończonych po fakcie),
  a sport z setami ma wynik z innego źródła. Wymagałby też zmiany kontraktu
  i wszystkich odczytów.
- **B. Zdarzenie podbija zapisany wynik.** Wynik zostaje kolumną meczu i polem
  `MatchUpdate`; zdarzenie-zdobycz przesuwa go o swoją wartość w tej samej
  transakcji co zapis zdarzenia. **Wybrany.**

Reguły wariantu B:

1. Wynik zmienia zdarzenie, którego `stat` to zdobycz sportu (pierwszy wpis
   `availableStats`: piłka bramka +1, kosz rzuty +1/+2/+3), o swoje `value`.
   Samobój daje +1 przeciwnikowi. Kartka i faul wyniku nie ruszają. Sport
   z setami (ADR-0012) nigdy: jego wynik to sety liczone przez serwer.
2. **Tylko mecz trwający.** W meczu zakończonym zdarzenia dalej wynik zostawiają
   w spokoju: dopisywanie po fakcie nie ma psuć tabeli, drabinki ani zakazu
   remisu, które liczą się z zakończonego wyniku.
3. Symetria w meczu trwającym: usunięcie odejmuje, edycja drużyny albo rodzaju
   przenosi albo zdejmuje punkt, edycja minuty lub zawodnika wyniku nie rusza.
   Wynik nie schodzi poniżej 0 (obcięcie, nie `422`).
4. Seria karnych zostaje ręczna.
5. Linia rozbieżności w oknie meczu zostaje: po ręcznej poprawce wyniku albo
   w meczu zakończonym zdarzenia nadal mogą się z wynikiem rozjeżdżać.

Reguła „tylko trwający” to cena za B: wynik meczu zakończonego pozostaje
wyłącznie decyzją organizatora, więc nic nie zmienia go „za plecami” po
zakończeniu.

## Konsekwencje

- Wynik ma teraz dwóch pisarzy w meczu trwającym: serwer (zdarzenia) i
  organizator (pola wyniku). Okno meczu w panelu przepisuje pola z serwera po
  każdym zapisie zdarzenia, a „Zapisz” wysyła wynik tylko po ręcznej zmianie
  pól, inaczej zmiana stanu czy obiektu nadpisałaby bramkę.
- Zmiana wyniku jest w tej samej transakcji co zdarzenie, a wiersz meczu jest
  blokowany na czas przeliczenia, więc dwie bramki zapisane naraz się nie
  zgubią.
- Panel liczy też minutę zdarzenia z zegara meczu (doliczony czas jako osobne
  `addedTime`), co usuwa drugie ręczne wpisywanie. Szczegóły w `CONTEXT.md`
  (hasła „MatchEvent” i „Match period”).
- Odwraca regułę 11 z #188 tylko dla meczu trwającego. Zdarzenia sprzed zmiany
  nie są wstecznie przeliczane: wynik meczu trwającego pozostaje taki, jaki
  wpisał organizator.
