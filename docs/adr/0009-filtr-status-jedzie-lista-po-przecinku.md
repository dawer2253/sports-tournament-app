# ADR-0009: Filtr `status` jedzie listą rozdzieloną przecinkiem

Status: przyjęte
Data: 2026-09-25

## Kontekst

Rozstrzygnięcie z #21: **rozegranego turnieju nie kasujemy** — ani na twardo,
ani na miękko — bo jego publiczny adres `/t/{slug}` ma dalej działać. Historia
zostaje w bazie, więc lista organizera rośnie monotonicznie i nigdy się nie
skraca. Porządek w panelu musi robić filtr, a nie usuwanie.

`GET /tournaments` przyjmowało dotąd wyłącznie `page` i `perPage`. Odsiewanie po
stronie frontu nie wchodzi w grę: lista jest stronicowana, więc filtrowanie
pobranej strony dałoby strony o różnej długości i dziury w paginacji. Filtr musi
być parametrem zapytania i musi działać **przed** paginacją.

Otwarte zostało jedno: czy `status` przyjmuje jedną wartość, czy listę. Panel
chce pokazać szkice i turnieje w toku razem.

## Rozważane warianty

**Pojedyncza wartość (`?status=active`).** Zgodna z tym, co kontrakt ma już przy
`GET /tournaments/{tournament}/matches`, gdzie `status` to jeden `MatchStatus`.
Odrzucona, bo nie obsługuje jedynego znanego dziś przypadku użycia. Panel
musiałby albo strzelać dwa razy i sklejać wyniki po stronie klienta — a wtedy
wraca problem z paginacją, od którego uciekamy — albo prosić o wszystko
i odsiewać lokalnie.

**Osobna flaga boolowska (`?archived=false`).** Krótsza dla tego jednego widoku.
Odrzucona: zaklina w API pojęcie, którego nie ma ani w
[`CONTEXT.md`](../../CONTEXT.md), ani w `TournamentStatus`, i zamyka drogę do
pytania o sam `draft` albo sam `finished`. Flaga nad enumem trzyma jedno
z wielu możliwych cięć, a przy każdym kolejnym trzeba dokładać następną.

**Lista przez powtórzony klucz (`?status=draft&status=active`).** To domyślne
kodowanie tablic w OpenAPI (`style: form`, `explode: true`) i domyślne
w openapi-fetch. Odrzucone z powodu implementacyjnego, ale twardego: PHP przy
parsowaniu query stringa zostawia pod powtórzonym kluczem **wyłącznie ostatnią
wartość**, więc Laravel zobaczyłby `status=active` i po cichu zawęziłby filtr do
jednego stanu. Formę, którą PHP rozumie (`?status[]=draft&status[]=active`),
OpenAPI z kolei nie umie opisać żadnym ze swoich `style`.

**Lista rozdzielona przecinkiem (`?status=draft,active`).** Wybrana.

## Decyzja

`GET /tournaments` przyjmuje opcjonalny `status` jako tablicę `TournamentStatus`
w `style: form`, `explode: false` — czyli `?status=draft,active`. Bez powtórzeń
(`uniqueItems`), co najmniej jedna wartość (`minItems: 1`).

**Bez parametru zachowanie się nie zmienia**: odpowiedź obejmuje wszystkie
turnieje organizera. Parametr nie ma wartości domyślnej, bo „brak filtra" to nie
to samo co lista wszystkich trzech stanów — domyślna lista zestarzałaby się przy
pierwszym nowym stanie w enumie.

**Filtr działa przed paginacją.** `meta` opisuje zawsze zbiór po filtrowaniu:
`total` to liczba turniejów w podanych stanach, nie w ogóle. Inaczej `lastPage`
obiecywałby strony, których nie da się pobrać.

**Zła wartość to `422` — i jest to wyjątek na tym endpoincie.** `perPage` poza
zakresem jest dociągane do granicy, bo kontrakt nie przewidywał tu dotąd błędu
walidacji. Przy `status` jest inaczej: `?status=bogus` to literówka w adresie,
a cichy fallback do „bez filtra" pokazałby organizerowi pełną listę i wyglądał
jak działający filtr. Różnica jest zamierzona — `perPage` ma sensowną wartość
najbliższą żądanej, a `status` nie ma żadnej.

**Kształty, w których PHP gubi wartości, też są `422`.** Backend odrzuca
powtórzony klucz i notację nawiasową, sprawdzając surowy query string — w `$_GET`
ślad po powtórzeniu już nie istnieje. Bez tego decyzja chroniłaby wyłącznie
klienta TS, a `curl` i ręcznie sklejony link dostawałyby `200` z cicho zawężonym
filtrem, czyli dokładnie to, czemu odrzucenie `explode: true` miało zapobiec.
Sprawdzenie siedzi w `App\Rules\SingleCommaSeparatedQueryParam`, a nie przy tym
jednym Form Requeście, bo przecinek jest konwencją całego kontraktu.

**Serializację tablic ustawia `packages/api-client`, raz.** openapi-fetch
domyślnie powtarza klucz, więc `createApiClient` przestawia tablice na
`explode: false` globalnie. Ustawienie per-żądanie odpadło: każdy konsument
musiałby o nim pamiętać, a pomyłka jest cicha — żądanie przechodzi, filtr jest
inny, niż prosił kod.

## Konsekwencje

Kupujemy: panel dostaje szkice i turnieje w toku jednym żądaniem, z poprawną
paginacją, a kontrakt nie zyskuje przy okazji pojęcia spoza słownika domeny.
Kolejne cięcia po stanie (sam `finished` dla widoku historii) nie wymagają już
zmiany w kontrakcie.

Płacimy rozjazdem z `GET /tournaments/{tournament}/matches`, gdzie `status` jest
pojedynczy i bez `422`. Rozjazd jest świadomy — tam nie ma znanej potrzeby
pytania o dwa stany naraz — ale znaczy, że „`status` w query" nie ma w tym API
jednego kształtu; domknięcie należy do ticketu, który dowozi mecze.

Płacimy też tym, że przecinek jest rozstrzygnięciem o **całej** serializacji
tablic w query, nie tylko o tym parametrze: `querySerializer` jest globalny, więc
każdy przyszły tablicowy parametr musi być w kontrakcie opisany tak samo.
Bramka CI tego nie złapie — `openapi-typescript` nie przenosi `style` ani
`explode` do typów — dlatego obowiązek stoi w `## Konwencje` w samym
`openapi.yaml`, czyli tam, gdzie się go czyta przy edycji kontraktu.

Spectator ma przy tym granicę: na `?status[]=draft` przewraca się własnym
`TypeError`, zanim żądanie dojdzie do Form Requesta, bo kontrakt nie umie tego
kształtu opisać. Dlatego ten jeden przypadek testuje
`ListTournamentsGuardTest`, w pliku bez `Spectator::using()`.

Mock ma granicę znaną z
[ADR-0007](0007-odswiezanie-strony-publicznej-na-walidatorach-http.md): Prism
oddaje przykład z kontraktu i parametru nie honoruje, więc `npm run mock` pokaże
tę samą listę niezależnie od filtra. Zachowanie filtra sprawdza się na Laravelu,
testem Pesta.

`CONTEXT.md` zostaje nietknięty: `status` jest w słowniku od początku, a ta
decyzja dotyczy sposobu pytania o niego, nie samego pojęcia.
