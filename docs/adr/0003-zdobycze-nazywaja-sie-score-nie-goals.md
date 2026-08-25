# ADR-0003: Zdobycze w tabeli nazywają się `score`, nie `goals`

Status: przyjęte
Data: 2026-08-25

## Kontekst

`StandingRow` opisywał bilans drużyny polami `goalsFor`, `goalsAgainst`
i `goalDifference`, a kryteria rozstrzygające kodami `goals_for`, `goals_against`
i `goal_diff`. Nazwy są piłkarskie, a ten sam wiersz tabeli obsługuje wszystkie
sporty: w koszykówce nie ma bramek, są punkty.

Naturalna poprawka — przemianowanie na `pointsFor` i `pointsAgainst` — wpada
w kolizję. `StandingRow.points` już istnieje i znaczy punkty **za wyniki meczów**
(3 za zwycięstwo), a `points` jest też pierwszym kryterium na liście tiebreaków.
Obiekt zawierający jednocześnie `points: 6` i `pointsFor: 5`, gdzie obie liczby
znaczą coś zupełnie innego, jest gorszy niż stan wyjściowy.

Rozstrzygnięcie musiało zapaść przed zamrożeniem `StandingRow`, które
[ADR-0001](0001-kontrakt-openapi-jako-zrodlo-prawdy.md) przewiduje już w v0.1.

## Rozważane warianty

**Zostawić `goals*`.** Odrzucone: w turnieju koszykarskim API mówi o bramkach,
których w tym sporcie nie ma. Ten sam problem wróciłby przy każdym kolejnym
sporcie.

**`pointsFor` / `pointsAgainst` / `pointsDifference`.** Odrzucone z powodu
kolizji z `points` opisanej wyżej.

**`scoreFor` / `scoreAgainst` / `scoreDifference`.** Wybrane.

## Decyzja

To, co drużyna zdobywa w meczu, nazywa się w kodzie i w API `score`, niezależnie
od sportu. `StandingRow` niesie `scoreFor`, `scoreAgainst` i `scoreDifference`.
Kryteria rozstrzygające liczone z tej wielkości to `score_for`, `score_against`
i `score_diff`.

`points` pozostaje zarezerwowane wyłącznie dla punktów w tabeli, przyznawanych
za wynik meczu.

Nazwa jest spójna z istniejącymi już `Match.homeScore` i `Match.awayScore`.
Wersje piłkarskie ("Bramki") i koszykarskie ("Punkty") są etykietami interfejsu,
wyprowadzanymi ze sportu turnieju, a nie nazwami w API.

## Konsekwencje

Kupujemy: jeden kształt tabeli dla wszystkich sportów i brak dwóch różnych
wielkości o mylnie podobnych nazwach w jednym obiekcie.

Płacimy: w interfejsie polskiego turnieju piłkarskiego padają "bramki", a w API
`score`, więc warstwa prezentacji musi to tłumaczyć. Kod czytany bez tego
dokumentu może wyglądać na niepotrzebnie ogólny.

Zapisane w [`CONTEXT.md`](../../CONTEXT.md) pod hasłami `Score` i `Standing`.
