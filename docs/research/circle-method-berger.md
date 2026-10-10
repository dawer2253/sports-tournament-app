# Circle method i tablice Bergera — jak układa się terminarz ligi

Badanie na potrzeby ticketu
[#164 „S2: research — circle method i tablice Bergera"](https://github.com/dawer2253/sports-tournament-app/issues/164).
Odblokowuje [#157 „S2: generowanie terminarza ligi"](https://github.com/dawer2253/sports-tournament-app/issues/157).
Data: 10 października 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Liczba rund, wariant
rewanżu, kolejność drużyn na wejściu i ewentualna biblioteka należą do #157.
Tam, gdzie fakty otwierają kilka dróg, są wypisane obok siebie, bez wskazania
zwycięzcy.

## 0. Źródła, metoda i słownik

Źródła pierwotne:

- prace naukowe o układaniu terminarzy round-robin: de Werra (1981) przez
  streszczenia w dwóch przeglądach, Rasmussen i Trick (2008), Kendall, Knust,
  Ribeiro i Urrutia (2010), Goossens i Spieksma (2012), Lambrechts i in. (2018),
  Devriesere, Csató i Goossens (2024) — pełne opisy w §11;
- regulamin FIDE (Handbook C.05, Annex 1) — oficjalne tablice Bergera;
- regulaminy rozgrywek: FIBA Internal Regulations Book 2, regulamin
  Basketball Champions League, regulaminy dwóch wojewódzkich ZPN;
- kod źródłowy i dokumentacja bibliotek PHP, metadane z Packagist i GitHuba
  (stan na 10 października 2026).

Wikipedia (angielska i polska) posłużyła tylko jako punkt wyjścia. Żadne
twierdzenie w tym pliku nie opiera się na niej samej.

**Prac de Werry (1980, 1981) nie czytałem w oryginale.** Jego wyniki
przytaczam tak, jak streszczają je dwa niezależne przeglądy (Rasmussen i Trick
oraz Kendall i in.) i jak powtarza je Goossens i Spieksma. Wszystkie trzy
streszczenia są ze sobą zgodne.

**Część liczb policzyłem sam** (§5.4, §7.3). Użyłem jednorazowego skryptu
w Pythonie, który odtwarza tablice FIDE i liczy przerwy. Skrypt nie trafił do
repo. Jego okrojona wersja, która odtwarza główną tabelę, jest w dodatku A.
Kodu PHP nie uruchamiałem: na hoście nie ma PHP (`backend/AGENTS.md`), a Sail
był poza zakresem. Zdania o zachowaniu bibliotek PHP to odczyt kodu albo port
algorytmu do Pythona, co zaznaczam przy każdym z nich.

Słownik używany w tym pliku:

| Termin | Znaczenie |
|---|---|
| **kolejka** | jeden termin gry (`Round` w `CONTEXT.md`), w literaturze *round* albo *slot* |
| **runda** | jeden pełny cykl „każdy z każdym", czyli pół sezonu przy dwóch meczach każdej pary. W literaturze *leg* albo *half series*. W `CONTEXT.md` słowo „runda" jest zarezerwowane dla fazy `knockout`, tu znaczy wyłącznie pół sezonu ligi |
| **wzorzec H/A** | ciąg „u siebie" (H) i „na wyjeździe" (A) jednej drużyny przez kolejne kolejki (*home–away pattern*) |
| **przerwa** | dwa kolejne mecze drużyny w tej samej roli: HH albo AA (*break*). Definicja: Kendall i in. §2, Goossens i Spieksma §5 |
| **seria** | najdłuższy ciąg kolejnych meczów w tej samej roli. Seria 3 oznacza dwie przerwy z rzędu |
| **drużyna-widmo** | fikcyjna drużyna dodana przy nieparzystej liczbie drużyn. Kto gra z nią, ten pauzuje (*dummy team*) |

## 1. Streszczenie

- **Circle method i tablice Bergera to ta sama konstrukcja.** Jedna drużyna
  stoi w miejscu, reszta obraca się po okręgu. Literatura nazywa wynik
  „kanoniczną 1-faktoryzacją" (de Werra). Tablice Bergera to jej konkretne
  uporządkowanie kolejek z gotowym przydziałem stron (białe/czarne w szachach,
  gospodarz/gość w sporcie). FIDE publikuje je dla 3–16 uczestników.
- **Minimum przerw w jednej rundzie przy parzystym n wynosi n − 2**, a
  kanoniczny układ de Werry je osiąga. Tablice Bergera FIDE też dają
  dokładnie n − 2 (policzone dla n = 4…20): dwie drużyny bez przerwy,
  pozostałe po jednej.
- **Przy nieparzystym n jedna runda może nie mieć ani jednej przerwy.** Taki
  układ powstaje z drużyną-widmem i jest jedyny z dokładnością do permutacji
  drużyn (Fronček i Meszka). Każda drużyna pauzuje raz.
- **Rewanż „lustrzany"** (ta sama kolejność, odwrócony gospodarz) ma co
  najmniej 3n − 6 przerw (de Werra). Lustro tablic Bergera daje dokładnie
  tyle, ale na styku rund część drużyn gra trzy razy z rzędu u siebie albo na
  wyjeździe. Przy nieparzystym n lustro daje każdej drużynie dokładnie jedną
  przerwę, na styku rund.
- **Inne warianty rewanżu**: francuski, angielski i odwrócony. Angielski
  i odwrócony mają mniej przerw (2n − 4 przy układzie de Werry), ale ta sama
  para gra wtedy w dwóch kolejnych kolejkach. FIDE zaleca przed lustrem
  zamienić dwie ostatnie kolejki pierwszej rundy.
- **W praktyce, według przeglądu 25 lig europejskich z sezonu 2008/09**,
  15 lig grało lustro, 4 schemat francuski, 1 angielski, a 5 nie miało
  żadnej symetrii. Polska Ekstraklasa grała wtedy lustro, ale nie na
  kanonicznym układzie (w sezonie 1994/95 na kanonicznym).
- **Biblioteki PHP**: `mnito/round-robin` jest dojrzała, ale prosta.
  `mission-gaming/tactician` jest najbogatsza, ale ma wersję 0.x, jest młoda
  i ma niewielu użytkowników. `heroyt/tournament-generator` jest w wersji
  alpha. Żadna nie jest pakietem Laravela w ścisłym sensie, a ich własności
  zebrane są w §9.

## 2. Circle method

**Konstrukcja.** Przy parzystym n jedną drużynę (oznaczaną n) stawia się
w środku okręgu, pozostałe n − 1 na jego obwodzie. W kolejce r drużyna
w środku gra z drużyną r. Pozostałe pary łączą drużyny położone symetrycznie
względem osi przechodzącej przez r. Następną kolejkę dostaje się przez obrót
o jedno miejsce. Formalnie, wg Lambrechtsa i in. (§2.3): w kolejce r drużyna
n gra z r, a drużyny i, j ∉ {r, n} grają ze sobą, gdy i + j ≡ 2r (mod n − 1).
Po n − 1 kolejkach każda para spotkała się dokładnie raz.

**Nazwy i pochodzenie.** Lambrechts i in. przypisują metodę Kirkmanowi (1847)
i wymieniają jej inne nazwy: *polygon method*, *canonical procedure*,
*Kirkman tournament*. W teorii grafów ten sam obiekt to kanoniczna
1-faktoryzacja grafu pełnego Kn, oznaczana też GK2n. De Werra (1981) podaje ją
wzorem Fi = {(n, i)} ∪ {(i + k, i − k) : k = 1, …, n − 1} (mod n − 1),
a Goossens i Spieksma (§3) przytaczają go za nim.

**Gospodarz w samym circle method nie jest ustalony.** Konstrukcja mówi
tylko, kto z kim gra w której kolejce. Strony trzeba przydzielić osobno
(Goossens i Spieksma §3: 1-faktoryzacja nie określa, kto ma przywilej gry
u siebie). Dwa udokumentowane sposoby przydziału opisują §4.1 i §4.2.

**Popularność.** Lambrechts i in. piszą, że circle method jest bardzo
popularny, jeśli nie najpopularniejszy. Goossens i Spieksma (§3) liczą: w
sezonie 1994/95 16 z 23 zbadanych lig piłkarskich grało na kanonicznej
1-faktoryzacji (za Griggsem i Rosą, 1996), a w 2008/09 już 13 z 25. Ligi
odchodziły od niej m.in. po wprowadzeniu programowania matematycznego
(Belgia, Niemcy, Norwegia).

## 3. Tablice Bergera

**Źródło normatywne.** FIDE Handbook C.05, Annex 1 publikuje tablice dla 3–4,
5–6, …, 15–16 uczestników. Przy nieparzystej liczbie uczestników najwyższy
numer oznacza pauzę. Para „a-b" oznacza, że a gra białymi; w sporcie
drużynowym odpowiada to gospodarzowi. Tablica dla 5–6 uczestników:

| Kolejka | Pary |
|---|---|
| 1 | 1-6, 2-5, 3-4 |
| 2 | 6-4, 5-3, 1-2 |
| 3 | 2-6, 3-1, 4-5 |
| 4 | 6-5, 1-4, 2-3 |
| 5 | 3-6, 4-2, 5-1 |

**Reguła tworzenia** (odczytana z tablic FIDE i sprawdzona skryptem: generator
odtwarza tablice FIDE dla 4, 6, 8, 10 i 12 uczestników co do par i stron):

1. Kolejka 1: 1 − n, 2 − (n − 1), 3 − (n − 2), …, czyli niższy numer jest
   gospodarzem.
2. Każdą następną kolejkę dostaje się, dodając n/2 do każdego numeru poza n
   (modulo n − 1, w zakresie 1…n − 1). Para zachowuje kolejność stron.
3. Drużyna n zmienia stronę co kolejkę: w kolejkach nieparzystych jest
   gościem, w parzystych gospodarzem.

**Związek z circle method.** Pary w tablicach Bergera to kanoniczna
1-faktoryzacja. Goossens i Spieksma (§3) piszą, że kolejność F1, F3, …, Fn−1,
F2, F4, …, Fn−2 daje tablicę Bergera. Angielska Wikipedia opisuje to samo jako
obrót o n/2 pozycji przy nieruchomym ostatnim numerze i przypisuje tablice
Johannowi Bergerowi (1893), a pierwotny pomysł Richardowi Schurigowi (1886).
Tej atrybucji nie sprawdzałem w źródle.

**Różnica praktyczna między „circle method" a „tablicami Bergera"** sprowadza
się więc do dwóch rzeczy. Pierwsza to kolejność kolejek: Berger przeskakuje co
drugą 1-faktoryzację. Druga to gotowy przydział stron. Zbiór meczów jest ten
sam.

**Rewanż wg FIDE.** Annex 1 zaleca w turnieju dwurundowym zamienić kolejność
dwóch ostatnich kolejek pierwszej rundy, żeby nikt nie grał trzy razy z rzędu
tym samym kolorem. Skutki liczbowe są w §7.3.

**Varma.** C.05 ma też Annex 2 z tablicami Varmy. Służą one do losowania
z ograniczeniami (np. rozdzielenia zawodników z tej samej federacji). Nie
badałem ich.

## 4. Gospodarz w każdej parze

### 4.1. Orientacja de Werry (minimum przerw)

De Werra podaje regułę, która na kanonicznej 1-faktoryzacji daje dokładnie
n − 2 przerw (Rasmussen i Trick, Def. 1 i Prop. 2; Goossens i Spieksma §5):

- mecz (i, n): gospodarzem jest i, gdy i jest nieparzyste, a n, gdy i jest
  parzyste;
- mecz (i + k, i − k) w kolejce Fi: gospodarzem jest i + k, gdy k jest
  nieparzyste, a i − k, gdy k jest parzyste.

Skrypt potwierdził n − 2 przerw dla n = 4…20, przy najdłuższej serii 2.

### 4.2. Orientacja z tablic Bergera

Strony zapisane w tablicach FIDE (§3) dają w jednej rundzie dla n = 4…20
(obliczenia własne):

- dokładnie n − 2 przerw, czyli minimum;
- dwie drużyny bez przerwy (numery n/2 i n), pozostałe po jednej;
- najdłuższą serię 2;
- różnicę między liczbą meczów u siebie i na wyjeździe najwyżej 1 na drużynę.

Przykład wzorców dla n = 6:

```
1 HHAHA    4 AAHAH
2 HAHHA    5 AHAAH
3 HAHAH    6 AHAHA
```

### 4.3. Naprzemienność „cała kolejka na zmianę"

Najprostszy przydział odwraca w co drugiej kolejce wszystkie pary naraz. Tak
robią `mnito/round-robin` i domyślna strategia `mission-gaming/tactician`
(§9). Port `make_schedule()` z `mnito/round-robin` v3.0.0 do Pythona (bez
tasowania) daje 2(n − 2) przerw w rundzie dla n = 4…20, czyli dwa razy więcej
niż minimum. Najwyżej 2 przerwy przypadają na drużynę. Dokumentacja
`tactician` podaje dla swojego domyślnego przydziału różnicę u siebie/na
wyjeździe do 3 przy parzystym n i do 4 przy nieparzystym.

## 5. Przerwy: ile jest nieuniknionych

### 5.1. Parzyste n, jedna runda

- **Dolna granica to n − 2** (de Werra 1981; Rasmussen i Trick, Prop. 1).
  Uzasadnienie: bez przerwy mogą grać tylko dwa wzorce (HAHA… i AHAH…), więc
  najwyżej dwie drużyny.
- **Granicę osiąga kanoniczny układ z orientacją de Werry** (Prop. 2) oraz,
  według obliczeń w §4.2, tablice Bergera.
- **Równy rozkład przerw kosztuje więcej.** Gdy każda drużyna ma mieć tyle
  samo przerw (*equitable schedule*), minimum rośnie do n w jednej rundzie
  i 2n w dwóch (de Werra 1980, za Goossensem i Spieksmą §5).

### 5.2. Nieparzyste n, jedna runda

- **Da się ułożyć rundę bez żadnej przerwy.** Wystarczy dodać drużynę-widmo
  i użyć kanonicznego układu dla n + 1 (de Werra, Corollary 1 u Rasmussena
  i Tricka). Rasmussen i Trick pokazują to na przykładzie: usunięcie drużyny
  6 z kanonicznego układu dla 6 drużyn daje układ 5 drużyn bez przerw.
- **Taki układ jest jedyny** z dokładnością do permutacji drużyn, jeśli każda
  drużyna pauzuje raz i nikt nie ma przerwy (Fronček i Meszka 2003, za
  Kendallem i in.).
- Tablice Bergera z widmem dały w obliczeniach 0 przerw dla n = 3…19. Wynik
  nie zależy od tego, czy pauzę traktuje się jako przerwanie ciągu, czy się
  ją pomija.

### 5.3. Dwie rundy

- **Rewanż lustrzany: co najmniej 3n − 6 przerw** (de Werra; Rasmussen
  i Trick, Prop. 3). Drużyna z przerwą w pierwszej rundzie ma odpowiadającą
  jej przerwę w drugiej, a do tego trzecią na początku drugiej rundy.
- **3n − 6 da się osiągnąć bez dwóch przerw z rzędu u żadnej drużyny, jeśli
  n ≠ 4** (Prop. 4). Wymaga to drobnej modyfikacji kanonicznego układu,
  nazywanej w literaturze *modified canonical schedule*. Samej modyfikacji nie
  odtwarzałem.
- **Bez wymogu dwóch odrębnych rund** wystarczy n − 2 przerw nawet przy
  wielokrotnych spotkaniach. Goossens i Spieksma pokazują w tabeli 4 przykład
  dla 6 drużyn i dwóch spotkań. Kolejki nie układają się wtedy w dwie osobne
  rundy „każdy z każdym".
- **Rewanż odwrócony lub angielski:** 2n − 4 przerw da się łatwo uzyskać
  z rundy o minimalnej liczbie przerw (Goossens i Spieksma §5).

### 5.4. Wyniki obliczeń dla parzystego n

Pierwsza runda to zawsze tablica Bergera z FIDE. Każda komórka podaje liczbę
przerw, a w nawiasie najdłuższą serię. Warianty rewanżu są opisane w §7.1.

| n | 1 runda | lustro | FIDE: zamiana + lustro | francuski | angielski | odwrócony | 3n − 6 |
|---|---|---|---|---|---|---|---|
| 4 | 2 (2) | 6 (3) | 6 (3) | 6 (3) | 6 (2) | 4 (2) | 6 |
| 6 | 4 (2) | 12 (3) | 14 (2) | 12 (3) | 10 (2) | 8 (2) | 12 |
| 8 | 6 (2) | 18 (3) | 22 (2) | 18 (3) | 14 (2) | 12 (2) | 18 |
| 10 | 8 (2) | 24 (3) | 30 (2) | 24 (3) | 18 (2) | 16 (2) | 24 |
| 12 | 10 (2) | 30 (3) | 38 (2) | 30 (3) | 22 (2) | 20 (2) | 30 |
| 16 | 14 (2) | 42 (3) | 54 (2) | 42 (3) | 30 (2) | 28 (2) | 42 |
| 18 | 16 (2) | 48 (3) | 62 (2) | 48 (3) | 34 (2) | 32 (2) | 48 |
| 20 | 18 (2) | 54 (3) | 70 (2) | 54 (3) | 38 (2) | 36 (2) | 54 |

Co z tego wynika (obliczenia, nie cytat):

- lustro tablic Bergera osiąga dolną granicę 3n − 6, ale ma serię 3;
- zalecenie FIDE usuwa serię 3 kosztem dodatkowych przerw: 4n − 10 zamiast
  3n − 6;
- schemat angielski na tablicach Bergera daje 2n − 2. Ten sam schemat na
  układzie de Werry dał 2n − 4.

## 6. Pauza i drużyna-widmo

- **Mechanizm.** Przy nieparzystym n dodaje się drużynę n + 1. Kto ma z nią
  grać, ten pauzuje (Kendall i in. §2; Rasmussen i Trick). FIDE stosuje to
  samo: najwyższy numer w tablicy oznacza pauzę. W tablicy dla 5 drużyn
  pauzują kolejno rywale numeru 6, czyli 1, 4, 2, 5, 3.
- **Liczby.** Jest n kolejek po (n − 1)/2 meczów. Każda drużyna pauzuje
  dokładnie raz w rundzie (wniosek z konstrukcji, potwierdzony skryptem).
- **Wpływ na naprzemienność.** Przy nieparzystym n rozkład jest lepszy niż
  przy parzystym (§5.2): runda bez przerw, a każda drużyna ma (n − 1)/2 meczów
  u siebie i tyle samo na wyjeździe. Wzorce dla 5 drużyn z tablic Bergera
  (`-` to pauza):

  ```
  1 -HAHA    3 HAHA-    5 AHA-H
  2 HA-HA    4 A-HAH
  ```

- **Lustro przy nieparzystym n** (obliczenia dla n = 3…19): każda drużyna ma
  dokładnie jedną przerwę, na styku rund, a najdłuższa seria wynosi 2. Liczba
  przerw zależy od definicji. Jeśli pauzę się pomija, jest ich n. Jeśli pauza
  rozdziela ciąg, jest ich n − 2, bo drużyna pauzująca w ostatniej kolejce
  pierwszej rundy i drużyna pauzująca w pierwszej kolejce drugiej rundy
  przerwy nie mają.
- **Definicja przerwy przy pauzie nie jest w literaturze jednolita.**
  Rasmussen i Trick traktują wzorzec jako ciąg H, A i pauz. Przeglądy, które
  czytałem, nie rozstrzygają jednak, czy H-pauza-H to przerwa.
- **W tym projekcie** pauza nie jest meczem i nie ma wiersza w terminarzu
  (hasło „Bye" w `CONTEXT.md`, decyzja #24 w `docs/PLAN.md` §6), więc widmo
  żyje tylko wewnątrz generatora. To stan planu, nie wniosek z researchu:
  `grep -n -A8 "## Bye" CONTEXT.md` i `grep -n "decyzja #24" docs/PLAN.md`.

## 7. Runda rewanżowa

### 7.1. Warianty opisane w literaturze

Definicje za Goossensem i Spieksmą (§4), z wyjątkiem ostatniego wiersza. We
wszystkich wariantach gospodarz w rewanżu jest odwrócony. Kolumna `s` to
najmniejsza liczba kolejek między dwoma meczami tej samej pary.

| Wariant | Druga runda | s |
|---|---|---|
| **lustro** (*mirrored*) | kolejka n − 1 + t = kolejka t | n − 1 |
| **francuski** | pierwsza kolejka rewanżów = kolejka 1, dalej kolejka n − 1 + t = kolejka t + 1 | n − 2 |
| **angielski** (Drexl i Knust 2007) | pierwsza kolejka rewanżów = ostatnia kolejka pierwszej rundy, dalej kolejka n + t = kolejka t | 1 |
| **odwrócony** (*inverted*) | kolejki pierwszej rundy w odwrotnej kolejności | 1 |
| **FIDE** (C.05 Annex 1) | lustro, ale w pierwszej rundzie zamienione dwie ostatnie kolejki | — (nie liczyłem) |

Własności wariantów:

- Goossens i Spieksma piszą, że schematy symetrii uchodzą za sprawiedliwsze,
  bo wstawiają wiele kolejek między dwa spotkania tej samej pary. Jednocześnie
  zawężają pole manewru przy innych życzeniach. Ligi bez symetrii stosują
  zamiast niej ograniczenie „co najmniej s kolejek między spotkaniami".
- W lustrze między dwoma spotkaniami tej samej pary leży zawsze n − 2 innych
  kolejek (Rasmussen i Trick, „separation constraints"). Goossens i Spieksma
  liczą to jako odstęp s = n − 1. To ta sama wielkość liczona inaczej.
- Schemat francuski pozwala z rundy o równym rozkładzie przerw zrobić dwie
  rundy o równym rozkładzie (Goossens i Spieksma §5).
- Kolejne rundy (trzecia, czwarta) w ligach, które je grają, kopiują pierwszą
  (Irlandia Płn., Słowacja) albo łączą schematy (Szwajcaria: lustro, potem
  odwrócony).

### 7.2. Co stosowały ligi (sezon 2008/09)

Tabela 3 u Goossensa i Spieksmy obejmuje 25 lig europejskich:

| Schemat | Liczba lig | Przykłady |
|---|---|---|
| lustro | 15 | Niemcy, Włochy, Hiszpania, **Polska** |
| francuski | 4 | Francja, Luksemburg, Rosja, Czechy |
| angielski | 1 | Austria (między 1. a 2. i 3. a 4. częścią) |
| lustro + odwrócony | 1 | Szwajcaria |
| brak symetrii | 5 | Anglia, Holandia, Norwegia, Szkocja, Walia |

Wiersz polskiej Ekstraklasy 2008/09 z tabel 3 i 5:

- 16 drużyn, 2 rundy;
- układ niekanoniczny (w 1994/95 kanoniczny);
- lustro, s = 15;
- 56 przerw, czyli 2,00× minimum dla dwóch osobnych rund;
- najdłuższa seria 4, od 3 do 7 przerw na drużynę.

Serię 4 meczów z rzędu u siebie lub na wyjeździe miały trzy ligi:
Luksemburg, Polska i Walia. W Irlandii Płn. seria wyniosła 5.

Inne obserwacje z tej pracy:

- żadna liga nie miała minimalnej liczby przerw;
- w 80% lig nikt nie ma przerwy w ostatniej kolejce;
- w mniej niż jednej trzeciej lig jakaś drużyna zaczyna sezon dwoma meczami
  wyjazdowymi albo dwoma domowymi.

### 7.3. Skutki liczbowe wariantów

Patrz tabela w §5.4. W skrócie, dla tablic Bergera i parzystego n:

- lustro: 3n − 6 przerw, seria 3;
- FIDE (zamiana + lustro): 4n − 10, seria 2;
- francuski: 3n − 6, seria 3;
- angielski: 2n − 2, seria 2;
- odwrócony: 2n − 4, seria 2.

### 7.4. Regulaminy, które sprawdziłem

- **FIBA Internal Regulations Book 2** (wydanie z 25 kwietnia 2024) w
  eliminacjach do mistrzostw świata przewiduje grupy grane „home and away"
  w oknach z kalendarza FIBA. Regulamin nie podaje algorytmu kolejności
  meczów ani schematu rewanżu (przeszukane pod kątem „round robin",
  „Berger", „home and away").
- **Regulamin Basketball Champions League 2024/25** (art. 17.2.2 i 17.4.2)
  mówi tylko, że kluby w grupie grają ze sobą „home and away" w systemie
  round-robin przez sześć dni meczowych. Algorytmu też nie podaje.
- **Regulaminy wojewódzkich ZPN** (Mazowiecki ZPN 2024/25, Podkarpacki ZPN
  2025/26) nie opisują, jak układa się terminarz. Odsyłają do terminarza
  publikowanego w systemie Extranet PZPN. Gospodarzem jest klub wpisany do
  terminarza na pierwszym miejscu (MZPN, przygotowanie boiska, ust. 8).

## 8. Efekt przeniesienia (carry-over)

To nie jest pytanie z ticketu, ale wpływa na ocenę circle method:

- Drużyna A dostaje efekt przeniesienia od C, jeśli jej bieżący rywal B grał
  w poprzedniej kolejce z C.
- Lambrechts i in. (2018) dowiedli, że przy parzystym n circle method daje
  **maksymalną** możliwą wartość tego efektu. Każdy układ o maksymalnej
  wartości da się wygenerować circle method.
- Goossens i Spieksma (2012, §7) opisują przypadki, w których media winiły
  efekt przeniesienia za wynik ligi (tytuł Brann Bergen w Norwegii, spadek
  Beveren w Belgii). W obu ligach przyczyniło się to do porzucenia układu
  kanonicznego.
- Ta sama praca zaznacza, że zamiana kilku kolejek układu kanonicznego (jak
  w Austrii i Szwajcarii) może mocno zmniejszyć tę nierównowagę.
- Według tej samej pracy pomiar na ponad 10 000 meczów ligi belgijskiej
  (Goossens i Spieksma 2010) wykazał pomijalny wpływ efektu przeniesienia na
  wynik i różnicę bramek.
- Przegląd Devriesere'a, Csató i Goossensa (2024, §6) wymienia to jako znany
  kompromis: minimum przerw (układ kanoniczny) idzie w parze z maksymalnie
  niezrównoważonym przeniesieniem.

## 9. Biblioteki PHP

Packagist przeszukałem 10 października 2026 hasłami „round-robin", „round
robin schedule", „berger" i „tournament schedule". Wyniki dotyczące load
balancingu i kolejek pominąłem. Liczby pobrań i daty pochodzą z API
Packagist (`https://packagist.org/packages/<nazwa>.json`), a gwiazdki i daty
utworzenia z API GitHuba.

| Pakiet | Ostatnie wydanie | PHP | Pobrania (łącznie / mies.) | Uwagi |
|---|---|---|---|---|
| [`mnito/round-robin`](https://github.com/mnito/round-robin) | v3.0.0, 30.06.2026 | ≥ 8.0 | ~76 tys. / ~1,3 tys. | repo od 2016, MIT, 62 gwiazdki |
| [`mission-gaming/tactician`](https://github.com/mission-gaming/tactician) | v0.2.2, 09.10.2026 | ^8.3 | ~8,9 tys. / ~2,8 tys. | repo od 09.2025, MIT, 1 gwiazdka, wersja 0.x |
| [`heroyt/tournament-generator`](https://github.com/Heroyt/tournament-generator) | v0.6.0-alpha, 24.07.2025 | ≥ 8.4 | ~17 tys. / ~0,3 tys. | repo od 2019, MIT, 66 gwiazdek |
| `tonystore/laravel-round-robin` | v0.1.1, 27.03.2022 | ^7.3\|^8.0\|^8.1 | ~1,6 tys. / 22 | pakiet Laravela, wydanie sprzed ponad 4 lat |
| `lucagentile/roundrobin-scheduler` | dev-master, 2017 | ≥ 5.6.4 | ~1 tys. / 0 | oznaczony na Packagist jako **abandoned** |
| `estbase/round-robin` | v2.0.0, 23.05.2024 | ^8.3 | 106 / 0 | — |
| `philicevic/berger` | 0.3.0, 20.04.2025 | ≥ 8.2 | 4 / 0 | jedyny z „Berger" w opisie |

Projekt deklaruje `"php": "^8.3"` (`grep -n '"php"' backend/composer.json`),
a Sail i CI używają PHP 8.5 (`grep -n "image:" backend/compose.yaml`,
`grep -n php-version .github/workflows/ci.yml`). W `backend/composer.json`
nie ma dziś żadnej biblioteki terminarza:
`grep -n -i "robin\|tactician" backend/composer.json` nic nie zwraca.

### 9.1. `mnito/round-robin`

Odczyt `src/functions/make_schedule.php` i `rotate.php` z gałęzi domyślnej:

- Circle method z nieruchomym pierwszym elementem tablicy. Przy nieparzystej
  liczbie drużyn dokleja `null` jako pauzę.
- Domyślnie tasuje drużyny: `shuffle()` z `srand()`, ziarno opcjonalne. Można
  to wyłączyć.
- Strony przydziela tak, że cała kolejka zmienia się co rundę (§4.3). Port
  do Pythona dał 2(n − 2) przerw w rundzie.
- Parametr `$rounds` pozwala wygenerować więcej kolejek niż n − 1, a obrót
  po prostu trwa dalej. W porcie do Pythona (bez tasowania, n = 4…10) druga
  seria n − 1 kolejek okazała się lustrem pierwszej. Nie sprawdzałem tego
  w PHP.
- Nie ma pojęcia nazw kolejek, dat, ograniczeń ani strategii rewanżu.
- Ostatnie commity (czerwiec 2026) poprawiają ostrzeżenia o deprecjacji
  i CI, a algorytm się nie zmienił. Kod nosi copyright z 2016 roku.

### 9.2. `mission-gaming/tactician`

Odczyt README i `docs/USAGE.md` z gałęzi domyślnej:

- Round-robin oparty na circle method. Ma też system szwajcarski, drabinki
  single i double elimination oraz fazy grupowe.
- Strategie kolejnych rund: `MirroredLegStrategy`, `RepeatedLegStrategy`
  i `ShuffledLegStrategy`. Schematu francuskiego ani angielskiego nie ma
  w dokumentacji.
- Przydział stron: domyślny `RoundParityRoleAssignment` (cała kolejka na
  zmianę) albo opcjonalny `BalancedRoleAssignment`. Ten drugi ma według
  dokumentacji nie dopuszczać trzech meczów z rzędu w tej samej roli
  wewnątrz rundy (testowane dla 2–30 uczestników). Dokumentacja sama
  zaznacza, że na styku rund lustro może dać serię 3 przy parzystym n i 4
  przy nieparzystym. Zapowiada też, że `BalancedRoleAssignment` zostanie
  domyślnym w 0.3.
- Ograniczenia (m.in. minimalny odstęp między spotkaniami tej samej pary,
  limit kolejnych ról), deterministyczna losowość przez `Random\Randomizer`
  oraz serializacja do JSON.
- Wersjonowanie 0.x: wydanie minor może łamać zgodność (README, sekcja
  „Versioning and stability"). Repo powstało we wrześniu 2025, ma jedną
  gwiazdkę i jest aktywnie rozwijane: ostatnie wydanie było dzień przed tym
  badaniem.

### 9.3. `heroyt/tournament-generator`

Odczyt `src/TournamentGenerator/Helpers/Generator.php` (commit `63a83ff`):

- Circle method z widmem `DUMMY_TEAM` i obowiązkowym `shuffle()` bez ziarna.
- Gospodarzem jest zawsze drużyna z pierwszej połowy tablicy, bez reguły
  naprzemienności.
- Kolejne iteracje kopiują mecze i co drugą odwracają strony.
- Nie sprawdzałem, jak `orderGames()` układa potem mecze w kolejności.
- Biblioteka modeluje własne obiekty `Tournament`, `Category`, `Group`
  i `Team`. Ostatnie wydanie ma oznaczenie alpha i wymaga PHP ≥ 8.4.

### 9.4. Pozostałe

`tonystore/laravel-round-robin`, `estbase/round-robin` i `philicevic/berger`
mają po kilkadziesiąt do półtora tysiąca pobrań i nie miały wydania od roku
lub dłużej. `lucagentile/roundrobin-scheduler` jest porzucony. Ich kodu nie
czytałem.

## 10. Nie sprawdzone

- **Oryginały prac de Werry (1980, 1981)** i *modified canonical schedule*
  (3n − 6 bez dwóch przerw z rzędu). Znam je wyłącznie ze streszczeń.
- **Czy Ekstraklasa nadal gra lustro.** Jedyne twarde dane to sezon 2008/09
  (Goossens i Spieksma). O obecnych sezonach (18 drużyn) nie znalazłem
  źródła pierwotnego.
- **„Tabela polska".** Polska Wikipedia (hasło „System kołowy") opisuje
  wariant tablic Bergera z odwróconymi parami dla drużyny 2k w jej
  pierwszych k − 1 meczach, który ma dawać równy start i finisz. Hasło nie
  podaje źródła. Nie znalazłem tego wariantu w żadnym regulaminie ani
  publikacji i nie liczyłem jego przerw.
- **Jak PZPN i wojewódzkie ZPN faktycznie generują terminarze.** Regulaminy
  odsyłają do Extranetu, a algorytmu nie podają.
- **FIBA.** Sprawdzone regulaminy nie opisują schematu rewanżu. Krajowych lig
  koszykówki (np. PLK) nie sprawdzałem.
- **Atrybucja tablic Schurigowi (1886) i Bergerowi (1893).** Znam ją tylko
  z angielskiej Wikipedii.
- **Zachowanie bibliotek PHP w PHP.** Nic nie było uruchamiane, a liczby
  przerw dla `mnito/round-robin` pochodzą z portu do Pythona.
- **Losowanie numerów w turnieju kołowym wg FIDE** (C.05 i C.06) oraz
  tablice Varmy (C.05 Annex 2). Wiem tylko, że istnieją.

## 11. Bibliografia

- de Werra, D. (1981). *Scheduling in sports*. W: P. Hansen (red.), *Studies
  on Graphs and Discrete Programming*, North-Holland, s. 381–395. Czytane
  przez streszczenia w pracach poniżej.
- Rasmussen, R. V., Trick, M. A. (2008). Round robin scheduling – a survey.
  *European Journal of Operational Research* 188, 617–636. Wersja robocza:
  <https://data.math.au.dk/publications/wp/2006/imf-wp-2006-02.pdf>
- Kendall, G., Knust, S., Ribeiro, C. C., Urrutia, S. (2010). Scheduling in
  sports: An annotated bibliography. *Computers & Operations Research* 37,
  1–19, doi:10.1016/j.cor.2009.05.013. Preprint:
  <http://www2.ic.uff.br/~celso/artigos/Scheduling%20in%20sports%20C&OR.pdf>
- Goossens, D. R., Spieksma, F. C. R. (2012). Soccer schedules in Europe: an
  overview. *Journal of Scheduling* 15(5), 641–651,
  <https://doi.org/10.1007/s10951-011-0238-9>. Wersja autorska:
  <https://biblio.ugent.be/publication/4418957/file/4418977.pdf>
- Lambrechts, E., Ficker, A. M. C., Goossens, D. R., Spieksma, F. C. R.
  (2018). Round-robin tournaments generated by the Circle Method have maximum
  carry-over. *Mathematical Programming* 172, 277–302. Preprint:
  <https://lirias.kuleuven.be/server/api/core/bitstreams/3a15d74a-30bc-4019-b5ee-ee330a06bc01/content>
- Fronček, D., Meszka, M. (2003). Round robin tournaments with one bye and no
  breaks in home–away patterns are unique. W: *Multidisciplinary Scheduling:
  Theory and Applications*, Springer, s. 331–340,
  <https://link.springer.com/chapter/10.1007/0-387-27744-7_16>. Czytane przez
  streszczenie u Kendalla i in.
- Devriesere, K., Csató, L., Goossens, D. (2024). Tournament design: A review
  from an operational research perspective. <https://arxiv.org/abs/2404.05034>
- FIDE Handbook, C.05 Annex 1: Details of Berger Table.
  <https://handbook.fide.com/chapter/C05Annex1>
- FIBA Internal Regulations Book 2 — Competitions (w mocy od 25.04.2024),
  wykaz: <https://about.fiba.basketball/en/our-sport/general-statutes-and-internal-regulations>.
  Czytana kopia:
  <https://kss.rs/wp-content/uploads/2024/12/FIBA-Internal-Regulations-Book-2-Competitions.pdf>
- Basketball Champions League — Competition Regulations 2024-25:
  <https://assets.fiba.basketball/image/upload/basketball-champions-league-208737-competition-regulations.pdf>
- Mazowiecki ZPN, Regulamin rozgrywek piłkarskich 2024/2025:
  <https://www.mzpn.pl/wp-content/uploads/2024/07/Regulamin-24-25.pdf>
- Podkarpacki ZPN, Regulamin rozgrywek 2025/2026:
  <https://podkarpackizpn.pl/wp-content/uploads/2025/08/Regulamin-Rozgrywek-sezon-2025-2026-1.pdf>
- Punkty wyjścia (nie źródła twierdzeń):
  <https://en.wikipedia.org/wiki/Round-robin_tournament> i
  <https://pl.wikipedia.org/wiki/System_ko%C5%82owy>

## Dodatek A. Skrypt do odtworzenia tabeli z §5.4

Python 3, bez zależności. `berger(n)` odtwarza tablice FIDE dla parzystego n.
Mecz to krotka (gospodarz, gość). Przerwy liczone są z pominięciem pauz.

```python
def berger(n):  # n parzyste; mecz = (gospodarz, gość)
    shift = lambda x: x if x == n else (x - 1 + n // 2) % (n - 1) + 1
    rnd = [(1, n)] + [(1 + k, n - k) for k in range(1, n // 2)]
    out = [rnd]
    for _ in range(n - 2):
        rnd = [((n, shift(h)) if a == n else (shift(a), n)) if n in (h, a)
               else (shift(h), shift(a)) for h, a in rnd]
        out.append(rnd)
    return out

flip = lambda s: [[(a, h) for h, a in r] for r in s]
mirror = lambda s: s + flip(s)
french = lambda s: s + [flip(s)[0]] + flip(s)[1:]
english = lambda s: s + [flip(s)[-1]] + flip(s)[:-1]
inverted = lambda s: s + flip(s)[::-1]
fide_swap = lambda s: mirror(s[:-2] + [s[-1], s[-2]])

def breaks(schedule, teams, ghost=None):
    total = longest = 0
    for t in teams:
        seq = [("H" if h == t else "A") for r in schedule for h, a in r
               if t in (h, a) and ghost not in (h, a)]  # pauza pominięta
        total += sum(seq[i] == seq[i - 1] for i in range(1, len(seq)))
        run = 1
        for i in range(1, len(seq)):
            run = run + 1 if seq[i] == seq[i - 1] else 1
            longest = max(longest, run)
    return total, longest

for n in range(4, 21, 2):
    s, T = berger(n), range(1, n + 1)
    row = [breaks(f(s), T) for f in (lambda x: x, mirror, fide_swap, french, english, inverted)]
    print(n, row)
for n in range(3, 20, 2):  # nieparzyste: widmo n + 1
    s, T = berger(n + 1), range(1, n + 1)
    print(n, breaks(s, T, ghost=n + 1), breaks(mirror(s), T, ghost=n + 1))
```
