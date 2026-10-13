# Context

Słownik domenowy projektu. Nazwy kanoniczne są po angielsku (tak brzmią w kodzie,
w bazie i w API). Definicje po polsku. W nawiasach etykiety używane w UI.

Ten plik jest wyłącznie słownikiem. Nie trafiają tu decyzje implementacyjne,
schematy tabel ani opisy endpointów.

## Organizer

Konto, które zakłada i prowadzi turnieje. Jedyny korzeń własności w systemie:
każdy inny byt należy do organizera pośrednio, przez `Tournament`. Nie ma ról
współpracownika: dostęp do turnieju ma dokładnie jedno konto.

W kodzie reprezentowany przez `User`. Termin "organizer" opisuje rolę, "user"
opisuje konto. Nie są to dwa różne byty.

## Tournament (turniej)

Pojedyncze rozgrywki prowadzone przez organizera, od pierwszego meczu do
ostatniego. Ma jeden sport, jeden komplet drużyn i jeden publiczny adres
(patrz `Slug`).

Turniej nie jest sezonem ani cyklem: nie istnieje pojęcie "poprzedniej edycji".
Drużyny i zawodnicy należą do jednego turnieju i nie są między turniejami
współdzieleni.

Stan turnieju: szkic (`draft`), trwający (`active`), zakończony (`finished`).
Stan ustawia organizer. Nic w systemie nie zmienia go samo. Turniej w szkicu
nie jest opublikowany: pod jego publicznym adresem nic nie ma. **Opublikować**
turniej znaczy przestawić go ze szkicu na trwający. Zakończenie to deklaracja
organizera, że rozgrywki się skończyły, a nie blokada zmian. Turniej, który ma
mecz rozpoczęty (patrz `Match`), nie wraca do szkicu.

**Bieżący turniej** to turniej w szkicu albo trwający, czyli każdy poza
zakończonym. To ten, nad którym organizer jeszcze pracuje.

_Unikaj_: „archiwalny” i „zarchiwizowany”. Archiwum nie jest osobnym stanem ani
flagą. Turniej, który przestał być bieżący, jest po prostu zakończony.

## Slug

Krótki, czytelny identyfikator turnieju używany w publicznym adresie. Unikalny
globalnie, nie tylko w obrębie jednego organizera.

## Sport

Zestaw reguł, które określają jak liczy się wynik: czy mecz może skończyć się
remisem, jakie zdarzenia mogą w nim wystąpić, po czym można rozstrzygać remisy
w tabeli i jakie statystyki mają sens.

Sport jest predefiniowany. Organizer nie tworzy sportów, wybiera jeden z listy,
a następnie dostosowuje jego parametry w obrębie swojego turnieju.

Punktację (ile punktów w tabeli daje zwycięstwo, remis i porażka) sport podaje
wyłącznie jako domyślną. Obowiązuje punktacja turnieju, którą organizer może
zmienić, więc sport nigdy sam nie liczy punktów za wynik meczu.

_Unikaj_: SportRules (osobna nazwa na to samo co Sport).

## Stage (faza)

Wyodrębniona część turnieju rozgrywana według jednej zasady. Turniej ma zawsze
co najmniej jedną fazę, także wtedy, gdy jest zwykłą ligą i organizer nigdy nie
zobaczy słowa "faza" w interfejsie.

Trzy rodzaje:

- `league`: każdy z każdym, wynikiem jest tabela.
- `group`: kilka niezależnych tabel rozgrywanych równolegle (patrz `Group`).
- `knockout`: drabinka, przegrany odpada.

Fazy w turnieju są uporządkowane. Faza `knockout` może pobierać uczestników
z wyników fazy wcześniejszej.

## Format (format turnieju)

Wybór organizera przy zakładaniu turnieju, który mówi, jakie fazy utworzyć:

- `league`: jedna faza `league`.
- `knockout`: jedna faza `knockout`.
- `groups_playoff`: faza `group`, a po niej faza `knockout`, obie od razu.

Format nie jest cechą turnieju. Po założeniu nie istnieje: to, jakim turniejem
coś jest, wynika wyłącznie z jego faz.

## Group (grupa)

Podzbiór drużyn w fazie `group`, które grają wyłącznie ze sobą i mają własną
tabelę. Grupy istnieją tylko wewnątrz fazy `group`.

Mecz należy do dokładnie jednej grupy albo do żadnej. Nie istnieje mecz
międzygrupowy.

## Round (kolejka / runda)

Uporządkowany zbiór meczów rozgrywanych jako jedna całość. Należy do fazy.

To jeden byt o dwóch etykietach w UI. W fazie `league` i `group` mówi się o niej
"kolejka", w fazie `knockout` "runda" (1/8 finału, półfinał, finał). Struktura
jest w obu przypadkach ta sama, więc w kodzie i w API występuje wyłącznie nazwa
`Round`.

## Meetings (liczba spotkań)

Ile razy w fazie spotyka się każda para drużyn: `1` (jedna runda) albo `2`
(mecz i rewanż). Organizer wybiera ją przy każdym generowaniu terminarza, bez
wartości domyślnej. W UI: „Każdy z każdym: raz / dwa razy (mecz i rewanż)”.

Nie mówimy tu „runda”, choć potocznie liga ma „rundę jesienną i wiosenną”:
to słowo jest już etykietą `Round` w drabince. Przy `meetings: 2` rewanż jest
czystym lustrem — druga połowa kolejek powtarza pierwszą z odwróconym
gospodarzem (#157).

## Team (drużyna)

Uczestnik turnieju. Należy do jednego turnieju. Dwie drużyny o tej samej nazwie
w dwóch turniejach to dwa niepowiązane byty. W obrębie jednego turnieju nazwa
drużyny się nie powtarza.

Usunięcie drużyny usuwa też jej mecze zaplanowane. Reszta terminarza zostaje
bez zmian, nawet jeśli kolejka opustoszeje.

## Logo (logo, herb)

Obraz, który organizer wgrywa dla turnieju albo dla drużyny. W kodzie i w API
oba nazywają się `logo`, a „herb” to wyłącznie etykieta UI dla logo drużyny.

Brak logo jest stanem poprawnym, nie błędem. Drużynę bez logo UI oznacza herbem
zastępczym (`TeamCrest` w design systemie), który nie jest logo, tylko jego
zastępstwem.

_Unikaj_: `crest` jako nazwy pola albo bytu w API i w bazie.

## Player (zawodnik)

Osoba przypisana do drużyny. Istnieje po to, żeby przypisywać jej zdarzenia
meczowe i budować z nich statystyki indywidualne. Numer zawodnika, jeśli jest,
nie powtarza się w drużynie.

Zawodnik nie istnieje bez drużyny, więc usunięcie drużyny usuwa jej zawodników.
Zawodnicy jednej drużyny to jej skład (etykieta UI "skład").

## Venue (obiekt)

Miejsce rozegrania meczu. Należy do turnieju. W obrębie jednego turnieju nazwa
obiektu się nie powtarza.

Usunięcie obiektu nie usuwa meczów: mecze zaplanowane zostają bez obiektu,
z tym samym terminem.

## Match (mecz)

Spotkanie dwóch drużyn w ramach kolejki. Ma gospodarza i gościa, planowany
termin, opcjonalny obiekt i stan.

Jedyny byt, którego nazwa kanoniczna nie brzmi tak samo wszędzie: klasa modelu
w backendzie nazywa się `GameMatch`
([ADR 0005](docs/adr/0005-schemat-ustepuje-ograniczeniom-php-i-mysql.md)).

Stan meczu: zaplanowany, trwający, zakończony. Tylko mecz zakończony wpływa na
tabelę i na statystyki.

Wynik ma mecz trwający i zakończony; zaplanowany go nie ma. Wynik wpisuje
organizer ręcznie, a przy sporcie bez remisów (`allowsDraw: false`) remis jest
dozwolony w meczu trwającym, ale nie w zakończonym.

**Mecz rozpoczęty** to mecz trwający albo zakończony, czyli każdy poza
zaplanowanym. Wiąże drużyny, zawodników i obiekt, które w nim uczestniczą:
żadnego z nich nie da się usunąć, a turniej z meczem rozpoczętym nie przyjmuje
nowych drużyn i nie wraca do szkicu.

_Unikaj_: „rozegrany” (`played`) jako nazwy meczu rozpoczętego. Mecz rozegrany
to mecz zakończony, i tak liczy go tabela.

Mecz ma pozycję własną: numer w obrębie swojej kolejki (`matchNumber`). W lidze
porządkuje kolejkę, w drabince razem z numerem rundy wyznacza miejsce meczu
w choince i pozwala widokowi wyliczyć jego etykietę ("1/2 finału", "Finał").
Etykiety nie przechowujemy, bo zależy od rozmiaru drabinki. Pozycja własna to
co innego niż to, dokąd awansują uczestnicy meczu — te dwie rzeczy nie mieszczą
się w jednym pojęciu.

W drabince mecz wskazuje, dokąd trafiają jego uczestnicy po rozstrzygnięciu:
osobno zwycięzca, osobno przegrany (ten drugi tylko wtedy, gdy turniej ma mecz
o 3. miejsce). Strona, na którą wchodzą, jest wspólna dla obu, bo wynika
z pozycji meczu źródłowego, a nie z tego, kto awansuje. Zmiana wyniku meczu,
który już wypełnił dalszą część drabinki, unieważnia mecze zależne.

Mecz w drabince musi mieć zwycięzcę, a w sportach dopuszczających remis sam
wynik go nie wyłania. Rozstrzyga wtedy seria rzutów karnych
(`homePenalties`, `awayPenalties`), notowana obok wyniku i wyłącznie wtedy, gdy
wynik jest remisowy. Karne nie są
zdobyczami: nie wchodzą do tabeli ani do statystyk, służą tylko wskazaniu, kto
awansuje.

## Bye (pauza)

Awans bez gry, gdy liczba drużyn nie pozwala obsadzić pełnej kolejki albo pełnej
rundy. Pauza nigdy nie jest meczem: nie ma terminu, wyniku ani wiersza
w terminarzu.

W lidze nie zostawia po sobie śladu — kolejka ma po prostu o jeden mecz mniej.
W drabince widać ją w jej kształcie: drużyna stoi w rundzie, do której nie
prowadzi żaden mecz.

## Match duration (długość meczu)

Czas jednego meczu razem z przerwą po nim, w minutach (10–600), trzymany
w `Tournament.matchDuration`. Turniej dostaje go przy zakładaniu jako kopię
`SportConfig.defaultMatchDuration`, a potem organizer zmienia go u siebie —
sport nigdy nie wyznacza go sam.

Wyznacza zarówno slot rozkładu dat, jak i okno kolizji. Zmiana długości nie
przesuwa żadnego terminu: zmienia tylko to, co liczy się jako kolizja.

## Collision (kolizja)

Nakładanie się okien dwóch meczów **tego samego turnieju** (także z różnych
faz): `[kickoffAt, kickoffAt + matchDuration)`. Dwa rodzaje:

- `team` — „Kolizja drużyny": mecze mają wspólną drużynę;
- `venue` — „Kolizja boiska": mecze grają na tym samym obiekcie.

Stykające się okna (koniec o 12:00, start o 12:00) nie kolidują. Mecz bez
terminu nie koliduje nigdy, a mecz bez obiektu nie ma kolizji `venue`. Mecze
zakończone liczą się tak samo jak pozostałe.

Kolizja jest ostrzeżeniem dla organizera, nie regułą: **nigdy nie blokuje
zapisu** i nie ma jej w bazie — liczy się ją przy każdym odczycie terminarza.

## MatchEvent (zdarzenie meczowe)

Pojedynczy fakt odnotowany w meczu: bramka, kartka, faul. Wiąże mecz, drużynę,
zwykle zawodnika i minutę.

Zbiór dopuszczalnych rodzajów zdarzeń wynika ze sportu turnieju. Zdarzenia są
źródłem statystyk indywidualnych (na przykład klasyfikacji strzelców), a nie
źródłem wyniku meczu: wynik jest wpisywany osobno, a liczba bramek ze zdarzeń
nie musi się z nim zgadzać.

Każdy rodzaj zdarzenia ma **wartość** (`value`): wkład jednego zdarzenia do
statystyki, do której się wlicza. W piłce każde zdarzenie jest warte 1,
a koszykówka rozbija punkty na rzuty: wolny (1), za 2 i za 3 — przy stoliku
klika się jeden rzut, a nie wpisuje liczbę punktów.

**Samobój** należy do drużyny zawodnika, który go strzelił, choć bramkę dostaje
przeciwnik. Do żadnej klasyfikacji się nie wlicza.

Przy wyniku meczu na stronie publicznej stoją **strzelcy meczu**
(`PublicMatch.scorers`): po jednym wierszu na zawodnika z sumą `value` zdarzeń
statystyki-zdobyczy sportu (bramki, rzuty), samobój osobno. Liczą się też
w meczu trwającym, inaczej niż klasyfikacja. Nazwa `scorers` obejmuje oba
sporty, tak jak `score` obejmuje bramki i punkty.

Zdarzenia ma tylko mecz rozpoczęty (trwający albo zakończony). Meczu ze
zdarzeniami nie da się cofnąć do zaplanowanych, dopóki ich nie usunąć.

## Score (zdobycze)

To, co drużyna zdobywa w meczu i z czego wynika jego rozstrzygnięcie: bramki
w piłce, punkty w koszykówce. Nazwa kanoniczna jest jedna dla wszystkich sportów,
bo tabela i kryteria rozstrzygające mają ten sam kształt niezależnie od dyscypliny.

Nie mylić z punktami w tabeli, które drużyna dostaje za wynik meczu (patrz
`Standing`). To dwie różne wielkości i w koszykówce obie nazywają się w UI
"punkty".

_Unikaj_: goals i bramki jako nazwa kanoniczna (to etykieta UI dla piłki),
points (zajęte przez punktację i punkty w tabeli, patrz `Points`).

## Points (punktacja)

Reguła turnieju, która mówi, ile punktów w tabeli daje drużynie wygrana, remis
i porażka. Turniej dostaje ją przy zakładaniu jako kopię wartości domyślnych
sportu, a potem organizer zmienia ją u siebie.

Tabela jest zawsze aktualnym wnioskiem z zakończonych meczów, więc zmiana
punktacji obejmuje też mecze już rozegrane, a powrót do poprzednich wartości
odtwarza poprzednią tabelę.

Nie mylić z punktami w wierszu tabeli, które są wynikiem zastosowania
punktacji, ani ze zdobyczami (`Score`). W kodzie obie pierwsze wielkości
nazywają się `points`: `Tournament.points` to punktacja, `StandingRow.points`
to punkty drużyny.

_Unikaj_: „punkty” jako nazwa reguły (to wynik jej zastosowania w tabeli).

## Standing (tabela)

Klasyfikacja drużyn w obrębie fazy `league` albo pojedynczej grupy. Nie jest
bytem, który ktokolwiek tworzy ani zapisuje: to zawsze aktualny wniosek
z zakończonych meczów.

Pojedynczy wiersz tabeli (`StandingRow`) opisuje jedną drużynę: rozegrane mecze,
bilans zdobyczy (`scoreFor`, `scoreAgainst`, `scoreDifference`), punkty
i pozycję. `points` w wierszu tabeli to zawsze punkty za wyniki meczów, nigdy
zdobycze.

Tabela niesie też `scoreLabel` — etykietę, pod jaką zdobycze występują
w interfejsie tego turnieju — oraz `allowsDraw` sportu i kryteria
(`tiebreakers`), według których ją ułożono.

## StatLeaderboard (klasyfikacja)

Ranking zawodników turnieju według jednej statystyki sportu: bramek, kartek,
punktów, fauli. Statystyki sportu to jego `availableStats`, z etykietami
w `statLabels`, a pierwsza z nich jest domyślna. Tak jak tabela, klasyfikacja
nie jest bytem zapisywanym: liczy się przy odczycie z meczów zakończonych ze
wszystkich faz turnieju, jedna na turniej.

Wartość zawodnika to suma `value` typów zdarzeń, których `stat` to wybrana
statystyka: kartka i faul liczą się sztuką, rzuty w koszu po 1, 2 i 3.
Samobój (`stat: null`) nie wchodzi do żadnej klasyfikacji, a zdarzenie bez
zawodnika też nie. Na liście są wszyscy z wartością większą od zera. Przy
równej wartości pozycja jest dzielona, a zawodnicy ex aequo idą po id.

_Unikaj_: *top scorers* i „strzelcy” jako nazwy kanonicznej — to etykieta UI
dla piłki, ten sam chwyt co przy `Score` (ADR 0003).

## Tiebreaker (kryterium rozstrzygające)

Reguła ustalająca kolejność drużyn, które mają tyle samo punktów. Turniej ma
uporządkowaną listę takich kryteriów, stosowanych po kolei aż do rozstrzygnięcia.

`head_to_head` (bezpośredni mecz) jest szczególnym kryterium (#160):

1. To **mini-tabela** z zakończonych meczów fazy rozegranych między remisującymi
   drużynami, sortowana po punktach, bilansie i zdobyczach w tych meczach.
   Pozostaje jednym kryterium.
2. Drużyny, których mini-tabela nie rozdzieliła, idą do **następnego** kryterium
   z listy, bez ponownego zawężania do meczów między nimi.
3. Jest pomijane, dopóki w fazie istnieje niezakończony mecz między remisującymi.

Po całej liście turnieju zawsze rozstrzyga ukryte ostatnie kryterium (#160,
reguła 4): **nazwa drużyny**, alfabetycznie po polsku, bez rozróżniania
wielkości liter. Nie należy do listy i organizer go nie zmienia. Miejsce
w tabeli jest więc zawsze unikalne, a pozycji ex aequo nie ma.

Kryteria liczone ze zdobyczy noszą nazwę `Score`, nie `goals`: `score_diff`,
`score_for`, `score_against`.

Sport rozstrzyga dwie rzeczy o kryteriach, i są to dwie różne listy.
**Dopuszczalne** (`availableTiebreakers`) to zbiór, z którego organizer w ogóle
może wybierać. **Domyślne** (`defaultTiebreakers`) to uporządkowana lista, którą
turniej dostaje przy zakładaniu i którą organizer potem u siebie zmienia —
w sporcie nie zmienia jej nikt (decyzja #25).
