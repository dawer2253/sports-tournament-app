# Drabinka pucharowa na telefonie

Badanie na potrzeby ticketu
[#214 „S4: research — drabinka na telefonie"](https://github.com/dawer2253/sports-tournament-app/issues/214)
(mapa [#211](https://github.com/dawer2253/sports-tournament-app/issues/211)).
Precedensy dla prototypu
[#218](https://github.com/dawer2253/sports-tournament-app/issues/218)
(drabinka na stronie publicznej). Data: 12 października 2026.

**Ten plik ustala fakty, nie wybiera wariantu.** Opisuje, jak serwisy
sportowe, platformy turniejowe i dwie otwarte biblioteki pokazują drabinkę
pucharową na wąskim ekranie, jak oznaczają stany meczu i co mówią źródła
o dostępności. Który układ przyjąć, rozstrzyga prototyp. Terminy domenowe
według [`CONTEXT.md`](../../CONTEXT.md): drabinka (Bracket), mecz (Match),
pauza / wolny los (Bye), runda (Round).

Kontekst z repo, do którego odnoszą się fakty niżej:

- Makieta `public-bracket` rysuje rundy kolumnami w kontenerze przewijanym
  w poziomie i ma trzy otwarte pytania (łączniki, dwumecz, karne):
  `grep -n "overflow-x-auto\|Otwarte pytania" packages/ui/src/screens/public-bracket.mdx`.
- Drabinka 16 drużyn to 15 meczów:
  `grep -n "piętnaście meczów" packages/api-contract/openapi.yaml`.

## 0. Źródła i metoda

| Źródło | Jak czytane |
|---|---|
| SofaScore (sofascore.com) | strona w przeglądarce, emulacja 375×812 |
| UEFA.com („Bracket view" Ligi Mistrzów) | strona w przeglądarce, emulacja 375×812 |
| ESPN (drabinka MŚ 2026) | strona w przeglądarce, emulacja 375×812 |
| Challonge (publiczna drabinka) | strona w przeglądarce, emulacja 375×812 |
| start.gg (Evo 2024, pula rundy 1) | strona w przeglądarce, emulacja 375×812 |
| [brackets-viewer.js](https://github.com/Drarig29/brackets-viewer.js) 1.9.1 | kod źródłowy, commit [`0269274`](https://github.com/Drarig29/brackets-viewer.js/tree/026927453a96b35ce204bf275e028ba025c2d737) |
| [@g-loot/react-tournament-brackets](https://github.com/g-loot/react-tournament-brackets) 1.0.0 | kod źródłowy i README, commit [`608ddd7`](https://github.com/g-loot/react-tournament-brackets/tree/608ddd75d974b053594c3943c889ae3abc188228) |
| W3C, [Understanding SC 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | dokument normatywny i objaśnienie |
| Lista WebAIM ([2007](https://webaim.org/discussion/mail_message?id=10325), [2023](https://webaim.org/discussion/mail_message?id=48691)) | wątki praktyków, źródło drugorzędne, oznaczone |

Ograniczenia:

- **Strony oglądane w panelu przeglądarki Claude z emulacją rozmiaru
  telefonu (375×812), sterowane myszą, nie dotykiem.** Gestów przesunięcia
  palcem nie dało się sprawdzić tam, gdzie strona nie reaguje na
  przeciągnięcie myszą (SofaScore). Struktura (kontenery przewijane,
  `transform`, role ARIA) odczytana skryptem z DOM-u.
- Oglądane były wersje webowe. Aplikacje natywne (SofaScore, FlashScore,
  UEFA, start.gg) nie były otwierane.
- **FlashScore** zwrócił stronę błędu („The requested page can't be
  displayed") dla dwóch adresów zakładki „Draw", **Toornament** nie dał się
  znaleźć jako publiczny przykład drabinki. Obu nie opisuję (patrz §8).
- Zrzuty nie są dołączone. Opisy niżej to odczyt, nie kopia.

## 1. Streszczenie

- **Na telefonie widać cztery układy.** (a) Pełna drabinka desktopowa
  w kontenerze przewijanym w poziomie, bez zmian dla telefonu: Challonge,
  start.gg, brackets-viewer.js. (b) Przełącznik rund (pigułki u góry) plus
  przesunięcie płótna tak, że wybrana runda jest jedną kolumną na prawie
  całą szerokość, a następna runda wystaje przy prawej krawędzi: SofaScore,
  ESPN. (c) Karuzela kolumn przesuwana gestem, po około dwie rundy na
  ekranie: UEFA. (d) Drzewo pionowe „z góry na dół" z kodami
  trzyliterowymi zamiast nazw: SofaScore w trybie „Compact view" dla
  MŚ 2026. Czystej listy meczów zamiast drzewa nie ma na żadnej oglądanej
  stronie drabinki; UEFA ma listę jako osobną zakładkę „Fixtures &
  results", a archiwum sezonu pokazuje mecze listą po rundach.
- **Łączniki są wszędzie.** Kąty proste (wąsy „]" od pary meczów do meczu
  następnej rundy) na każdej oglądanej stronie i w obu bibliotekach.
  Podświetlanie ścieżki drużyny istnieje tylko jako efekt najechania myszą
  (obie biblioteki), więc na dotyku nie działa z definicji. Na stronach
  sportowych go nie zaobserwowano.
- **Nieznany rywal:** „TBD" (UEFA, react-tournament-brackets), „KO play-off
  winner" (UEFA), puste pola (Challonge), „Seed N" albo „Loser of …"
  (brackets-viewer.js). UEFA pokazuje też możliwych rywali z losowania
  w formie „5 COM or 6 SPO".
- **Wolny los:** brackets-viewer.js pisze „BYE"; start.gg nie rysuje meczu
  z pauzą, drużyna pojawia się od razu w rundzie 2.
- **Mecz o 3. miejsce:** obok albo pod finałem, z podpisem „3rd place"
  (SofaScore), we wspólnej zakładce „3rd-Place Match & Final" (ESPN), jako
  „Consolation Final" po finale (brackets-viewer.js).
- **Karne:** wynik meczu i w nawiasie karne, „1 (4)" przy „1 (3)"
  (SofaScore, ESPN), w trybie kompaktowym „0(4) : 0(3)". ESPN dokłada
  status „FT-Pens", a dogrywkę oznacza „AET".
- **Zwycięzca i przegrany:** przegrany jest wyszarzony (SofaScore: ta sama
  grubość czcionki, kolor 50% bieli; ESPN: szary, zwycięzca z trójkątem
  przy wyniku). Pogrubienie zwycięzcy: start.gg, brackets-viewer.js.
  start.gg dokłada zielone tło wyniku zwycięzcy.
- **Dostępność:** żadna oglądana strona ani biblioteka nie ma w drabince
  atrybutów ARIA poza przełącznikiem rund SofaScore (`role="tab"`,
  `aria-selected`). Kafelek meczu SofaScore to `div role="button"` bez
  `tabindex`. WCAG 1.4.10 wprost wyjmuje spod wymogu przelewania treść,
  która potrzebuje układu dwuwymiarowego (wymienia diagramy i tabele), ale
  tylko tę część, nie otaczającą stronę.

## 2. Układy na wąskim ekranie

### 2.1. Pełna drabinka przewijana w poziomie

- **Challonge.** Publiczna drabinka 8 drużyn jest na telefonie tym samym
  rysunkiem SVG co na komputerze (`svg.bracket-svg` o szerokości 1009 px)
  w kontenerze `div.tournament-bracket--scrollable` z `overflow-x: auto`
  na ekranie 375 px. Przy meczu numer meczu po lewej, przy drużynie numer
  rozstawienia. Mecze następnej rundy bez drużyn to puste szare prostokąty.
  Nad drabinką przycisk „LIVE".
- **start.gg.** Pula drabinki (Evo 2024) w kontenerze z `overflow-x: auto`
  (szerokość treści 1240 px na 375 px). Kolumny z nagłówkami „Winners
  Round 1", „Winners Round 2". Na ekranie mieści się półtorej kolumny.
- **brackets-viewer.js.** Korzeń `.brackets-viewer` ma `overflow: auto`
  ([`style.scss`, l. 52](https://github.com/Drarig29/brackets-viewer.js/blob/026927453a96b35ce204bf275e028ba025c2d737/src/style.scss#L52)).
  W `src/` nie ma ani jednego `@media`
  (`grep -rn "@media" src/` nic nie zwraca), więc układ nie zmienia się
  z szerokością ekranu.
- **react-tournament-brackets.** Drabinka to SVG o wymiarach liczonych
  ze stałych: kafelek 300×110, odstęp kolumn 50
  ([`settings.ts`](https://github.com/g-loot/react-tournament-brackets/blob/608ddd75d974b053594c3943c889ae3abc188228/src/settings.ts)).
  README proponuje opakowanie `SVGViewer` z react-svg-pan-zoom
  (przesuwanie i powiększanie w oknie o stałym rozmiarze); dopasowanie
  okna do ekranu zostawia aplikacji („useWindowSize or your own solution").

### 2.2. Przełącznik rund i płótno przesuwane do wybranej rundy

- **SofaScore, Liga Mistrzów 25/26, zakładka „Knockout".** Pod zakładką
  rząd pigułek „Playoff round", „1/8", „1/4", „1/2", „Final". Wybór
  pigułki przesuwa płótno (`transform: translateX(…)` z przejściem
  `transition`, kontener `overflow: hidden`) tak, że wybrana runda jest
  jedną kolumną kafelków szerokości 240 px. Po lewej widać końcówki
  łączników z poprzedniej rundy, po prawej wystaje kafelek meczu następnej
  rundy z uciętą nazwą. W DOM-ie siedzi całe drzewo, wszystkie rundy naraz.
  Pigułki mają `role="tab"` i `aria-selected`. Przeciągnięcie myszą nie
  przesuwa płótna (zaznacza tekst); czy działa gest palcem, nie sprawdzone.
  Na końcu drabinki ikona pucharu obok finału.
- **SofaScore, MŚ 2026, przełącznik „Compact view" wyłączony.** Ten sam
  układ z pigułkami „1/16" … „Final". W kolumnie finału pod meczem
  finałowym jest mecz o 3. miejsce z plakietką „3rd place"; finał ma
  plakietkę „Final".
- **ESPN, drabinka MŚ 2026.** Rząd przycisków „Round of 32", „Round of 16",
  „Quarterfinals", „Semifinals", „3rd-Place Match & Final"; domyślnie
  otwarta ostatnia. Wybrana runda zajmuje prawie całą szerokość (kafelek
  z nazwą drużyny, flagą i wynikiem), następna runda wystaje przy prawej
  krawędzi. Kontener płótna ma `overflow: hidden` przy szerokości treści
  1204 px. Każdy kafelek ma w nagłówku status po lewej („FT", „AET",
  „FT-Pens") i numer meczu po prawej („Match 89").

### 2.3. Karuzela kolumn

- **UEFA.com, Liga Mistrzów 26/27, „Bracket view".** Przełącznik „Fixtures
  & results" / „Bracket view" u góry. Kolumny rund są slajdami biblioteki
  Swiper (`swiper-horizontal`, `touch-action: pan-y` na kontenerze, slajd
  192 px). Na 375 px widać jedną pełną i większość drugiej kolumny.
  Przeciągnięcie przesuwa o jedną rundę; kolumna, która staje się pierwszą,
  zachowuje rozstawienie w pionie z pełnego drzewa (puste odstępy między
  meczami zostają). Nagłówek kolumny to nazwa rundy (`h3`, np. „KO
  play-offs", „Round of 16") i daty (`h4`). Drużyny jako kod trzyliterowy
  z herbem i numerem rozstawienia. Z boku pionowy napis ścieżki („SILVER
  PATH"). Nad drabinką notka, że informacje są tymczasowe i aktualizują się
  na żywo.

### 2.4. Drzewo pionowe

- **SofaScore, MŚ 2026, „Compact view" włączony (domyślnie).** Drzewo
  biegnie z góry na dół: na górze cztery mecze pierwszej widocznej rundy
  w rzędzie, niżej dwa, niżej jeden, pośrodku finał z ikoną pucharu i obok
  mecz o 3. miejsce, potem druga połowa drabinki odwrócona (łączniki idą
  w górę). Kafelek ma dwie flagi, dwa kody trzyliterowe (np. „FRA", „ESP")
  i wynik „0 : 2". Nazw drużyn w tym trybie nie ma.
- Przełącznik „Compact view" był widoczny dla MŚ 2026, a dla Ligi Mistrzów
  25/26 nie; od czego to zależy, nie sprawdzone.

### 2.5. Lista meczów

- Żadna oglądana drabinka nie zamienia się na telefonie w listę. Lista
  istnieje obok jako osobny widok: UEFA „Fixtures & results" i archiwum
  sezonu (`/history/seasons/2026/matches/`, mecze pogrupowane w nagłówki
  „Quarter-finals - 1st leg" itd.), SofaScore zakładka „Matches", ESPN
  „Schedule" w menu sekcji piłkarskiej.
- Na liście WebAIM (2023, wpis praktyka, nie źródło normatywne) autor
  planujący dostępną drabinkę NCAA proponuje przejście do jednej kolumny
  poniżej ok. 500 px i wszystkich rund w jednej kolumnie poniżej 320 px
  ([wątek](https://webaim.org/discussion/mail_message?id=48691)).

## 3. Łączniki między rundami

- **Kształt.** Wszędzie kąty proste: od każdego meczu pary krótka pozioma
  linia, pionowa łącząca parę i pozioma do meczu następnej rundy.
  SofaScore, ESPN, UEFA, Challonge, start.gg; w trybie pionowym SofaScore
  ten sam kształt obrócony.
- **Implementacja w bibliotekach.** brackets-viewer.js rysuje łączniki
  pseudo-elementami CSS `::before` / `::after` z obramowaniem
  (`--connector-color`, `--connector-border-width: 2px`,
  [`style.scss`, l. 185–210](https://github.com/Drarig29/brackets-viewer.js/blob/026927453a96b35ce204bf275e028ba025c2d737/src/style.scss#L185-L210));
  README podaje jako inspirację przykład „connection between matches in
  plain CSS". react-tournament-brackets rysuje je ścieżkami SVG
  (`components/connector.tsx`). Challonge: ścieżki `path` w SVG
  (`g.bracket-line-container`).
- **Podświetlanie ścieżki drużyny.**
  brackets-viewer.js: opcja `highlightParticipantOnHover` (domyślnie
  `true`) dodaje klasę `hover` wszystkim wystąpieniom drużyny w drabince
  przy `mouseover`
  ([`main.ts`, l. 823–832](https://github.com/Drarig29/brackets-viewer.js/blob/026927453a96b35ce204bf275e028ba025c2d737/src/main.ts#L823-L832)).
  react-tournament-brackets: najechana drużyna (`hoveredPartyId`)
  podświetla łącznik, jeśli drużyna gra w obu łączonych meczach
  (`hooks/use-match-highlight`), kolor `connectorColorHighlight`.
  Oba mechanizmy reagują na mysz, nie na dotyk. Na SofaScore, ESPN, UEFA,
  Challonge i start.gg podświetlenia ścieżki nie zaobserwowano (oglądane
  bez najeżdżania).

## 4. Wolny los, mecz o 3. miejsce, nieznany rywal

### 4.1. Wolny los

- **brackets-viewer.js:** zamiast nazwy tekst „BYE" i klasa `bye`
  ([`dom.ts`, l. 275](https://github.com/Drarig29/brackets-viewer.js/blob/026927453a96b35ce204bf275e028ba025c2d737/src/dom.ts#L275)),
  w tłumaczeniu angielskim `common.bye: "BYE"`.
- **start.gg:** w puli Evo 2024 część miejsc w rundzie 1 jest pusta, a
  drużyny z pauzą stoją od razu w meczach rundy 2 (np. mecz „G" ma obu
  graczy bez meczu w rundzie 1). Słowo „bye" na stronie nie pada.
- **react-tournament-brackets:** stan `NO_PARTY` (brak uczestnika) nie
  wypisuje żadnego tekstu w miejscu nazwy ani wyniku
  ([`match-wrapper.tsx`](https://github.com/g-loot/react-tournament-brackets/blob/608ddd75d974b053594c3943c889ae3abc188228/src/core/match-wrapper.tsx)).
- SofaScore, ESPN, UEFA: w oglądanych turniejach nie było wolnych losów,
  więc nie sprawdzone.

### 4.2. Mecz o 3. miejsce

- **SofaScore:** w kolumnie finału, pod finałem (widok kolumn) albo obok
  finału (widok kompaktowy), z plakietką „3rd place".
- **ESPN:** wspólna zakładka „3rd-Place Match & Final".
- **brackets-viewer.js:** osobny blok po finale, etykieta meczu
  „Consolation Final", rywale z podpowiedzią „Loser of Semi 1/2"
  (`origin-hint.consolation-final` w `i18n/en/translation.json`).

### 4.3. Nieznany jeszcze rywal

- **UEFA:** w 1/8 „KO play-off winner" w miejscu drużyny, w ćwierćfinale
  „TBD". Gdzie para zależy od losowania, dwie drużyny w jednym wierszu:
  „5 COM or 6 SPO", z dopiskiem nad drabinką, że drużyny rozdzielone „or"
  potwierdzi losowanie.
- **react-tournament-brackets:** domyślny tekst „TBD", gdy mecz nie ma
  stanu rozstrzygniętego (`teamNameFallback … ?? 'TBD'`, ten sam plik).
- **brackets-viewer.js:** podpowiedzi pochodzenia tylko dla pierwszej
  rundy („Seed N") i drabinki przegranych („Loser of WB 2.1"); dla
  zwycięzcy wcześniejszego meczu w drabince pojedynczej podpowiedzi nie
  ma (`getOriginHint` w
  [`lang.ts`, l. 77–105](https://github.com/Drarig29/brackets-viewer.js/blob/026927453a96b35ce204bf275e028ba025c2d737/src/lang.ts#L77-L105)).
  Po zakończeniu meczu podpowiedź jest usuwana (`main.ts`, l. 606–607).
- **Challonge:** mecze bez drużyn to puste prostokąty, bez tekstu.
- **start.gg:** każdy mecz ma literę („A", „B", … „M") w znaczniku przy
  lewej krawędzi; wpisu typu „Winner of A" nie zaobserwowano.

### 4.4. Rozstrzygnięcie po karnych i dwumecz

- **SofaScore:** wynik meczu z karnymi w nawiasie przy każdej drużynie,
  „1 (4)" i „1 (3)" (widok kolumn), „0(4) : 0(3)" (widok kompaktowy).
  Dwumecz Ligi Mistrzów w kafelku drabinki: jedna liczba na drużynę
  (suma z dwóch meczów, np. 4 i 0), bez rozbicia na mecze.
- **ESPN:** te same nawiasy „1 (3)" / „1 (4)", status meczu „FT-Pens";
  mecz po dogrywce „AET".
- **brackets-viewer.js, react-tournament-brackets:** osobnego pola na
  karne nie ma; react-tournament-brackets ma dowolny tekst `resultText`.
- UEFA: w oglądanej drabince sezonu 26/27 nie było jeszcze wyników,
  więc zapis karnych i dwumeczu nie sprawdzony.

## 5. Zwycięzca, przegrany, mecz na żywo

### 5.1. Zwycięzca i przegrany

- **SofaScore:** przegrany kolorem `rgba(255, 255, 255, 0.5)`, zwycięzca
  `rgb(236, 237, 239)`, obaj `font-weight: 400` (odczyt stylów 40 nazw
  w drabince LM 25/26). Wyróżnienie tylko kolorem.
- **ESPN:** przegrany szary, zwycięzca czarny i z trójkątem („◀") przy
  wyniku.
- **start.gg:** zwycięzca pogrubiony, jego wynik na zielonym tle, wynik
  przegranego na szarym; dyskwalifikacja oznaczona „DQ" przy przegranym
  i zielonym znacznikiem (ptaszek) przy zwycięzcy zamiast wyniku.
- **brackets-viewer.js:** zwycięzca pogrubiony (`.win .name { font-weight:
  bold }`), wynik zwycięzcy kolorem `--win-color`, przegranego
  `--loss-color`; walkower „F", bez wyniku „W" / „L"
  ([`dom.ts`, l. 288–313](https://github.com/Drarig29/brackets-viewer.js/blob/026927453a96b35ce204bf275e028ba025c2d737/src/dom.ts#L288-L313)).
- **react-tournament-brackets:** pole `isWinner` i kolory motywu
  `highlightedWonColor` / `highlightedLostColor`; walkower „WO", niestawienie
  „NS" (`wonBywalkOverText`, `lostByNoShowText` w `settings.ts`).

### 5.2. Mecz na żywo

- **ESPN:** status meczu w nagłówku kafelka („FT", „AET", „FT-Pens");
  jak wygląda status meczu trwającego, nie sprawdzone (brak meczu w toku).
- **Challonge:** przycisk „LIVE" nad drabinką (odświeżanie widoku); jak
  oznacza pojedynczy mecz w toku, nie sprawdzone.
- **UEFA:** notka nad drabinką, że informacje aktualizują się na żywo.
- **brackets-viewer.js:** status meczu („Running", „Completed" itd.) tylko
  jako `title` etykiety meczu i atrybut `data-match-status`
  ([`dom.ts`, l. 133 i 146–149](https://github.com/Drarig29/brackets-viewer.js/blob/026927453a96b35ce204bf275e028ba025c2d737/src/dom.ts#L133)),
  bez osobnego stylu w `style.scss`.
- **react-tournament-brackets:** stanu „w toku" nie ma; stany to
  `NO_SHOW`, `WALK_OVER`, `NO_PARTY`, `DONE`, `SCORE_DONE`
  (`core/match-states.ts`).
- SofaScore: żaden mecz drabinki nie trwał w czasie oglądania, nie
  sprawdzone.

## 6. Klawiatura i czytnik ekranu

- **SofaScore:** pigułki rund mają `role="tab"` i `aria-selected`. Kafelek
  meczu to `div role="button"` bez `tabindex` i bez `aria-label`, więc
  nie dostaje fokusu z klawiatury (wniosek z atrybutów, nie z testu
  klawiaturą).
- **UEFA:** nazwy rund jako nagłówki `h3`, daty jako `h4`; drużyny to
  linki bez `aria-label` z tekstem kodu trzyliterowego („VIL").
- **Challonge:** w kontenerze drabinki ani jednego elementu z
  `aria-label`, `role` albo `tabindex`; nazwy drużyn to `text` w SVG.
- **brackets-viewer.js:** `grep -rn "aria-\|role\|tabindex" src/` nie
  zwraca nic. Struktura jest semantyczna: grupa to `section` z `h2`,
  runda to `article` z `h3` (`createGroupContainer`,
  `createRoundContainer` w `dom.ts`, l. 81–115).
- **react-tournament-brackets:** `grep -rn "aria-\|tabIndex\|role=" src/`
  nie zwraca nic; README nie wspomina o dostępności.
- **WCAG 2.2, SC 1.4.10 Reflow (AA)**
  ([Understanding](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)):
  treść ma się mieścić bez przewijania w dwóch wymiarach przy szerokości
  320 px CSS, „except for parts of the content which require
  two-dimensional layout for usage or meaning". Przykłady takich części
  to m.in. mapy i diagramy oraz tabele danych. Wyjątek obejmuje samą tę
  część; nagłówki i elementy wokół mają się przelewać. Dokument zaleca
  ograniczyć przewijanie w dwóch wymiarach do kontenera tej części, a nie
  całej strony. Czy drabinka to „diagram" w rozumieniu WCAG, dokument nie
  mówi; autor wątku WebAIM z 2023 r. powołuje się na ten wyjątek dla
  drabinki.
- **Znany precedens dostępnej drabinki:** Terry Thompson (DO-IT,
  University of Washington) ogłosił w 2007 r. drabinkę NCAA „standards-based"
  z funkcjami „that support navigation by screen reader users"
  ([WebAIM, 2007](https://webaim.org/discussion/mail_message?id=10325)).
  Opisy wtórne mówią o nagłówkach dla regionów i rund i listach dla
  meczów, ale pierwotna strona (`staff.washington.edu/tft/ncaa/`) nie była
  czytana, więc strukturę oznaczam jako niesprawdzoną.

## 7. Zestawienie

| | Układ na 375 px | Łączniki | Nieznany rywal | Karne | Przegrany |
|---|---|---|---|---|---|
| SofaScore | pigułki rund + płótno; albo drzewo pionowe „Compact view" | tak | nie sprawdzone | „1 (4)" | kolor 50% |
| ESPN | przyciski rund + płótno | tak | nie sprawdzone | „1 (4)", „FT-Pens" | szary, trójkąt przy zwycięzcy |
| UEFA | karuzela kolumn (Swiper) | tak | „TBD", „KO play-off winner", „A or B" | nie sprawdzone | nie sprawdzone |
| Challonge | pełne SVG, przewijanie w poziomie | tak | puste pola | nie sprawdzone | nie sprawdzone |
| start.gg | pełna drabinka, przewijanie w poziomie | tak | litera meczu | nie dotyczy | zwycięzca pogrubiony, zielony wynik |
| brackets-viewer.js | pełna drabinka, `overflow: auto` | tak, CSS | „Seed N", „Loser of …" | brak pola | zwycięzca pogrubiony |
| react-tournament-brackets | SVG + opcjonalny pan/zoom | tak, SVG | „TBD" | `resultText` | kolory motywu |

## 8. Nie sprawdzone

- **FlashScore** (strona błędu dla zakładki „Draw"), **Toornament** (brak
  publicznego przykładu drabinki w zasięgu wyszukiwania). Ticket wymienia
  oba; o ich układzie na telefonie nie twierdzę nic.
- Gest przesunięcia palcem na SofaScore i ESPN (emulacja myszy).
  Na UEFA przeciąganie myszą działało.
- Aplikacje natywne wszystkich serwisów.
- Oznaczenie meczu `live` w drabince na SofaScore, ESPN, UEFA i Challonge
  (żaden mecz nie trwał).
- Wolny los na stronach sportowych (w oglądanych turniejach nie było).
- Zapis karnych i dwumeczu na UEFA (drabinka sezonu bez wyników).
- Zachowanie z czytnikiem ekranu i nawigacja klawiaturą w praktyce;
  §6 to odczyt atrybutów, nie test.
- Struktura drabinki Terry'ego Thompsona u źródła.
