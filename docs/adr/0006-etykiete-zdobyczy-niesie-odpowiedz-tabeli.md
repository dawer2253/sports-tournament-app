# ADR-0006: Etykietę zdobyczy niesie odpowiedź tabeli

Status: przyjęte
Data: 2026-08-31

## Kontekst

[ADR-0003](0003-zdobycze-nazywaja-sie-score-nie-goals.md) ustalił, że zdobycze
nazywają się w API `score` niezależnie od sportu, a „Bramki" i „Punkty" są
etykietami interfejsu wyprowadzanymi ze sportu turnieju. Rozstrzygnął jednak
tylko nazwę kanoniczną. Nie powiedział, **kto etykietę dostarcza**, i to
przemilczenie zostawiło w kodzie sztywny napis: nagłówek kolumny w
`apps/public/src/pages/tournament.tsx` brzmiał „Bramki", więc turniej
koszykarski wyświetlał etykietę sportu, którego nie dotyczy.

Odpowiedź `/public/t/{slug}/standings` (`StandingTable`) nie niosła ani sportu,
ani etykiety. Sport niesie osobna odpowiedź, `/public/t/{slug}`
(`PublicTournament.sport.code`).

Rozstrzygnięcie było pilne, bo `scoreLabel` jest polem wymaganym, więc
dołożenie go po wydaniu v0.1 byłoby zmianą łamiącą. Samego `StandingTable`
[ADR-0001](0001-kontrakt-openapi-jako-zrodlo-prawdy.md) nie zamraża — zamraża
`Match`, `Round` i `StandingRow` — ale wiersz tabeli jest zamrożony, a tabela
go opakowuje, więc rozjazd między nimi kosztowałby tyle samo.

## Rozważane warianty

**Front wyprowadza etykietę z pobranego turnieju.** Zero zmian w kontrakcie.
Odrzucone: mapowanie sportu na etykietę musiałby znać każdy konsument tabeli
z osobna — dziś `apps/public`, jutro panel i każdy inny klient — a nowy sport
wymagałby zmiany w każdym z nich. Wiąże też widok tabeli z odpowiedzią o
turnieju, choć endpoint tabeli jest samodzielny.

**Odpowiedź tabeli niesie etykietę.** Wybrane.

## Decyzja

`StandingTable` niesie wymagane `scoreLabel` — nagłówek kolumny
`scoreFor`:`scoreAgainst`, wyprowadzony po stronie serwera ze sportu turnieju.

To ten sam chwyt, którym kontrakt już posługuje się w klasyfikacjach: `label`
w `StatLeaderboard` istnieje dokładnie po to, żeby klient nie musiał tłumaczyć
kodu statystyki na tekst.

**Bez kodu maszynowego obok etykiety.** `StatLeaderboard` niesie parę `stat` +
`label`, bo leaderboardów jest wiele i trzeba wiedzieć, **który** to jest.
Tabela ma dokładnie jedno pojęcie zdobyczy, więc kod nie rozstrzygałby niczego,
czego nie rozstrzyga już `sport.code` w odpowiedzi o turnieju. Nie dokładamy go,
dopóki nie pojawi się konsument, który go potrzebuje.

**Etykieta wisi na tabeli, nie na turnieju.** Turniej ma jeden sport, więc
wszystkie jego tabele powtórzą tę samą wartość — schemat nie zabrania, żeby się
różniły. Bierzemy tę redundancję świadomie: wariant, w którym tabela odsyła do
sportu turnieju, jest dokładnie tym odrzuconym wyżej, bo zmusza klienta do
złożenia dwóch odpowiedzi, zanim narysuje nagłówek.

## Konsekwencje

Kupujemy: tabelę, która wystarcza sama sobie, jedno miejsce liczące etykietę
i nowy sport dodawany bez ruszania klientów.

Płacimy: pole, które backend musi wypełnić w każdej odpowiedzi tabeli, i tekst
prezentacyjny w kontrakcie, który poza tym opisuje wyłącznie dane. Kontrakt
niesie odtąd polszczyznę, więc wersja wielojęzyczna byłaby zmianą tutaj, a nie
w kliencie.

Decyzja obejmuje konsumentów kontraktu. Makiety w `packages/ui` renderują
`lib/demo-data.ts` i kontraktu nie znają, więc `public-standings.tsx` zostaje
na razie ze sztywnym napisem „Bramki" — od tej zmiany makieta i realny ekran
mówią o zdobyczach inaczej. Domknięcie tego jest osobnym ticketem (#38).

Endpoint tabel po stronie backendu jeszcze nie istnieje — kiedy powstanie,
`scoreLabel` wypełnia się ze sportu turnieju, a nie z pola w bazie: tabela nie
jest bytem zapisywanym.

Zapisane w [`CONTEXT.md`](../../CONTEXT.md) pod hasłem `Standing`.
