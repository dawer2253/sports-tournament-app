# ADR-0005: Trzy miejsca, w których schemat ustępuje ograniczeniom PHP i MySQL

Status: przyjęte
Data: 2026-08-30

## Kontekst

Kształt bazy ustaliliśmy przed pisaniem migracji, na podstawie ERD
z [`docs/PLAN.md`](../PLAN.md) §3 i kontraktu v0.1. Trzy ustalenia nie
przetrwały zderzenia z narzędziami — nie dlatego, że były złe, tylko dlatego,
że PHP i MySQL ich nie przyjmują. Każde z nich wygląda z zewnątrz jak
niedoróbka i każde ktoś prędzej czy później spróbuje „naprawić", więc powód
zapisujemy raz, tutaj, zamiast powtarzać go przy każdej migracji.

## Decyzja

### 1. Model meczu nazywa się `GameMatch`

`match` jest słowem kluczowym PHP od 8.0 (wyrażenie `match`), a nazwy klas są
w PHP nierozróżnialne co do wielkości liter, więc `class Match` to błąd
parsowania — sprawdzone na PHP 8.5 z obrazu Sail:

```
PHP Parse error: syntax error, unexpected token "match", expecting identifier
```

Tabela zostaje `matches`, kontrakt zostaje przy `Match`, `CONTEXT.md` zostaje
przy `Match` jako nazwie kanonicznej. Rozjeżdża się wyłącznie nazwa klasy PHP,
wskazana tabelą przez `#[Table('matches')]`.

Rozważaliśmy `Fixture` jako nazwę bez kolizji. Odrzucone: „fixture" znaczy mecz
**zaplanowany**, więc nazwa kłamałaby o meczu zakończonym, a przy okazji wnosiła
do projektu drugie słowo na ten sam byt.

### 2. Wewnątrz poddrzewa turnieju żaden klucz obcy nie jest `RESTRICT`

Usunięcie turnieju kaskaduje w dół przez fazy, kolejki i mecze. InnoDB nie
gwarantuje kolejności, w jakiej kasuje rodzeństwo, więc `RESTRICT` gdziekolwiek
po drodze — na przykład na `matches.home_team_id` — zamieniłby usunięcie
turnieju w błąd zależny od tego, czy silnik dotarł najpierw do drużyn, czy do
meczów. Byłby to błąd niedeterministyczny, czyli najgorszy możliwy rodzaj.

Zamiast tego wewnątrz poddrzewa jest `CASCADE` albo `SET NULL` — to drugie tam,
gdzie pusty slot jest sensownym stanem (`venue_id`, `home_team_id`,
`away_team_id`, `teams.group_id`, krawędzie drabinki). Zakaz usuwania bytu
powiązanego z meczem `finished` realizuje guard w modelach
(`GuardsFinishedMatches`), zwracający **409 Conflict**: organizer ma prawo do
turnieju, blokuje go stan danych, więc 403 byłoby kłamstwem.

**Wyjątek: `tournaments.user_id` jest `RESTRICT`** i wyjątkiem tylko wygląda.
`users` leży **poza** poddrzewem turnieju i nie bierze udziału w jego kaskadzie,
więc problem kolejności tu nie zachodzi. Bez tego `$user->delete()` kasowałby
na twardo turnieje z rozegranymi meczami, obchodząc guard, który opisujemy jako
bezwarunkowy.

Konsekwencja, którą trzeba przyjąć świadomie: konta z turniejami nie da się
usunąć. Gdyby kiedyś doszło „usuń moje konto", odpowiedzią jest **anonimizacja**
— wyczyszczenie danych osobowych z `users` przy zachowaniu wiersza — a nie
kasowanie. Publiczna tabela rozegranej ligi ma zostać dostępna, więc turniej
nie może zniknąć razem z kontem i żadne prawo tego nie wymaga.

### 3. Przynależność grupy do turnieju sprawdza aplikacja, nie baza

Chcieliśmy, żeby baza fizycznie nie wpuściła drużyny do grupy z cudzego
turnieju, przez composite FK `teams(group_id, tournament_id)` →
`groups(id, tournament_id)`. Nie da się tego złożyć:

- `ON DELETE SET NULL` wymaga, żeby **wszystkie** kolumny klucza były
  nullowalne, a `teams.tournament_id` nie jest i być nie może;
- obejście przez kolumnę-kopię `tournament_id` wymaga CHECK-a pilnującego, że
  kopia równa się oryginałowi — a MySQL 8 odmawia: *„Column 'group_id' cannot be
  used in a check constraint: needed in a foreign key constraint referential
  action"* (błąd 3823). Bez tego CHECK-a nic nie wymusza zgodności kopii
  z właścicielem, więc gwarancja jest pozorna;
- wersja z `RESTRICT` zamiast `SET NULL` przechodzi, ale kładzie kaskadę z §2.

Zostaje `teams.group_id` jako zwykły klucz obcy z `SET NULL` i predykat
`Team::groupBelongsToSameTournament()`, wpięty w Form Request przy CRUD-zie
drużyn i przypięty testem. `groups.tournament_id` zostaje zdenormalizowane, bo
robi z tego sprawdzenia jedno porównanie zamiast wspinaczki przez fazę.

## Konsekwencje

Kupujemy: schemat, który da się w całości założyć i który kasuje turniej
deterministycznie, oraz jedno miejsce z powodami zamiast czterech.

Płacimy: nazwę klasy rozjechaną ze słownikiem, jedną regułę integralności poza
bazą i konta, których nie da się usunąć. Pierwsze dwa są nieusuwalne bez zmiany
języka albo silnika bazy. Trzecie jest odwracalne, ale odwracać go nie należy
bez zaprojektowania anonimizacji.

Zapisane w [`CONTEXT.md`](../../CONTEXT.md) pod hasłem `Match`,
w [`backend/AGENTS.md`](../../backend/AGENTS.md) jako reguły dla piszących
backend i w [`docs/PLAN.md`](../PLAN.md) §3 jako uwagi do ERD.
