# ADR-0010: Połączenie `mysql` działa w READ COMMITTED

Status: przyjęte
Data: 2026-10-15

## Kontekst

MySQL domyślnie działa w REPEATABLE READ. W tej izolacji `DELETE` i sprawdzanie
kluczy obcych zakładają blokady szczelin (next-key). Generowanie terminarza
ligi i drabinki pucharu kasuje kolejki fazy, a kaskada kasuje ich mecze.
Kolejki i mecze każdej nowej fazy trafiają na koniec indeksów `rounds`
i `matches`. Dwa generowania w różnych turniejach w tej samej chwili kończyły
się więc deadlockiem (1213). Pokazała to suita E2E przy trzech workerach.

[#236](https://github.com/dawer2253/sports-tournament-app/issues/236) obszedł
to w generatorach na dwa sposoby. Pusta faza nie jest kasowana, a cała
transakcja jest ponawiana po deadlocku (`DB::transaction(..., attempts: 5)`).
Ponawianie ma dwie wady:

- `Team::delete()` w pucharze kasuje kolejki drabinki bez ponawiania, więc
  dalej mógł wejść w deadlock z generowaniem w innym turnieju i oddać 500;
- Laravel ponawia też 1205 („Lock wait timeout exceeded”), więc żądanie mogło
  wisieć do 5 × `innodb_lock_wait_timeout` (lokalnie 50 s).

## Decyzja

Konfiguracja połączenia `mysql` ustawia `'isolation_level' => 'READ COMMITTED'`
(`backend/config/database.php`). Obowiązuje to każdą sesję, także w testach
i w CI. Izolacji nie ustawia kod pojedynczych klas.

Generatory nie ponawiają transakcji. Pomijanie kasowania pustej fazy zostaje,
bo nic nie kosztuje.

Pilnują tego testy: `SmokeTest` sprawdza `@@transaction_isolation`, a testy
„przy regeneracji nie blokuje meczów innych faz” w `GenerateScheduleTest`
i `GenerateBracketTest` sprawdzają, że drugie połączenie wstawi mecz na końcu
indeksów `matches`. Po przełączeniu połączenia z powrotem na REPEATABLE READ
wszystkie trzy są czerwone.

## Uzasadnienie

Żadna transakcja w backendzie nie zakłada spójnej migawki z REPEATABLE READ
(przegląd wyników `grep -rn "DB::transaction" backend/app` z triage'u #237):

- `ScheduleGenerator::generate()`, `BracketGenerator::generate()`
  i `DateDistributor::distribute()` zaczynają od `lockForUpdate()` na fazie.
  Późniejsze odczyty bez blokady nie są chronione w żadnej izolacji, więc RC
  nie otwiera nowego wyścigu, a odczyty są tylko świeższe.
- `Advancement::save()` czyta wyłącznie przez `lockForUpdate()`, więc w obu
  izolacjach działa tak samo.
- Guardy w `Team::delete()` i `Venue::delete()` czytają bez blokady przed
  zapisem. Ten wyścig istnieje w obu izolacjach.
- `Tournament::createForOrganizer()` sprawdza slug poza transakcją, a w środku
  są same inserty.

Pomiar z #237: w READ COMMITTED, przy sześciu procesach naraz, 0 deadlocków
na 120 prób we wszystkich czterech scenariuszach, także przy regeneracji.

Pomiar blokad (`performance_schema.data_locks` w transakcji testu, po
regeneracji terminarza czterech drużyn):

- REPEATABLE READ: 42 blokady szczelin w `matches` (indeksy
  `winner_to_match_id`, `loser_to_match_id`, `round_id + match_number`)
  i `match_events`, w tym `supremum` na czterech indeksach;
- READ COMMITTED: żadnej w tych tabelach.

## Konsekwencje

**Jedna blokada szczeliny zostaje i jest zmierzona.** READ COMMITTED dalej
blokuje szczeliny przy sprawdzaniu duplikatów (dokumentacja MySQL,
„Transaction Isolation Levels”). Regeneracja wstawia kolejki o tych samych
kluczach `(stage_id, order)`, które przed chwilą skasowała. InnoDB sprawdza
duplikat względem wierszy oznaczonych do usunięcia i zakłada blokady `S,GAP`
na unikalnym indeksie `rounds`, aż do `supremum`, jeśli faza jest ostatnia
w indeksie. W `matches` tego nie ma, bo nowe kolejki mają nowe `round_id`.

Skutek: generowanie nowej fazy w innym turnieju czeka na commit takiej
regeneracji. Z rozkładu blokad wynika, że deadlock wymaga dwóch regeneracji sąsiednich faz w tej samej
chwili, a pomiar z #237 go nie pokazał. Dlatego kryterium #237, by sonda
wstawiała kolejkę na koniec `rounds` także po regeneracji, zamieniliśmy na
sondę na koniec `matches`. Sonda na `rounds` byłaby czerwona w obu izolacjach.

Gdy deadlock przy generowaniu pojawi się w logach, wracamy do tematu z danymi.
Kierunki do rozważenia wtedy: wstawianie kolejek bez kolizji kluczy z
kasowanymi albo ponawianie wyłącznie 1213.

Poza zakresem tej decyzji zostają wyścigi „sprawdzenie bez blokady, potem
zapis” (guardy usuwania, `DateDistributor` kontra rozpoczęcie meczu) i
konfiguracja serwera MySQL (`innodb_lock_wait_timeout`, compose, CI,
produkcja).
