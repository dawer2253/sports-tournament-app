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

**Zapisy** to okres, w którym turniej przyjmuje zgłoszenia drużyn (patrz
`TeamRegistration`). Otwiera je i zamyka organizer, opcjonalnie z terminem.
Nawet przy otwartych zapisach zgłoszenie przechodzi tylko w turnieju trwającym,
przed pierwszym meczem rozpoczętym i przed terminem.

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

**Sport z setami** (#301) to sport, którego mecz rozstrzygają sety, a nie suma
zdobyczy — dziś siatkówka. Poznaje się go po domyślnym formacie seta
(`SportConfig.defaultSetFormat`), bez osobnej flagi. Wynik meczu to sety
wygrane, remisu nie ma, dogrywki też nie, a mecz ma jedną część bez czasu.

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

Faza `group` może mieć jedną grupę. Wtedy działa jak liga, po której gra się
puchar.

**Skład grup** to przydział każdej drużyny turnieju do dokładnie jednej grupy
fazy, razem z nazwami i kolejnością grup. Organizer ustala go zawsze w całości
i w całości go zastępuje. Grupy mogą być nierówne, ale każda ma co najmniej dwie
drużyny. **Losowanie grup** to wymieszanie drużyn do grup o zadanych rozmiarach.
Wynikiem losowania jest zwykły skład grup, z którego nie da się odczytać, że
był losowany. Koszyków nie ma.

Każda grupa mówi, ile drużyn z niej wychodzi (patrz **Qualifiers**). Tę liczbę
można zmieniać także po zamrożeniu składu, dopóki faza `knockout` nie ma meczu
rozpoczętego.

## Qualifiers (wyjście z grupy)

Przejście najlepszych drużyn każdej grupy do fazy `knockout`. Każda grupa ma
własną liczbę drużyn, które z niej wychodzą, więc z trzech grup do drabinki
ośmiu wychodzi np. 3, 3 i 2. Drużyn z tego samego miejsca w różnych grupach
(np. najlepszych trzecich) nie porównuje się ze sobą.

Domyślnie z grupy wychodzi czołówka jej tabeli. Przy generowaniu drabinki
organizer może podmienić drużynę na inną z tej samej grupy, np. gdy remis na
linii rozstrzyga według regulaminu turnieju losowanie albo karne. Liczba
drużyn wychodzących z grupy zostaje przy tym ta sama.

Drabinka powstaje dopiero z wyjścia z grupy. Przed jej wygenerowaniem nie ma
slotów opisanych miejscem w grupie („zwycięzca grupy A”), a po nim drabinka
nie pamięta, z którego miejsca przyszła drużyna. Wynik meczu grupy wpisany
później niczego w drabince nie zmienia. Gdy drabinka różni się od czołówki
tabel, organizer widzi, kto gra zamiast kogo, i może ją wygenerować ponownie,
dopóki faza `knockout` nie ma meczu rozpoczętego.

_Unikaj_: „awans” i „kwalifikacja”. Awans to wejście zwycięzcy meczu
pucharowego do meczu zależnego.

## Round (kolejka / runda)

Uporządkowany zbiór meczów rozgrywanych jako jedna całość. Należy do fazy.

W fazie `group` kolejka jest wspólna dla wszystkich grup: „Kolejka 1” zawiera
mecze pierwszej kolejki każdej grupy. Przy nierównych grupach ostatnie kolejki
mają mecze tylko większych grup.

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

Drużynę dodaje organizer albo powstaje ona z przyjętego zgłoszenia (patrz
`TeamRegistration`). W obu przypadkach obowiązują te same reguły i te same
skutki opisane niżej.

Usunięcie drużyny usuwa też jej mecze zaplanowane. Reszta terminarza zostaje
bez zmian, nawet jeśli kolejka opustoszeje. Tak samo jest w grupie: grupa może
po tym opustoszeć.

Drużyna dodana po ustaleniu składu grup nie ma grupy, dopóki organizer nie
zapisze składu od nowa. Do tego czasu nie stoi w żadnej tabeli, a terminarza
fazy grupowej nie da się wygenerować. Od pierwszego meczu rozpoczętego fazy
grupowej skład grup jest zamrożony i drużyny nie przechodzą między grupami.

W pucharze jest inaczej, bo drabinki nie da się załatać jak kolejki. Usunięcie
drużyny, która stoi w drabince, przed pierwszym meczem rozpoczętym fazy kasuje
całą drabinkę, a organizer generuje ją od nowa. Po starcie usunięcie jest
zablokowane, także dla drużyny, która jeszcze nie grała; wycofanie drużyny
wpisuje się wtedy jako walkower.

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

## TeamRegistration (zgłoszenie)

Wniosek o udział drużyny w turnieju, wysłany ze strony publicznej w czasie
zapisów przez osobę bez konta. Niesie nazwę drużyny, dane kontaktowe
zgłaszającego i opcjonalny skład. Stany: oczekujące, przyjęte, odrzucone; o
każdym rozstrzyga organizer, także po zamknięciu zapisów.

**Zgłaszający** to osoba kontaktowa zgłoszenia (etykieta UI „Osoba
kontaktowa”): ktokolwiek wysyła zgłoszenie w imieniu drużyny, np. trener albo
kierownik. Nie jest zawodnikiem i nie musi być w składzie.

Zgłoszenie nie jest drużyną: nie stoi w tabeli, w grupie ani w terminarzu
i niczego w turnieju nie blokuje. Przyjęcie tworzy drużynę i zawodników ze
składu według tych samych reguł, co dodanie drużyny przez organizatora, więc
może się nie udać (np. nazwa zajęta w międzyczasie). Dwa oczekujące zgłoszenia
mogą nosić tę samą nazwę; rozstrzyga to dopiero przyjęcie.

Dane kontaktowe zna tylko organizer i nie przechodzą do drużyny. Odrzucenie
je usuwa. Przyjęte zgłoszenie żyje tak długo jak jego drużyna: usunięcie
drużyny usuwa też zgłoszenie razem z danymi.

_Unikaj_: „rejestracja” — to założenie konta organizera. „Kapitan” dla
zgłaszającego — kapitan to rola zawodnika na boisku, której model nie zna.

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
organizer ręcznie, a w meczu trwającym zmieniają go też zdarzenia (patrz
`MatchEvent`, ADR-0013). Przy sporcie bez remisów (`allowsDraw: false`) remis
jest dozwolony w meczu trwającym, ale nie w zakończonym.

**Mecz rozpoczęty** to mecz trwający albo zakończony, czyli każdy poza
zaplanowanym. Wiąże drużyny, zawodników i obiekt, które w nim uczestniczą:
żadnego z nich nie da się usunąć, a turniej z meczem rozpoczętym nie przyjmuje
nowych drużyn i nie wraca do szkicu.

_Unikaj_: „rozegrany” (`played`) jako nazwy meczu rozpoczętego. Mecz rozegrany
to mecz zakończony, i tak liczy go tabela.

Mecz ma pozycję własną: numer w obrębie swojej kolejki (`matchNumber`). W lidze
porządkuje kolejkę, w drabince razem z numerem rundy wyznacza miejsce meczu
w choince i pozwala widokowi wyliczyć jego etykietę („Półfinał 1”, „Finał”).
Etykiety pozycji meczu (SF1) nie przechowujemy, a nazwa rundy („Półfinał”) jest
zapisana, bo powstaje razem z drabinką i znika z nią. Pozycja własna to
co innego niż to, dokąd awansują uczestnicy meczu — te dwie rzeczy nie mieszczą
się w jednym pojęciu.

W drabince mecz wskazuje, dokąd trafiają jego uczestnicy po rozstrzygnięciu:
osobno zwycięzca, osobno przegrany (ten drugi tylko wtedy, gdy turniej ma mecz
o 3. miejsce). Strona, na którą wchodzą, jest wspólna dla obu, bo wynika
z pozycji meczu źródłowego, a nie z tego, kto awansuje. Zmiana zwycięzcy
meczu, który już wypełnił dalszą część drabinki, podmienia drużynę w meczach
zależnych, dopóki są zaplanowane. Gdy któryś z nich jest już rozpoczęty, zmiana
jest zablokowana: organizator cofa najpierw mecze od końca. Okna potwierdzenia
nie ma, a nic nie sięga dalej niż jeden poziom.

Mecz drabinki bez obu drużyn czeka na rywali: może mieć termin i obiekt, ale
nie wynik ani stan inny niż zaplanowany.

**Awans** to wejście zwycięzcy, a w meczu o 3. miejsce także przegranego, do
slotu meczu zależnego w chwili, gdy mecz zostaje zakończony. Mecz trwający
nikogo nie wpuszcza. Powrót meczu z zakończonego zeruje ten slot, a zmiana
zwycięzcy go podmienia; termin, obiekt i druga drużyna meczu zależnego
zostają. Slotu po wolnym losie awans nie dotyka, bo nie prowadzi do niego
żaden mecz.

**Mecz zależny** to mecz, do którego prowadzi krawędź zwycięzcy albo
przegranego danego meczu (`winnerToMatchId`, `loserToMatchId`). Półfinał ma
ich dwa, gdy turniej ma mecz o 3. miejsce.

_Unikaj_: „kaskada” — zmiana nie przechodzi przez drabinkę dalej niż do meczów
zależnych.

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
prowadzi żaden mecz. Tam pauzę (w UI „wolny los”) dostają najwyżej rozstawieni,
więc stoją od razu w drugiej rundzie.

## Seeding (rozstawienie)

Kolejność drużyn podana przy generowaniu drabinki, od najwyżej rozstawionej.
Wyznacza, kto z kim gra w pierwszej rundzie i komu przypada wolny los, tak że
najwyżej rozstawieni spotykają się jak najpóźniej.

Rozstawienie nie jest przechowywane: zostaje po nim tylko kształt drabinki.
Losowanie to wymieszanie tej kolejności, w całości albo poniżej zablokowanej
góry listy.

W turnieju grupy + playoff rozstawienie proponuje automat z wyjścia z grupy:
najpierw zwycięzcy grup, potem drugie miejsca i tak dalej. Kolejność grup
w obrębie miejsca dobiera tak, żeby drużyny z jednej grupy nie grały ze sobą
w pierwszej rundzie, o ile da się tego uniknąć, i spotkały się jak najpóźniej.
Przy jednej grupie propozycja to po prostu kolejność tabeli. Organizer poprawia
ją jak każde rozstawienie.

## Match duration (długość meczu)

Czas jednego meczu razem z przerwą po nim, w minutach (10–600), trzymany
w `Tournament.matchDuration`. Turniej dostaje go przy zakładaniu jako kopię
`SportConfig.defaultMatchDuration`, a potem organizer zmienia go u siebie —
sport nigdy nie wyznacza go sam.

Wyznacza zarówno slot rozkładu dat, jak i okno kolizji. Zmiana długości nie
przesuwa żadnego terminu: zmienia tylko to, co liczy się jako kolizja.

## Match period (część meczu)

Połowa, tercja albo kwarta: jedna z części, na które dzieli się mecz, trzymana
w `Tournament.periods` jako liczba części (1–10) i minuty jednej części. To
**ustawienie turnieju**, a nie sportu, bo amatorskie mecze mają różne części,
a w koszu bywa bez kwart. Turniej dostaje je przy zakładaniu jako kopię
`SportConfig.defaultPeriods` (piłka 2 × 45, kosz 4 × 10), wzorem długości
meczu. Jedna część znaczy „bez podziału”. Sport z setami ma zawsze jedną część
bez czasu, a organizator jej nie zmienia: set nie jest częścią meczu (patrz
`Set`).

**Etykieta wynika z liczby części, nie ze sportu**: 2 → „połowa”, 3 →
„tercja”, 4 → „kwarta”, inna liczba → „część” („1. połowa”, „3. kwarta”).

Zdarzenie należy do części `min(liczba części, ⌈minuta / minuty części⌉)`.
Część liczy się z samej `minute`, bez **doliczonego czasu** (`addedTime`, osobne
pole zdarzenia: `minute: 45, addedTime: 3` to „45+3′”), więc „45+3” zostaje
w 1. połowie, a dogrywka trafia do ostatniej części. Stare zdarzenia z
doliczonym czasem zapisanym zwykłą liczbą (`47`) trafiają do następnej części
i zostają bez migracji. Zdarzenie bez minuty
i każde zdarzenie turnieju bez podziału nie ma części. Część liczy się przy
odczycie, więc zmiana ustawienia działa wstecz na wszystkie mecze turnieju.
Z części korzysta relacja na stronie meczu (`PublicMatchDetail`).

Etykieta ma też **dopełniacz**, do przycisku w panelu: „Start 2. połowy”,
„2. tercji”, „2. kwarty”, „2. części”.

**Bieżąca część** (#297) to część, którą mecz trwający właśnie gra
(`Match.livePeriod`), ze startem stemplowanym przez serwer
(`periodStartedAt`). Organizator prowadzi ją w oknie meczu: „Trwa” startuje
1. część, a dalej jeden przycisk na zmianę, „Przerwa” albo „Start 2. połowy”.
W API przycisk to pole `periodRunning` w zmianie meczu (`MatchUpdate`):
`false` zaczyna przerwę, a `true` razem z `livePeriod` startuje część. To
nie `SportConfig.runningClock`, które mówi, czy w ogóle pokazujemy minutę.
Start przyjmuje tylko następną część (bieżąca + 1), a przerwa wchodzi tylko
po części, która trwa i nie jest ostatnią.

- **Przerwa**: część się skończyła, a następna jeszcze nie ruszyła; zegar stoi
  i tablica pokazuje „Przerwa”. Turniej bez podziału przerwy nie ma.
- **Dogrywka** to część po ostatniej (numer `liczba części + 1`), tylko
  w meczu pucharowym, razem z karnymi: przycisk „Dogrywka / karne”, a w sporcie
  bez remisu (bez karnych) „Dogrywka”. Tablica pokazuje „Dogrywka” bez minuty.
  W sporcie z setami dogrywki nie ma: set nie kończy się remisem, a mecz trwa
  do rozstrzygnięcia w setach.
- **Stała minuta startu części**: część `n` startuje od minuty
  `(n − 1) × minuty części + 1`, więc 2. połowa (2 × 45) zawsze od 46′,
  niezależnie od tego, ile doliczono w 1. Po regulaminowym końcu części
  zegar pokazuje **doliczony czas** „45+N′” („90+4′”). Znak minuty to „′”.
- **Zapomniany mecz**: po 30 minutach ponad regulaminowy koniec części zegar
  znika i zostaje samo „Na żywo”. W turnieju bez podziału regulaminowym końcem
  jest długość meczu.
- **Powrót z „Zakończony” do „Trwa”** wraca do ostatniej części bez zegara:
  samo „Na żywo”, nie „Przerwa”, dopóki organizator nie zacznie następnej.
- W sporcie bez biegnącego zegara (`SportConfig.runningClock: false`,
  koszykówka) tablica pokazuje część („3. kwarta”) zamiast minuty.

**Minuta zegara to nie minuta zdarzenia**: zegar liczy przeglądarka z startu
części, a minutę zdarzenia zapisuje organizator. Panel podpowiada ją z zegara
w chwili kliknięcia rodzaju zdarzenia (`matchClockMinute`, `{ minute,
addedTime }`; `null` w przerwie, w zapomnianym meczu, w dogrywce, w sporcie bez
biegnącego zegara i w sporcie z setami), a organizator może ją poprawić przed
wyborem zawodnika.

## Set (set)

Rozgrywka do progu punktów w sporcie z setami (#301). Mecz wygrywa drużyna,
która pierwsza wygra wymaganą liczbę setów. Set wygrywa drużyna, która pierwsza
zdobędzie próg (domyślnie 25) z wymaganą przewagą (domyślnie 2). Wyniki setów
meczu trzyma `Match.sets`, a wynik meczu to sety wygrane.

- **Gra na przewagi**: przy przewadze 2, po wyrównaniu na progu minus jeden
  (24:24), gra toczy się do przewagi dwóch punktów, bez górnej granicy (26:24,
  31:29). Przy przewadze 1 set kończy się na progu (25:24). Gra na przewagi to
  nie dogrywka: dogrywka jest częścią meczu, a gra na przewagi częścią seta.
- **Set decydujący** to ostatni możliwy set meczu: 5. przy meczu do 3 wygranych
  (grany przy 2:2), 3. przy meczu do 2 (przy 1:1). Gra się go do niższego progu
  (domyślnie 15).
- **Set niedokończony** to wynik, od którego gra może jeszcze trwać. Tylko
  ostatni set meczu trwającego może być niedokończony.
- **Punkty w setach** to punkty zdobyte w setach meczu (`rallyPointsFor`,
  `rallyPointsAgainst` w wierszu tabeli). Nie mylić z punktami w tabeli ani
  z punktami zawodnika w klasyfikacji.

Set nie jest częścią meczu (`Match period`), bo nie ma czasu.

**Numer bieżącego seta** (#302) strona liczy z wpisanych wyników, a nie z pól części: to liczba setów w `Match.sets`, jeśli ostatni jest niedokończony, albo następny po rozstrzygniętym („3. set” przy 1:1 i wpisanych dwóch setach). Progi bierze z `PublicTournament.setFormat`. Gdy wynik meczu jest przesądzony, a mecz jeszcze trwa, przy „Na żywo” nie stoi nic. Przerwy między setami strona nie pokazuje.

_Unikaj_: dogrywka i tie-break (o grze na przewagi), małe punkty (zamiast
„punkty w setach”), część (o secie).

## Set format (format seta)

Ustawienie turnieju w sporcie z setami (#301), trzymane w
`Tournament.setFormat`: do ilu wygranych setów gra się mecz (2 albo 3), próg
seta, próg seta decydującego (nie większy od progu seta) i przewaga (1 albo 2).
Turniej dostaje go przy zakładaniu jako kopię `SportConfig.defaultSetFormat`
(do 3 setów, 25, 15, przewaga 2), wzorem długości meczu.

**Zmienia się tylko przed pierwszym wpisanym setem.** Format to reguła, według
której wyniki powstały, więc jego zmiana zrobiłaby z wpisanych setów niepoprawne.
Punktacja i kryteria tylko wyniki oceniają, więc działają wstecz.

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
źródłem statystyk indywidualnych (na przykład klasyfikacji strzelców). W meczu
trwającym zdarzenie-zdobycz zmienia też zapisany wynik meczu o swoją wartość,
w tej samej transakcji (samobój liczy się przeciwnikowi; kartka, faul i sport
z setami wyniku nie ruszają); w meczu zakończonym zdarzenie wyniku nie zmienia
(ADR-0013). Wynik pozostaje polem meczu, które organizator może poprawić
ręcznie, więc liczba bramek ze zdarzeń nie musi się z nim zgadzać.

Każdy rodzaj zdarzenia ma **wartość** (`value`): wkład jednego zdarzenia do
statystyki, do której się wlicza. W piłce każde zdarzenie jest warte 1,
a koszykówka rozbija punkty na rzuty: wolny (1), za 2 i za 3 — przy stoliku
klika się jeden rzut, a nie wpisuje liczbę punktów. Siatkówka ma as serwisowy,
blok punktowy i atak punktowy, każde za 1: to wybrane akcje zawodnika, a nie
każdy punkt w secie, więc z wynikiem meczu (setami) się ich nie porównuje.

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
w piłce, punkty w koszykówce, sety w siatkówce. Nazwa kanoniczna jest jedna dla
wszystkich sportów, bo tabela i kryteria rozstrzygające mają ten sam kształt
niezależnie od dyscypliny. W sporcie z setami zdobycze liczy serwer z wyników
setów, a organizator ich nie wpisuje.

Nie mylić z punktami w tabeli, które drużyna dostaje za wynik meczu (patrz
`Standing`). To dwie różne wielkości i w koszykówce obie nazywają się w UI
"punkty".

_Unikaj_: goals i bramki jako nazwa kanoniczna (to etykieta UI dla piłki),
points (zajęte przez punktację i punkty w tabeli, patrz `Points`).

## Points (punktacja)

Reguła turnieju, która mówi, ile punktów w tabeli daje drużynie wygrana, remis
i porażka. Turniej dostaje ją przy zakładaniu jako kopię wartości domyślnych
sportu, a potem organizer zmienia ją u siebie.

W sporcie z setami punktacja ma jeszcze punkty za wygraną i porażkę **w secie
decydującym** (mecz rozstrzygnięty różnicą jednego seta: 3:2, 2:1), domyślnie
2 i 1, a pozostałe wygrane i porażki dają 3 i 0. To dalej dane turnieju, nie
osobny algorytm sportu.

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
(`tiebreakers`), według których ją ułożono. W sporcie z setami wiersz ma też
punkty w setach, a tabela ich etykietę (`rallyPointsLabel`).

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

Sport z setami ma dwa kryteria ilorazowe (#301): **stosunek setów** (`set_ratio`,
sety wygrane do przegranych) i **stosunek punktów w setach** (`point_ratio`).
Liczy się iloraz, nie różnica. Drużyna bez straconego seta stoi wyżej niż każda
ze straconym, a z dwóch bez straconego wyżej ta, która wygrała więcej.

Sport rozstrzyga dwie rzeczy o kryteriach, i są to dwie różne listy.
**Dopuszczalne** (`availableTiebreakers`) to zbiór, z którego organizer w ogóle
może wybierać. **Domyślne** (`defaultTiebreakers`) to uporządkowana lista, którą
turniej dostaje przy zakładaniu i którą organizer potem u siebie zmienia —
w sporcie nie zmienia jej nikt (decyzja #25).
