# ADR-0007: Odświeżanie strony publicznej stoi na walidatorach HTTP

Status: przyjęte
Data: 2026-09-08

## Kontekst

Strona publiczna odpytuje `/public/t/{slug}` i `/public/t/{slug}/standings`
co `VITE_POLL_INTERVAL_MS` (domyślnie 15 s), żeby tabela sama nadążała za
meczem. Odpytywanie jest w `apps/public/src/pages/tournament.tsx` już dziś.

Każde takie żądanie oddaje pełny JSON, nawet gdy od godzin nic się nie
zmieniło, a tabela nie jest w bazie: `StandingsCalculator` liczy ją przy
odczycie. Przy meczu oglądanym przez kilkadziesiąt osób to policzalny koszt za
zero nowej informacji — i pasmo, i procesor.

Kontrakt nie miał czym tego wyrazić. Do tej pory nie opisywał **żadnych**
nagłówków odpowiedzi: v0.1 mówiła wyłącznie o kształcie ciała. A skoro
[ADR-0001](0001-kontrakt-openapi-jako-zrodlo-prawdy.md) czyni kontrakt jedynym
źródłem prawdy o API, mechanizm nieopisany w kontrakcie po prostu nie istnieje.

Temat wypłynął przy przeglądzie kontraktu v0.1 i został świadomie odłożony,
żeby nie blokować pozostałych zmian (#14).

## Rozważane warianty

**Nie robić nic, najpierw zmierzyć.** Kuszące, bo turniej osiedlowy to nie
skala, przy której cokolwiek boli. Odrzucone nie dlatego, że koszt jest dziś
duży, tylko dlatego, że okno na tanią zmianę jest teraz: publiczne endpointy
nie mają jeszcze implementacji w Laravelu, więc mechanizm dokłada się do
pustego miejsca. Po wydaniu dochodziłby do sześciu działających endpointów
i do klientów, które ich używają.

**Znacznik świeżości w danych** — `lastUpdatedAt` w `PublicTournament` albo
`updatedAt` w `Match`. Odrzucone: przenosi decyzję o pobraniu na klienta, ale
tanie żądanie i tak jest pełnym żądaniem HTTP z pełną odpowiedzią, więc
oszczędza tylko na jednym z dwóch endpointów. Każdy konsument musiałby napisać
tę samą pętlę „sprawdź znacznik, potem dociągnij", a backend musiałby
utrzymywać znacznik przy każdym zapisie, który wpływa na tabelę — czyli znać
zależność, której `StandingsCalculator` dziś nie potrzebuje.

**Walidatory HTTP (`ETag` / `If-None-Match`).** Wybrane.

## Decyzja

Każdy endpoint `/public/*` niesie przy `200` nagłówki `ETag` i
`Cache-Control: no-cache`, przyjmuje `If-None-Match` i odpowiada `304` z pustym
ciałem, gdy walidator jest zgodny.

**`ETag` liczy się z treści, nie z czasu.** Zmienia się wtedy i tylko wtedy,
gdy zmienia się `data`. Skutek uboczny: przeliczenie tabeli daje ten sam
walidator, dopóki wynik przeliczenia jest ten sam, więc mecz bez zmiany wyniku
nie unieważnia niczyjej pamięci podręcznej. Dla klienta walidator jest
nieprzezroczysty — kontrakt nie obiecuje, jak jest liczony.

**`Cache-Control` z `no-cache` jest częścią mechanizmu, nie ozdobą.**
Bez tego przeglądarka stosuje heurystykę: albo poda nieaktualną tabelę
z pamięci, albo w ogóle nie odpyta warunkowo. `no-cache` znaczy „przechowuj,
ale przed każdym użyciem odśwież" i to jest dokładnie zachowanie, którego
odpytywanie potrzebuje.

Kontrakt wymaga **obecności dyrektywy**, nie konkretnego napisu: nagłówek jest
listą, a Laravel domyślnie oddaje `no-cache, private`. Zapis przez `const`
odrzuciłby poprawną odpowiedź frameworka i wywrócił się na pierwszym
implementującym.

**Frontend nie dotyka `If-None-Match`.** Przeglądarka wysyła go sama, ze swojej
pamięci podręcznej, i sama zamienia `304` z powrotem na `200` z zachowanym
ciałem. `fetch` w `packages/api-client` zostaje bez zmian, a `useQuery`
w `apps/public` nadal widzi `200` z danymi — oszczędność jest na łączu, nie
w kodzie widoku. Parametr `If-None-Match` jest w kontrakcie dla klientów bez
pamięci podręcznej: testów kontraktowych i integracji.

**Nagłówki wchodzą tylko do `/public/*`.** Endpointy panelu nie są odpytywane
cyklicznie, więc nie kupiłyby nic za tę samą cenę w kontrakcie.

## Konsekwencje

Kupujemy: odpytywanie, które przy braku zmian kosztuje puste `304` zamiast
pełnego JSON-a, i to bez linijki kodu po stronie widoku. Mechanizm jest
standardowy — Laravel ma `Response::setEtag()` i `isNotModified()`, więc
implementacja endpointu to jeden middleware, nie własny wynalazek.

Płacimy: kontrakt opisuje odtąd nagłówki odpowiedzi, czego wcześniej nie robił
nigdzie. To nowy wymiar, który trzeba utrzymywać — testy Spectatora asertują
zgodność ciała, więc zgodność nagłówków i `304` wymaga osobnych asercji
w Peście, pisanych razem z endpointami.

Płacimy też tym, że `304` nie oszczędza pracy serwera automatycznie: żeby
policzyć `ETag`, backend musi mieć treść. Oszczędność na `StandingsCalculator`
wymagałaby osobnego kroku (walidator wyprowadzony ze stanu, nie z odpowiedzi)
i jest poza tą decyzją — zysk jest tu na pasmie i na parsowaniu po stronie
klienta.

Publiczne endpointy nie istnieją jeszcze w Laravelu. Kiedy powstaną, obowiązek
z tej decyzji jest częścią ich definicji gotowości, a nie osobnym ticketem.

Mock ma tu granicę: Prism oddaje nagłówki z przykładów, więc `ETag` jest w nim
stałą, a warunkowego `304` nie zwróci nigdy. Zachowanie walidatora sprawdza się
dopiero na Laravelu, nie na `npm run mock`.

Obowiązek dla przyszłych endpointów zapisany w
[`backend/AGENTS.md`](../../backend/AGENTS.md). `CONTEXT.md` zostaje nietknięty:
walidator jest mechanizmem transportu, nie pojęciem domeny.
