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

Stan meczu: zaplanowany, trwający, zakończony. Tylko mecz zakończony wpływa na
tabelę i na statystyki.

W drabince mecz wskazuje mecz, do którego awansuje zwycięzca. Zmiana wyniku
meczu, który już wypełnił dalszą część drabinki, unieważnia mecze zależne.

## MatchEvent (zdarzenie meczowe)

Pojedynczy fakt odnotowany w meczu: bramka, kartka, faul. Wiąże mecz, drużynę,
zwykle zawodnika i minutę.

Zbiór dopuszczalnych rodzajów zdarzeń wynika ze sportu turnieju. Zdarzenia są
źródłem statystyk indywidualnych (na przykład klasyfikacji strzelców), a nie
źródłem wyniku meczu: wynik jest wpisywany osobno.

## Standing (tabela)

Klasyfikacja drużyn w obrębie fazy `league` albo pojedynczej grupy. Nie jest
bytem, który ktokolwiek tworzy ani zapisuje: to zawsze aktualny wniosek
z zakończonych meczów.

Pojedynczy wiersz tabeli (`StandingRow`) opisuje jedną drużynę: rozegrane mecze,
bilans, punkty i pozycję.

## Tiebreaker (kryterium rozstrzygające)

Reguła ustalająca kolejność drużyn, które mają tyle samo punktów. Turniej ma
uporządkowaną listę takich kryteriów, stosowanych po kolei aż do rozstrzygnięcia.

`head_to_head` (bezpośredni bój) jest szczególnym kryterium: porównuje wyłącznie
mecze rozegrane między remisującymi drużynami. Jeżeli nie rozstrzyga, stosuje się
kolejne kryterium z listy, bez ponownego zagłębiania się w bezpośredni bój.
