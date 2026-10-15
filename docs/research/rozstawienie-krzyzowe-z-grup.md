# Rozstawienie krzyżowe z grup do drabinki

Badanie na potrzeby ticketu
[#247 „S5: research — rozstawienie krzyżowe z grup do drabinki"](https://github.com/dawer2253/sports-tournament-app/issues/247)
(mapa [#246](https://github.com/dawer2253/sports-tournament-app/issues/246)).
Fakty do grillingu „S5: kwalifikacja i drabinka playoffu"
([#250](https://github.com/dawer2253/sports-tournament-app/issues/250)).
Data: 15 października 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Opisuje, jak regulaminy
federacji, biblioteki i aplikacje turniejowe przechodzą z fazy grupowej do
drabinki: kto awansuje, jak powstają pary krzyżowe, co dzieje się przy
nieparzystej liczbie grup, nierównych grupach i remisie na linii awansu, kiedy
powstaje drabinka i jak organizator ją poprawia. Nie wskazuje wariantu dla nas.

Czego tu nie ma, bo jest gdzie indziej:

- Standardowa kolejność rozstawienia (1–16, 8–9…), wolne losy dla najwyżej
  rozstawionych i ręczna korekta w samej drabince bez grup:
  [`rozstawienie-i-wolne-losy.md`](rozstawienie-i-wolne-losy.md). Tutaj tylko
  korzystam z tej reguły.
- Zapis krawędzi drabinki w danych:
  [`drabinka-modele-danych.md`](drabinka-modele-danych.md).
- Najlepsze trzecie miejsca z różnych grup są poza zakresem mapy. Tam, gdzie
  regulamin je ma (EURO), opisuję tylko pary bez nich.

Stan repo, od którego wychodzi ticket (polecenia do sprawdzenia):

- Decyzja #23: krzyżowe rozstawienie automatycznie, ręczna korekta par przed
  startem fazy (`grep -n "^| 23" docs/PLAN.md`).
- `BracketGenerator` stawia drużyny z listy `teamIds` na pozycjach ze
  standardowej reguły (`grep -n "seedPositions" backend/app/Schedule/BracketGenerator.php`)
  i **dziś wymaga, by lista zawierała każdą drużynę turnieju dokładnie raz**
  (`grep -n "TEAM_IDS_MESSAGE\|isEveryTeamOnce" backend/app/Schedule/BracketGenerator.php`).
  Lista samych awansujących z grup tej walidacji nie przejdzie.
- Miejsce w tabeli jest zawsze unikalne, bo po wszystkich kryteriach rozstrzyga
  ukryte kryterium nazwy drużyny (`grep -n "nazwa drużyny" CONTEXT.md`).

Terminy według [`CONTEXT.md`](../../CONTEXT.md): faza (`group`, `knockout`),
grupa, drabinka, pauza (wolny los), rozstawienie. „1A" to zwycięzca grupy A,
„2B" drugie miejsce w grupie B. „Slot" to miejsce w pierwszej rundzie
drabinki. „Zaślepka" to slot, którego drużyna nie jest jeszcze znana, opisany
źródłem („zwycięzca grupy A").

## 0. Źródła i metoda

| Źródło | Co z niego wzięte |
|---|---|
| UEFA, [UEFA Documents](https://documents.uefa.com/) | regulaminy w bieżących wydaniach: EURO 2026–28 (w mocy od 29.07.2026), U21 2025–27 (29.07.2026), U19 2026/27 (29.07.2026), Women's EURO 2023–25 (2.12.2023), Futsal EURO 2024–26 (1.10.2023); artykuły o fazie pucharowej i równej liczbie punktów |
| UEFA, [procedura losowania 1/8 finału Ligi Mistrzów 2023/24](https://editorial.uefa.com/resources/0288-19b8cc79213b-f435550d4d65-1000/2023-24_ucl_r16_draw_procedure.pdf) | zasady losowania par po fazie grupowej (ostatni sezon z grupami) |
| FIFA, [Regulations FIFA World Cup Qatar 2022](https://digitalhub.fifa.com/m/2744a0a5e3ded185/original/FIFA-World-Cup-Qatar-2022-Regulations_EN.pdf) | art. 11 (pary 1/8, ćwierćfinały, półfinały), art. 12 (remis w grupie) |
| [brackets-manager.js](https://github.com/Drarig29/brackets-manager.js) @ [`02027cf`](https://github.com/Drarig29/brackets-manager.js/tree/02027cff5d687068719bebbc765072f382e81390), [brackets-model](https://github.com/Drarig29/brackets-model) @ [`59aedea`](https://github.com/Drarig29/brackets-model/tree/59aedea4c034a6eae5b88bd14f784b263164e808), [brackets-docs](https://drarig29.github.io/brackets-docs/) | kod `get.finalStandings()`, porządki grupowe, typ slotu; FAQ o turniejach dwuetapowych; [issue #206](https://github.com/Drarig29/brackets-manager.js/issues/206) |
| Challonge | [kb.challonge.com](https://kb.challonge.com/en/), API v2.1 na [challonge.apidog.io](https://challonge.apidog.io/llms.txt) |
| Toornament | [help.toornament.com](https://help.toornament.com/) |
| start.gg | [help.start.gg](https://help.start.gg/en/), schemat GraphQL ([smashgg-schema.netlify.app](https://smashgg-schema.netlify.app/reference/seed.doc), na który przekierowuje `developer.start.gg`) |
| Tournify | [help.tournifyapp.com](https://help.tournifyapp.com/en/) |
| LeagueRepublic | [help.leaguerepublic.com](https://help.leaguerepublic.com/en/) |

Ograniczenia:

- **Strony UEFA Documents to aplikacja JS.** Treść artykułów czytałam przez
  jej publiczne API (`/api/khub/maps/{id}/topics/{id}/content`) w przeglądarce.
  Linki w tekście prowadzą do czytnika, który pokazuje to samo po
  załadowaniu. Wydanie regulaminu EURO 2022–24 (EURO 2024), wskazane w wynikach
  wyszukiwania, zwraca dziś 404; czytałam wydanie 2026–28 (EURO 2028).
- **Ligi Mistrzów do 2024 nie czytałam z regulaminu**, tylko z dokumentu
  procedury losowania 1/8 finału z 18.12.2023, który powołuje się na
  paragrafy 13.07 i 18.01 regulaminu 2023/24. PDF-y UEFA i FIFA czytałam po
  wyciągnięciu tekstu własnym skryptem (rozpakowanie strumieni), więc
  układ tabel odtworzyłam z kolejności napisów.
- **W aplikacjach nic nie było klikane.** Zdania o Challonge, Toornament,
  start.gg, Tournify i LeagueRepublic to odczyt dokumentacji, pobranej przez
  narzędzie streszczające; krótkie cytaty są bliskie oryginałowi, ale nie
  zawsze znak w znak. Cytaty z kodu i regulaminów są dokładne.
- **Tabele w §3 to odtworzenie, nie obserwacja.** Skrypt w
  [Dodatku](#dodatek-odtworzenie-list-rozstawienia) bierze tę samą regułę
  pozycji co `BracketGenerator::seedPositions` i `inner_outer`
  z brackets-manager i sprawdza, co daje dana lista rozstawienia.

## 1. Streszczenie

- **Regulaminy federacji zapisują drabinkę jako stałe sloty, nie jako
  algorytm.** FIFA (MŚ 2022) i UEFA (EURO, U21, U19, Women's EURO, Futsal
  EURO) wypisują pary pierwszej rundy pucharowej („Winner A v. Runner-up B")
  i to, które mecze spotykają się dalej. Wyjątkiem była Liga Mistrzów do
  2024: pary 1/8 **losowano** (zwycięzca grupy z drugim z innej grupy i innej
  federacji).
- **Przy 2 grupach i 2 awansujących wszyscy robią to samo:** 1A–2B, 1B–2A
  (U19). Przy 1 awansującym z 2 grup jest od razu finał 1A–1B (Regions' Cup).
- **Przy 4 grupach i 2 awansujących są co najmniej trzy różne układy w samej
  UEFA.** Women's EURO: 1A–2B, 1B–2A, 1C–2D, 1D–2C; Futsal EURO te same pary
  w innym rozkładzie na połówki; U21: 1A–2C, 1C–2A, 1B–2D, 1D–2B. W Women's
  EURO i Futsal EURO drużyny z jednej grupy trafiają na przeciwne połówki
  (spotkają się najwcześniej w finale), w U21 — na tę samą połówkę (mogą się
  spotkać w półfinale).
- **Przy 8 grupach i 2 awansujących (MŚ 2022)** pary to 1A–2B, 1B–2A, 1C–2D…
  i każda para grup jest rozdzielona na przeciwne połówki.
- **Każdy taki układ da się podać jako listę rozstawienia do standardowej
  kolejności**, bo reguła pozycji jest wzajemnie jednoznaczna (każdy slot ma
  dokładnie jeden numer). Pytanie brzmi więc, czy lista ma **prostą regułę**.
  Odtworzenie (§3): „wszyscy zwycięzcy alfabetycznie, potem wszyscy drudzy
  alfabetycznie" nigdy nie stawia pary z jednej grupy w 1. rundzie przy 2, 4
  i 8 grupach, ale przy 4 i 8 grupach zostawia drużyny z jednej grupy w tej
  samej połówce. Lista z przesunięciem drugich miejsc o połowę liczby grup
  odtwarza Futsal EURO przy 4 grupach, ale przy 8 nie rozdziela połówek.
  Lista odpowiadająca MŚ 2022 istnieje, tylko nie ma prostego opisu.
- **3 grupy po 2 awansujących (6 drużyn, drabinka 8)** — żadne źródło nie
  podaje tego układu. Odtworzenie: z listą „zwycięzcy, potem drudzy
  alfabetycznie" wolne losy dostają 1A i 1B, a w 1. rundzie gra 1C–2C (ta sama
  grupa). Odwrócenie kolejności drugich miejsc usuwa to i rozdziela każdą
  grupę na połówki.
- **Nierówne grupy:** aplikacje niczego nie korygują przy awansie z miejsca
  w grupie (Challonge mówi wprost: większa grupa gra więcej meczów, a awans
  idzie z obu). Korekta pojawia się dopiero przy **porównaniu drużyn między
  grupami**: UEFA U21 odrzuca wyniki z szóstą drużyną w grupach 5- i
  6-zespołowych, Tournify ma kryterium średniej punktów na mecz.
- **Remis na linii awansu:** FIFA kończy listę kryteriów losowaniem
  („drawing of lots by FIFA"), UEFA — pozycją w rankingu współczynników, plus
  rzuty karne, gdy dwie równe drużyny grały ze sobą w ostatniej kolejce.
  Aplikacje kończą kryterium ręcznym (Challonge, Toornament) albo losowym
  (Toornament); Tournify i brackets-manager nie opisują ostatniego kroku.
- **Zaślepki:** start.gg ma w modelu obiekt `Progression` — „A connection
  between a placement in an origin phase group to a destination seed" — z polami
  grupy źródłowej i miejsca. Tournify buduje linki w formacie przed startem,
  a drużyny wstawia przy „Start" fazy. brackets-manager pozwala stworzyć
  drabinkę z góry (`size`) z pustymi slotami (`id: null`), ale bez zapisu,
  skąd przyjdzie drużyna. Toornament od wersji 2 nie łączy etapów w ogóle.
- **Ręczna korekta po automacie:** wszędzie przez zmianę kolejki rozstawienia
  albo zamianę drużyn w slotach, przed pierwszym meczem fazy
  (szczegóły w [`rozstawienie-i-wolne-losy.md` §5](rozstawienie-i-wolne-losy.md#5-ręczne-rozstawienie-i-korekta-przed-pierwszym-meczem)).
  Specyficzne dla grup: start.gg „keep or avoid previous matchups", Tournify
  strzałki przy linku, Toornament ręczny wybór „Outgoing Participants"
  w kolejności rankingu.

## 2. Wzorce par w regulaminach

### FIFA: MŚ 2022 (8 grup × 2)

Art. 11.6: awansują dwie pierwsze drużyny z każdej grupy. Art. 11.7–11.9
(s. 20 PDF):

| Mecz 1/8 | Para | Ćwierćfinał | Półfinał |
|---|---|---|---|
| M49 | Winner A v. Runner-up B | A (M57): W49 v W50 | 1: A v B |
| M50 | Winner C v. Runner-up D | | |
| M53 | Winner E v. Runner-up F | B (M58): W53 v W54 | |
| M54 | Winner G v. Runner-up H | | |
| M51 | Winner B v. Runner-up A | C (M59): W51 v W52 | 2: C v D |
| M52 | Winner D v. Runner-up C | | |
| M55 | Winner F v. Runner-up E | D (M60): W55 v W56 | |
| M56 | Winner H v. Runner-up G | | |

Z tabeli wynika, że połówka półfinału 1 ma 1A, 2B, 1C, 2D, 1E, 2F, 1G, 2H,
a połówka półfinału 2 — resztę. Obie drużyny z każdej grupy są na
przeciwnych połówkach. Regulamin dodaje przy każdej tabeli, że układ „does not
necessarily represent the chronological order" meczów.

### UEFA: EURO 2028 (6 grup × 2 + 4 najlepsze trzecie)

[Art. 19.03](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Football-Championship-2026-28/Article-19-Match-system-final-tournament-group-stage-Online):
awansuje sześciu zwycięzców, sześć drugich i cztery najlepsze trzecie.
[Art. 21.03–21.06](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Football-Championship-2026-28/Article-21-Match-system-final-tournament-knockout-stage-Online)
(„W" zwycięzca, „R" drugie miejsce, „3" trzecie):

| Mecz | Para | Ćwierćfinał | Półfinał |
|---|---|---|---|
| 1 | WB vs 3A/D/E/F | QF1: M1 v M2 | SF1: QF1 v QF2 |
| 2 | WA vs RC | | |
| 3 | WF vs 3A/B/C | QF2: M3 v M4 | |
| 4 | RD vs RE | | |
| 5 | WE vs 3A/B/C/D | QF3: M5 v M6 | SF2: QF3 v QF4 |
| 6 | WD vs RF | | |
| 7 | WC vs 3D/E/F | QF4: M7 v M8 | |
| 8 | RA vs RB | | |

To nie jest schemat „1X–2Y": dwie pary to drugie miejsca między sobą (RD–RE,
RA–RB), a czterech zwycięzców gra z trzecimi. Rywala z trzecich miejsc
wskazuje osobna tabela 15 kombinacji (art. 21.04). Pomijając trzecie miejsca,
z tabeli wynika, że zwycięzca i drugi z każdej grupy są na przeciwnych
połówkach (np. WA w meczu 2 → SF1, RA w meczu 8 → SF2).

### UEFA: 4 grupy × 2

| Turniej | Ćwierćfinały | Półfinały | Ta sama grupa |
|---|---|---|---|
| [Women's EURO 2025, art. 31.03–31.04](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Women-s-Championship-including-UEFA-Nations-League-and-European-Qualifiers-2023-25/Article-31-Match-system-final-tournament-knockout-stage-Online) | QF1 1A–2B, QF2 1B–2A, QF3 1C–2D, QF4 1D–2C | SF1 QF3 v QF1, SF2 QF4 v QF2 | przeciwne połówki |
| [Futsal EURO 2026, art. 20.03–20.04](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Futsal-Championship-2024-26/Article-20-Match-system-final-tournament-Online) | QF1 1B–2A, QF2 1A–2B, QF3 1C–2D, QF4 1D–2C | SF1 QF2 v QF4, SF2 QF1 v QF3 | przeciwne połówki |
| [U21 2025–27, art. 17.03–17.04](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Under-21-Championship-2025-27/Article-17-Match-system-final-tournament-Online) | QF1 1A–2C, QF2 1C–2A, QF3 1B–2D, QF4 1D–2B | SF1 QF1 v QF2, SF2 QF3 v QF4 | ta sama połówka (1A i 2A mogą się spotkać w SF1) |

Kolumnę „Ta sama grupa" wyprowadziłam z tabel regulaminu, regulaminy jej nie
podają.

### UEFA: 2 grupy

- [U19 2026/27, art. 19.03](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Under-19-Championship-2026/27/Article-19-Match-system-final-tournament-knockout-stage-Online)
  (2 × 2): półfinały „Winner, Group A vs Runner-up, Group B" i „Winner,
  Group B vs Runner-up, Group A".
- Regions' Cup 2026/27, art. 16.03 i 18.02 (2 × 1, turniej amatorski UEFA):
  awansują tylko zwycięzcy grup, finał „Winner, Group A vs Winner, Group B".

### Liga Mistrzów do 2024: losowanie zamiast stałych slotów

[Procedura losowania 1/8 finału 2023/24](https://editorial.uefa.com/resources/0288-19b8cc79213b-f435550d4d65-1000/2023-24_ucl_r16_draw_procedure.pdf)
(losowanie 18.12.2023, „in accordance with Paragraphs 13.07 and 18.01"
regulaminu 2023/24):

- „The group winners are seeded above the runners-up."
- „Group winners must be drawn against runners-up from a different group."
- „Clubs from the same association cannot be drawn against each other."
- Losuje się drugie miejsce, a komputer pokazuje, którzy zwycięzcy grup są
  dopuszczalnymi rywalami; gdy zostaje jeden, przypisuje się go bez losowania.

### Aplikacje i biblioteki

Żadna przeczytana dokumentacja aplikacji nie opisuje **automatycznego**
wzorca krzyżowego:

- **Challonge**: API v2.1 ma `group_stage_options.participant_count_to_advance_per_group`
  (domyślnie 2) i `group_size` (domyślnie 4)
  ([Create Tournament](https://challonge.apidog.io/create-tournament-23619740e0.md)).
  Ani centrum pomocy, ani przewodnik
  [Running a Two-Stage Tournament](https://challonge.apidog.io/running-a-two-stage-tournament-1726921m0.md)
  nie mówią, jak awansujący trafiają na pozycje fazy finałowej. Przy fazie
  grupowej rozgrywanej jako drabinka liczba awansujących z grupy „must be a
  power of 2"
  ([Competition Formats](https://kb.challonge.com/en/article/learn-about-challonge-competition-formats-1f8j1cf/)).
- **Toornament**: „no automatic placement is possible between stages on
  Toornament anymore" (od wersji 2). Organizator dodaje „Outgoing
  Participants" fazy grupowej, wybiera ich w kolejności rankingu i zapisuje to
  jako rozstawienie playoffu
  ([FAQ](https://help.toornament.com/faq/can-i-automatically-generate-brackets-from-group-results)).
- **start.gg**: liczba awansujących to „Number Progressing per pool";
  przy przejściu wybiera się „keep or avoid previous matchups" — „avoiding
  previous matchups will reseed the bracket for this phase"
  ([Setting Progressions Between Phases](https://help.start.gg/en/articles/13813655-setting-progressions-between-phases)).
  Jak przebiega ta zmiana rozstawienia, artykuł nie mówi.
- **Tournify**: organizator klika puste miejsca w drabince i tworzy linki
  „based on earlier performances", zaczynając od pierwszych i drugich miejsc
  w grupach ([Format](https://help.tournifyapp.com/en/articles/8909549-format)).
  Pary układa więc człowiek, nie reguła.
- **LeagueRepublic**: domyślnie awansuje tylko miejsce 1; drugie dodaje się
  w ustawieniach rundy („Position: 2"), a awansujących w każdej grupie
  zaznacza się ręcznie polem „Advance Position"
  ([Advancing teams from a Group Stage](https://help.leaguerepublic.com/en/articles/1518244-advancing-teams-from-a-group-stage-of-a-tournament)).
  O parach artykuł milczy.
- **brackets-manager**: autor nie dodał przejścia z grup do drabinki („it
  would be too complex to have a one-size-fits-all solution",
  [issue #206](https://github.com/Drarig29/brackets-manager.js/issues/206));
  [FAQ](https://drarig29.github.io/brackets-docs/faq/#how-to-handle-two-stage-tournaments-eg-round-robin-followed-by-elimination)
  każe wziąć awansujących z `get.finalStandings()` i podać ich jako seeding
  drugiej fazy. Kolejność tej listy opisuje §3.

## 3. Lista rozstawienia czy przypisanie do slotów

### brackets-manager: lista „miejscami"

`finalStandings()` dla fazy grupowej bierze z każdej grupy
`maxQualifiedParticipantsPerGroup` pierwszych i sortuje całość po miejscu
w grupie, a przy tym samym miejscu po punktach malejąco
([`get.ts` L358–382](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/get.ts#L358-L382)):

```ts
return unsortedRanking.sort((a, b) => {
    // If the ranks are the same, sort by points.
    // Points are compared in reverse order to get the highest points first.
    if (a.rank === b.rank) return b.points - a.points;
    return a.rank - b.rank;
});
```

Wynik to lista „wszyscy zwycięzcy, potem wszyscy drudzy", ale zwycięzcy
ułożeni po punktach, a nie po literze grupy. Podana do `inner_outer` daje
więc pary, które zależą od wyników, a nie od stałego wzorca. Porządki
`groups.effort_balanced`, `groups.seed_optimized` i `groups.bracket_optimized`
([`ordering.ts` L37–150](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/ordering.ts#L37-L150))
służą do rozdzielania drużyn **do grup**, nie z grup do drabinki.

### Odtworzenie dla standardowej kolejności

Reguła pozycji przypisuje każdemu numerowi rozstawienia dokładnie jeden slot,
więc **każdy** układ z regulaminu da się zapisać jako listę. Skrypt
z Dodatku sprawdza, co dają trzy proste reguły budowania listy i jakie listy
odpowiadają regulaminom:

- **A**: zwycięzcy alfabetycznie, potem drudzy alfabetycznie (1A, 1B…, 2A, 2B…);
- **B**: jak A, ale drudzy w odwrotnej kolejności grup;
- **C**: jak A, ale drudzy przesunięci o połowę liczby grup (dla 4: 2C, 2D, 2A, 2B).

| Grupy × awans | Reguła | 1. runda | Ta sama grupa w 1. rundzie | Ta sama grupa na jednej połówce |
|---|---|---|---|---|
| 2 × 2 | A | 1A–2B, 1B–2A | nie | nie |
| 2 × 2 | B = C | 1A–2A, 1B–2B | tak | tak |
| 3 × 2 | A | 1A–BYE, 2A–2B, 1B–BYE, 1C–2C | **tak (1C–2C)** | tak (A, C) |
| 3 × 2 | B | 1A–BYE, 2C–2B, 1B–BYE, 1C–2A | nie | nie |
| 3 × 2 | C | 1A–BYE, 2B–2C, 1B–BYE, 1C–2A | nie | nie |
| 4 × 2 | A | 1A–2D, 1D–2A, 1B–2C, 1C–2B | nie | tak (każda grupa) |
| 4 × 2 | B | 1A–2A, 1D–2D, 1B–2B, 1C–2C | tak | tak |
| 4 × 2 | C | 1A–2B, 1D–2C, 1B–2A, 1C–2D | nie | nie |
| 8 × 2 | A | 1A–2H, 1H–2A, 1D–2E, 1E–2D, … | nie | tak (każda grupa) |
| 8 × 2 | C | 1A–2D, 1H–2E, 1D–2A, 1E–2H, … | nie | tak (każda grupa) |
| 4 × 1, 8 × 1 | A | 1A–1D, 1B–1C / 1A–1H, 1D–1E, 1B–1G, 1C–1F | — | — |
| 2 × 4 | A | 1A–4B, 2B–3A, 1B–4A, 2A–3B | nie | (nieuniknione przy 4 z grupy) |
| 4 × 4 | A | 1A–4D, 2D–3A, 1D–4A, 2A–3D, … | nie | (nieuniknione) |

Listy odpowiadające regulaminom (wyliczone z układu slotów):

| Regulamin | Lista rozstawienia 1–N | Prosta reguła? |
|---|---|---|
| U19 (2 × 2) | 1A, 1B, 2A, 2B | tak, A |
| Futsal EURO (4 × 2) | 1A, 1B, 1C, 1D, 2C, 2D, 2A, 2B | tak, C |
| Women's EURO (4 × 2) | 1C, 1D, 1B, 1A, 2B, 2A, 2C, 2D | nie |
| U21 (4 × 2) | 1A, 1B, 1D, 1C, 2A, 2B, 2D, 2C | nie |
| MŚ 2022 (8 × 2) | 1A, 1B, 1F, 1E, 1G, 1H, 1D, 1C, 2D, 2C, 2G, 2H, 2F, 2E, 2A, 2B | nie |

We wszystkich pięciu zwycięzcy grup mają numery 1–G, a drudzy G+1–2G, więc
przy braku wolnych losów zwycięzca zawsze gra z drugim. Kolejność w obrębie
zwycięzców i drugich nie wynika z żadnej reguły podanej w regulaminie.

## 4. Nieparzysta liczba grup

- **Regulaminy**: żaden przeczytany regulamin nie ma 3 grup po 2 awansujących.
  EURO (6 grup) dopełnia do 16 czterema trzecimi miejscami (poza zakresem),
  zamiast dawać wolne losy.
- **Aplikacje**: Challonge, Toornament, start.gg, Tournify i LeagueRepublic
  nie opisują wolnych losów po fazie grupowej ani rozdzielania grup na
  połówki. Tournify ma drabinki tylko w rozmiarze potęgi dwójki, a brakujące
  miejsca to wolne losy dla wybranych drużyn
  ([Best placed teams and byes](https://help.tournifyapp.com/en/articles/8958025-best-placed-teams-and-byes));
  kto je dostaje po grupach, decyduje organizator przy linkach.
- **Odtworzenie (§3)**: przy 6 drużynach w drabince 8 wolne losy dostają
  numery 1 i 2. Przy liście A to 1A i 1B, a 1C gra z 2C. Przy listach B i C
  1C gra z 2A, drugie miejsca grają między sobą (2B–2C), a każda grupa jest
  rozdzielona na połówki. Trzeci zwycięzca grupy nie dostaje wolnego losu
  w żadnym wariancie, bo wolnych losów są tylko dwa.
- **Unikanie pary z tej samej grupy przy losowaniu**: jedyne źródło z regułą
  to Liga Mistrzów do 2024 („from a different group", §2), gdzie zapewnia to
  komputer przy każdym ciągnięciu. start.gg ma ogólne ograniczenia
  („constraints") jako mechanizm konfliktów, ale nie czytałam, czy działają
  przy przejściu między fazami.

## 5. Nierówne grupy

- **Challonge**: „The group that has more players will have to play more
  matches", a uczestnicy „are still advancing to the final (second) stage
  from both groups"; liczba awansujących z grupy jest jedna dla wszystkich
  ([Participant management](https://kb.challonge.com/en/article/participant-management-1m6ooqe/)).
  O korekcie nic.
- **Tournify**: porównując drużyny z tego samego miejsca w różnych grupach
  („best placed teams"), bierze punkty, potem bilans, potem bramki
  ([Best placed teams and byes](https://help.tournifyapp.com/en/articles/8958025-best-placed-teams-and-byes)).
  Na liście kryteriów jest „Average number of points per match"
  ([Scoring and tiebreakers](https://help.tournifyapp.com/en/articles/8955366-scoring-and-tiebreakers)),
  ale artykuł nie łączy go z nierównymi grupami.
- **UEFA U21** (eliminacje, grupy 5- i 6-zespołowe):
  „the results of group runners-up against the teams in sixth place are
  discarded" przy porównaniu drugich miejsc między grupami
  ([art. 15.02](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Under-21-Championship-2025-27/Article-15-Play-offs-Online)).
- **brackets-manager**: `finalStandings()` porównuje drużyny z tym samym
  miejscem po sumie punktów (§3), bez korekty na liczbę meczów.

Wniosek z tych źródeł: korekta dotyczy porównania **między** grupami.
Przy awansie „N najlepszych z każdej grupy" i stałych slotach nikt nie
koryguje niczego, bo miejsce w grupie nie zależy od rozmiaru innej grupy.
Ma znaczenie dopiero wtedy, gdy kolejność rozstawienia zależy od punktów
(jak w brackets-manager).

## 6. Remis na linii awansu

| System | Ostatnie kryterium | Źródło |
|---|---|---|
| FIFA MŚ 2022 | (h) „drawing of lots by FIFA", po kryteriach ogólnych, bezpośrednich i fair play | art. 12, s. 21 PDF |
| UEFA EURO 2028 | po bezpośrednich (z ponownym zawężeniem), bilansie, bramkach i kartkach: „Higher position in the overall European Qualifiers rankings"; osobno 20.02: dwie drużyny równe we wszystkim, grające ze sobą w ostatniej kolejce i remisujące — rzuty karne | [art. 20](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Football-Championship-2026-28/Article-20-Equality-of-points-final-tournament-group-stage-Online) |
| UEFA U21, Futsal EURO | to samo: ranking współczynników na końcu i rzuty karne w ostatnim meczu; Futsal dodaje, że karne są potrzebne tylko, gdy miejsce decyduje o awansie | [U21 art. 18](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Under-21-Championship-2025-27/Article-18-Equality-of-points-final-tournament-group-stage-Online), [Futsal art. 21](https://documents.uefa.com/r/Regulations-of-the-UEFA-European-Futsal-Championship-2024-26/Article-21-Equality-of-points-final-tournament-group-stage-Online) |
| Toornament | kryteria „Manual" (punkty przyznane przez organizatora w menu „Ranking") i „Random" („randomly attributed by the system") na liście kryteriów | [The Tiebreakers](https://help.toornament.com/match/the-tiebreakers) |
| Challonge | „Manual Tie-Breaks" — organizator przyznaje punkt rozstrzygający; w API do 3 kryteriów (`tie_breaks`) | [Rank and Tie Break Statistics](https://kb.challonge.com/en/article/rank-and-tie-break-statistics-1p5f7y4/), [Create Tournament](https://challonge.apidog.io/create-tournament-23619740e0.md) |
| Tournify | lista kryteriów ustawiana przez organizatora; co po ich wyczerpaniu — brak opisu; można ręcznie dodać lub odjąć punkty grupie | [Scoring and tiebreakers](https://help.tournifyapp.com/en/articles/8955366-scoring-and-tiebreakers), [FAQ – Results](https://help.tournifyapp.com/en/articles/9145357-faq-results) |
| LeagueRepublic | awans zaznacza organizator ręcznie („Advance Position"), więc remis rozstrzyga człowiek | [Advancing teams](https://help.leaguerepublic.com/en/articles/1518244-advancing-teams-from-a-group-stage-of-a-tournament) |
| brackets-manager | sortowanie po punktach, potem liczbie meczów, potem różnicy wyników; drużyny równe we wszystkich trzech mają ten sam `rank`, a `slice(0, N)` tnie po pozycji na liście | [`helpers.ts` L2064–2079](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/helpers.ts#L2064-L2079), [`get.ts` L366–368](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/get.ts#L366-L368) |

W brackets-manager drużyny równe we wszystkich polach zostają w kolejności
wejściowej (sortowanie w JS jest stabilne); skąd ta kolejność się bierze
w mapie rankingu, nie sprawdzałam.

## 7. Kiedy powstaje drabinka i jak zapisać zaślepkę

| System | Kiedy | Co zapisuje slot przed kwalifikacją |
|---|---|---|
| FIFA, UEFA | drabinka jest w regulaminie od początku | źródło slotu: miejsce w grupie („Winner A", „RC") albo wynik meczu („Winner, Match 1") |
| start.gg | progresja ustawiana przed fazą; „The entrants progressing from the first phase will show up as the second phase's entrants" | typ `Progression`: „A connection between a placement in an origin phase group to a destination seed", pola `originPhaseGroup`, `originPlacement`, `originOrder`, `placeholderName`; `Seed` ma `progressionSource` i `placeholderName` ([Progression](https://smashgg-schema.netlify.app/reference/progression.doc), [Seed](https://smashgg-schema.netlify.app/reference/seed.doc)); pola nie mają opisów poza cytowanym |
| Tournify | linki tworzone w „Format" przed rozgrywkami; drużyny wstawiane po kliknięciu „Start" fazy, według tabeli z tej chwili; „Back" cofa start bez kasowania wyników | link do miejsca w grupie ([Format](https://help.tournifyapp.com/en/articles/8909549-format), [Start a phase](https://help.tournifyapp.com/en/articles/9144755-start-a-phase)) |
| Challonge | faza finałowa startuje po `finalize_group_stage`, które „should be run once all group stage matches are complete", a potem `start` | brak opisu zaślepek ([Running a Two-Stage Tournament](https://challonge.apidog.io/running-a-two-stage-tournament-1726921m0.md)) |
| Toornament | rozstawienie playoffu ustawiane ręcznie, gdy faza grupowa jest zwalidowana i ma ranking | brak powiązania między etapami ([FAQ](https://help.toornament.com/faq/can-i-automatically-generate-brackets-from-group-results)) |
| brackets-manager | dowolnie: FAQ dopuszcza stworzenie drugiej fazy od razu z `size` albo po końcu grup; potem `manager.update.seeding()` | `ParticipantResult.id: null` — „the participant is to be determined"; `position` — „Indicates where the participant comes from" ([`other.ts` L40–45](https://github.com/Drarig29/brackets-model/blob/59aedea4c034a6eae5b88bd14f784b263164e808/src/other.ts#L40-L45)); przy `size` bez seedingu sloty to `{ id: null, position: i + 1 }`, czyli numer rozstawienia, nie grupa ([`creator.ts` L520–530](https://github.com/Drarig29/brackets-manager.js/blob/02027cff5d687068719bebbc765072f382e81390/src/base/stage/creator.ts#L520-L530)) |

Dwa modele zaślepki: **źródło jako dane slotu** (FIFA/UEFA w tekście
regulaminu, start.gg `Progression`, Tournify link) albo **pusty slot bez
źródła**, wypełniany listą rozstawienia, gdy grupy się skończą
(brackets-manager, Toornament, Challonge według dokumentacji).

## 8. Ręczna korekta po automacie

Ogólne mechanizmy (numer, przeciąganie, zamiana slotów, blokada po pierwszym
wyniku) są w
[`rozstawienie-i-wolne-losy.md` §5](rozstawienie-i-wolne-losy.md#5-ręczne-rozstawienie-i-korekta-przed-pierwszym-meczem).
Specyficzne dla przejścia z grup:

- **start.gg**: „Use the arrows to reorder the seeding of the groups"
  (w artykule „grupy" to zestawy uczestników progresji, np. startujących
  w górnej albo dolnej drabince, nie grupy fazy grupowej), wybór „keep or avoid
  previous matchups", ręczne przypisanie uczestników do fazy w „entrant
  editing" ([Setting Progressions](https://help.start.gg/en/articles/13813655-setting-progressions-between-phases)).
- **Tournify**: przy linku do „best placed" przełącza się strzałkami
  („switch arrows") pozycję, z której idzie drużyna
  ([Best placed teams and byes](https://help.tournifyapp.com/en/articles/8958025-best-placed-teams-and-byes));
  pary to linki, które organizator sam ustawia w „Format".
- **Challonge**: graczy można przeciągnąć w dowolne miejsce przed startem
  każdej z dwóch faz
  ([Split Participants](https://kb.challonge.com/en/article/what-does-split-participants-mean-in-a-double-elimination-bracket-1v1185f/)).
- **Toornament**: rozstawienie playoffu to ręczny wybór „Outgoing
  Participants" w kolejności rankingu; potem edycja seedów i zamiana w
  podglądzie drabinki
  ([How placement works](https://help.toornament.com/placement/how-placement-works)).
- **brackets-manager**: `manager.update.seeding()` na istniejącej fazie
  ([FAQ](https://drarig29.github.io/brackets-docs/faq/#how-to-handle-two-stage-tournaments-eg-round-robin-followed-by-elimination)).
- **UEFA, FIFA**: brak korekty — pary wynikają z regulaminu albo z losowania.

## 9. Czego nie sprawdziłam

- **Liga Mistrzów do 2024 w samym regulaminie** (paragrafy 13.07 i 18.01
  2023/24) i to, jak wyglądała drabinka od ćwierćfinałów. Czytałam tylko
  procedurę losowania 1/8.
- **EURO 2024 (wydanie 2022–24)** — strona zwraca 404; opisuję EURO 2028.
  Czy układ 1/8 był wtedy identyczny, nie sprawdziłam.
- **MŚ 2026** (48 drużyn, 12 grup, najlepsze trzecie) — poza zakresem,
  nieczytane.
- **Challonge**: jak faza finałowa rozstawia awansujących z grup i czy
  rozdziela drużyny z jednej grupy. Dokumentacja milczy, changelog zwraca 403,
  w aplikacji nie klikałam.
- **start.gg**: co dokładnie robi „avoid previous matchups" (jak powstaje
  nowe rozstawienie) i czy ograniczenia („constraints") działają przy
  progresji.
- **Tournify, LeagueRepublic**: czy jest jakiekolwiek automatyczne łączenie
  w pary krzyżowe, czy wyłącznie ręczne linki; co po wyczerpaniu kryteriów
  w Tournify.
- **Turnieje amatorskie poza UEFA Regions' Cup**: nie znalazłam regulaminu
  z 3 grupami po 2 awansujących, więc §4 dla tego przypadku to wyłącznie
  odtworzenie.
- **Zachowanie bibliotek po instalacji.** Tabele w §3 to odtworzenie reguły
  pozycji, nie wynik uruchomienia `BracketGenerator` ani brackets-manager.

## Dodatek: odtworzenie list rozstawienia

Reguła `seedPositions` jak w `BracketGenerator` (ta sama co `inner_outer`
w brackets-manager). Uruchomienie: zapisać jako `cross.js`, `node cross.js`.

```js
const seedPositions = (size) => { let s = [1]; while (s.length < size) { const m = s.length * 2 + 1; s = s.flatMap(x => [x, m - x]); } return s; };
const pow2 = n => { let p = 1; while (p < n) p *= 2; return p; };
const L = 'ABCDEFGH';
const grp = t => t ? t.slice(1) : null;
function bracket(list) {
  const size = pow2(list.length);
  const slots = seedPositions(size).map(s => list[s - 1] ?? null);
  const pairs = []; for (let i = 0; i < size; i += 2) pairs.push([slots[i], slots[i + 1]]);
  const r1Same = pairs.filter(([a, b]) => a && b && grp(a) === grp(b)).map(p => p.join('-'));
  const half = size / 2, top = slots.slice(0, half).filter(Boolean), bot = slots.slice(half).filter(Boolean);
  const dup = side => [...new Set(side.map(grp))].filter(g => side.filter(t => grp(t) === g).length > 1);
  return { r1: pairs.map(([a, b]) => `${a ?? 'BYE'}-${b ?? 'BYE'}`).join(' | '), r1Same, sameHalf: [...dup(top), ...dup(bot)] };
}
function listFromSlots(slots) { const list = []; seedPositions(slots.length).forEach((seed, i) => { list[seed - 1] = slots[i]; }); return list; }
const ruleA = (G, N) => { const o = []; for (let n = 1; n <= N; n++) for (let g = 0; g < G; g++) o.push(n + L[g]); return o; };
const ruleB = (G, N) => { const o = []; for (let n = 1; n <= N; n++) { const r = []; for (let g = 0; g < G; g++) r.push(n + L[g]); o.push(...(n % 2 === 0 ? r.reverse() : r)); } return o; };
const ruleC = G => [...[...L.slice(0, G)].map(g => '1' + g), ...[...L.slice(0, G)].map((_, g) => '2' + L[(g + Math.floor(G / 2)) % G])];
const show = (name, list) => { const b = bracket(list); console.log(`${name}: ${list.join(',')}\n  R1: ${b.r1}\n  ta sama grupa w R1: ${b.r1Same.join(', ') || 'brak'}; ta sama połówka: ${b.sameHalf.join(', ') || 'brak'}`); };
for (const [G, N] of [[2, 1], [2, 2], [2, 4], [3, 1], [3, 2], [4, 1], [4, 2], [4, 4], [8, 1], [8, 2]]) {
  show(`${G}x${N} A`, ruleA(G, N));
  if (N === 2) { show(`${G}x${N} B`, ruleB(G, N)); show(`${G}x${N} C`, ruleC(G)); }
}
const regs = {
  'MŚ 2022': ['1A', '2B', '1C', '2D', '1E', '2F', '1G', '2H', '1B', '2A', '1D', '2C', '1F', '2E', '1H', '2G'],
  "Women's EURO 2025": ['1C', '2D', '1A', '2B', '1D', '2C', '1B', '2A'],
  'Futsal EURO 2026': ['1A', '2B', '1D', '2C', '1B', '2A', '1C', '2D'],
  'U21 2025-27': ['1A', '2C', '1C', '2A', '1B', '2D', '1D', '2B'],
  'U19 2026/27': ['1A', '2B', '1B', '2A'],
};
for (const [k, slots] of Object.entries(regs)) show(k, listFromSlots(slots));
```

Układ slotów każdego regulaminu to kolejność meczów w drabince: najpierw
mecze prowadzące do półfinału 1, w kolejności ćwierćfinałów (§2).
