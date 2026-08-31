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

## Slug

Krótki, czytelny identyfikator turnieju używany w publicznym adresie. Unikalny
globalnie, nie tylko w obrębie jednego organizera.

## Sport

Zestaw reguł, które określają jak liczy się wynik: ile punktów daje zwycięstwo,
jakie zdarzenia mogą wystąpić w meczu, po czym można rozstrzygać remisy w tabeli
i jakie statystyki mają sens.

Sport jest predefiniowany. Organizer nie tworzy sportów, wybiera jeden z listy,
a następnie dostosowuje jego parametry w obrębie swojego turnieju.

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

## Team (drużyna)

Uczestnik turnieju. Należy do jednego turnieju. Dwie drużyny o tej samej nazwie
w dwóch turniejach to dwa niepowiązane byty.

## Player (zawodnik)

Osoba przypisana do drużyny. Istnieje po to, żeby przypisywać jej zdarzenia
meczowe i budować z nich statystyki indywidualne.

## Venue (obiekt)

Miejsce rozegrania meczu. Należy do turnieju.

## Match (mecz)

Spotkanie dwóch drużyn w ramach kolejki. Ma gospodarza i gościa, planowany
termin, opcjonalny obiekt i stan.

Jedyny byt, którego nazwa kanoniczna nie brzmi tak samo wszędzie: klasa modelu
w backendzie nazywa się `GameMatch`
([ADR 0005](docs/adr/0005-schemat-ustepuje-ograniczeniom-php-i-mysql.md)).

Stan meczu: zaplanowany, trwający, zakończony. Tylko mecz zakończony wpływa na
tabelę i na statystyki.

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

## MatchEvent (zdarzenie meczowe)

Pojedynczy fakt odnotowany w meczu: bramka, kartka, faul. Wiąże mecz, drużynę,
zwykle zawodnika i minutę.

Zbiór dopuszczalnych rodzajów zdarzeń wynika ze sportu turnieju. Zdarzenia są
źródłem statystyk indywidualnych (na przykład klasyfikacji strzelców), a nie
źródłem wyniku meczu: wynik jest wpisywany osobno.

## Score (zdobycze)

To, co drużyna zdobywa w meczu i z czego wynika jego rozstrzygnięcie: bramki
w piłce, punkty w koszykówce. Nazwa kanoniczna jest jedna dla wszystkich sportów,
bo tabela i kryteria rozstrzygające mają ten sam kształt niezależnie od dyscypliny.

Nie mylić z punktami w tabeli, które drużyna dostaje za wynik meczu (patrz
`Standing`). To dwie różne wielkości i w koszykówce obie nazywają się w UI
"punkty".

_Unikaj_: goals i bramki jako nazwa kanoniczna (to etykieta UI dla piłki),
points (zajęte przez punkty w tabeli).

## Standing (tabela)

Klasyfikacja drużyn w obrębie fazy `league` albo pojedynczej grupy. Nie jest
bytem, który ktokolwiek tworzy ani zapisuje: to zawsze aktualny wniosek
z zakończonych meczów.

Pojedynczy wiersz tabeli (`StandingRow`) opisuje jedną drużynę: rozegrane mecze,
bilans zdobyczy (`scoreFor`, `scoreAgainst`, `scoreDifference`), punkty
i pozycję. `points` w wierszu tabeli to zawsze punkty za wyniki meczów, nigdy
zdobycze.

## Tiebreaker (kryterium rozstrzygające)

Reguła ustalająca kolejność drużyn, które mają tyle samo punktów. Turniej ma
uporządkowaną listę takich kryteriów, stosowanych po kolei aż do rozstrzygnięcia.

`head_to_head` (bezpośredni bój) jest szczególnym kryterium: porównuje wyłącznie
mecze rozegrane między remisującymi drużynami. Jeżeli nie rozstrzyga, stosuje się
kolejne kryterium z listy, bez ponownego zagłębiania się w bezpośredni bój.

Kryteria liczone ze zdobyczy noszą nazwę `Score`, nie `goals`: `score_diff`,
`score_for`, `score_against`.

Sport rozstrzyga dwie rzeczy o kryteriach, i są to dwie różne listy.
**Dopuszczalne** (`availableTiebreakers`) to zbiór, z którego organizer w ogóle
może wybierać. **Domyślne** (`defaultTiebreakers`) to uporządkowana lista, którą
turniej dostaje przy zakładaniu i którą organizer potem u siebie zmienia —
w sporcie nie zmienia jej nikt (decyzja #25).
