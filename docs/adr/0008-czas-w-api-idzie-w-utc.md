# ADR-0008: Czas w API idzie w UTC

Status: przyjęte
Data: 2026-09-24

## Kontekst

Od #56 kontrakt gwarantuje w „Konwencjach", że każda data w odpowiedzi ma
offset `+00:00`. Stoi za tym `'timezone' => 'UTC'` w
[`backend/config/app.php`](../../backend/config/app.php), które przyszło ze
szkieletem Laravela (`430689f`) i nikt go świadomie nie wybierał. #56 tylko
nazwało ten stan i dopasowało do niego przykłady. Ten ADR uzasadnia decyzję
wstecz: [`backend/AGENTS.md`](../../backend/AGENTS.md) nazywa zmianę strefy
decyzją, a nie edycją jednej linijki, i do tej pory nie miał się na co
powołać.

Turniej dzieje się w Polsce, a organizator i kibice myślą w czasie polskim.
Pokusa, żeby API mówiło tym samym czasem, jest więc realna. Trzy fakty
o stosie zmieniają jej rachunek:

- **`kickoff_at` jest kolumną `DATETIME`** (migracja `create_matches_table`),
  czyli trzyma sam zegar, bez offsetu. Eloquent czyta ją w strefie aplikacji:
  ten sam wiersz znaczy inny moment, gdy zmieni się `config('app.timezone')`.
- **Eloquent przy zapisie nie przelicza strefy.** `HasAttributes::asDateTime`
  parsuje napis przez `Date::parse`, które zachowuje jego offset, a
  `fromDateTime` formatuje wynik jako `Y-m-d H:i:s` w tym *własnym* offsecie. Napis
  `2026-10-04T12:00:00+02:00` trafia do bazy jako `12:00` i wraca jako
  12:00 UTC, czyli dwie godziny za późno, bez błędu i bez ostrzeżenia.
- **Różnica między Polską a UTC nie jest stała.** Raz wynosi `+01:00`, raz
  `+02:00`. W 2026 roku przesuwa się 29 marca i 25 października.

## Rozważane warianty

**`Europe/Warsaw` na wyjściu, z offsetem `+01:00` / `+02:00`.** Odrzucone.
Offset w odpowiedzi skakałby w zależności od daty meczu, więc w jednym
terminarzu stałyby obok siebie oba. Klient, który zobaczy jeden z nich, łatwo
uzna go za stałą i zaszyje na sztywno. Przykłady w `openapi.yaml` musiałyby
pilnować, po której stronie zmiany czasu wypada każda data. A `DATETIME`
w czasie lokalnym jest dwuznaczny: 25 października 2026 zegar dwa razy pokazuje
godziny od 2:00 do 3:00, więc mecz zapisany na 2:30 nie ma jednego momentu.

**UTC w bazie, `Europe/Warsaw` na wyjściu.** Odrzucone. Usuwa dwuznaczność
w bazie, ale zostawia skaczący offset w kontrakcie i dokłada przeliczenie przy
każdej serializacji. Ten krok łatwo pominąć w nowym zasobie, a `format:
date-time` w kontrakcie nie wymaga żadnego konkretnego offsetu, więc schemat
takiego pominięcia nie wyłapie.

**UTC wszędzie.** Wybrane.

## Decyzja

**Aplikacja chodzi w UTC, a każda data w odpowiedzi ma offset `+00:00`.**
Kontrakt niesie samą gwarancję, a szczegół implementacji zostaje w
`backend/AGENTS.md`.

**Czas lokalny liczy klient.** Front przelicza datę z odpowiedzi przez strefę
IANA (`Intl.DateTimeFormat` z `timeZone`), a nie przez dodanie godziny czy
dwóch. Stała różnica byłaby dobra przez pół roku i zła przez drugie pół, więc
błąd wyszedłby dopiero przy zmianie czasu. Ten ADR nie rozstrzyga, *którą*
strefę pokazuje front (przeglądarki czy stałe `Europe/Warsaw`), bo żaden ekran
jeszcze dat nie formatuje. Gdyby turniej potrzebował własnej strefy, będzie to
nowe pole w `Tournament`, a nie zmiana offsetu w odpowiedziach.

**Na wejściu przyjmowany jest dowolny offset, a zapisywany zawsze moment
w UTC.** Dziś żaden `requestBody` nie niesie daty. Pierwszy, który zacznie,
podlega trzem regułom:

- data bez offsetu to `422`, bo nie wiadomo, który moment klient miał na myśli.
  Przyjęcie jej z domyślną strefą zamieniłoby pomyłkę klienta w mecz
  przesunięty o godzinę lub dwie, którego nikt nie zauważy aż do dnia meczu.
  `422` wychodzi przy pierwszym zapisie. Reguła jest też tańsza w tę stronę:
  poluzowanie jej później niczego nie psuje, a zaostrzenie złamałoby klientów,
  którzy na luźnej już polegają;
- backend sam przelicza wartość na UTC (`Carbon::parse(...)->utc()`), zanim
  przypisze ją do modelu, bo Eloquent tego nie zrobi (patrz „Kontekst");
- odpowiedź oddaje ten sam moment, ale w `+00:00`. Kto wyśle
  `2026-10-04T12:00:00+02:00`, dostanie `2026-10-04T10:00:00+00:00`, więc
  klient porównuje momenty, a nie napisy.

**`timezone` w `config/app.php` stoi bez `env()` celowo.** Strefa nie jest
ustawieniem środowiska, tylko częścią znaczenia danych w bazie i gwarancji
kontraktu. Gdyby strefę czytać z `env()`, `Europe/Warsaw` wpisane na jednej
maszynie przesunęłoby tam wszystkie `kickoff_at` i złamało `+00:00`
w odpowiedziach. CI by tego nie zgłosiło, bo ani `ci.yml`, ani
`phpunit.xml`, ani `.env.example` strefy nie ustawiają, więc testy chodziłyby
na UTC.

## Konsekwencje

Kupujemy: jeden offset w całym API, więc napisy dat w odpowiedziach sortują się
leksykograficznie tak jak momenty, o ile mają tę samą precyzję (dziś pełne
sekundy, bez ułamków). Baza nie ma dwuznacznych godzin, a indeks
na `kickoff_at` porządkuje mecze poprawnie także przez noc zmiany czasu.
Zostajemy przy domyślnym ustawieniu szkieletu Laravela, więc nikt nie musi
pamiętać o wyjątku.

Płacimy: surowy JSON mówi innym czasem niż zegar organizatora. Mecz
o 12:00 w Warszawie ma w przykładach `10:00+00:00` we wrześniu i
`11:00+00:00` w listopadzie. Kto pisze przykłady do kontraktu albo dane demo,
przelicza sam. Każdy widok z datą potrzebuje formatowania ze strefą.
Przeliczenie wejścia na UTC to obowiązek każdego przyszłego endpointu
z datą w `requestBody`, a nie mechanizm, który działa sam.

Płaci też formularz: `<input type="datetime-local">` oddaje czas bez offsetu,
więc front sam dokłada offset strefy, w której organizator wpisuje godzinę,
z uwzględnieniem zmiany czasu. To ten sam mechanizm `Intl`, którego wymaga
wyświetlanie, a nie nowa zależność.

Pierwszy endpoint przyjmujący datę ma w swojej definicji gotowości trzy
rzeczy, żeby reguły z tego ADR-a nie zostały na papierze:

- wymóg offsetu opisany w kontrakcie przy samym polu, a nie tylko tutaj;
- jedna wspólna reguła walidacji w backendzie, która odrzuca brak offsetu
  i przelicza na UTC, zamiast kopii w każdym Form Requeście;
- test w Peście, że `12:00+02:00` wraca jako `10:00+00:00`, a data bez
  offsetu dostaje `422`.

Odsyłacze: akapit o czasie w sekcji „Kontrakt API" w
[`backend/AGENTS.md`](../../backend/AGENTS.md) i „Konwencje" w
[`openapi.yaml`](../../packages/api-contract/openapi.yaml). `CONTEXT.md`
zostaje nietknięty: strefa czasu jest konwencją transportu, a nie pojęciem
domeny.
