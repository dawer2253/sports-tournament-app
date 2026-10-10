# Terminarz w aplikacjach turniejowych

Badanie na potrzeby ticketu
[#166 „S2: research — terminarz w aplikacjach turniejowych"](https://github.com/dawer2253/sports-tournament-app/issues/166)
(mapa [#156](https://github.com/dawer2253/sports-tournament-app/issues/156)).
Precedensy dla ticketów decyzyjnych
[#157 „S2: generowanie terminarza ligi"](https://github.com/dawer2253/sports-tournament-app/issues/157),
[#158 „S2: rozkład dat i kolizje w terminarzu"](https://github.com/dawer2253/sports-tournament-app/issues/158),
[#161 „S2: drużyny i obiekty a istniejący terminarz"](https://github.com/dawer2253/sports-tournament-app/issues/161),
[#159 „S2: wynik i stan meczu"](https://github.com/dawer2253/sports-tournament-app/issues/159) i
[#160 „S2: klasyfikacja — przypadki brzegowe tiebreaków"](https://github.com/dawer2253/sports-tournament-app/issues/160).
Data: 10 października 2026.

**Ten plik ustala fakty, nie podejmuje decyzji.** Opisuje, co publiczna
dokumentacja siedmiu aplikacji mówi o generowaniu terminarza, jego zmianach,
kolizjach, wyniku i tiebreakach. Nie wskazuje, którą drogą pójść — to należy
do ticketów wymienionych wyżej. Terminy domenowe według
[`CONTEXT.md`](../../CONTEXT.md): mecz (Match), kolejka (Round), pauza (Bye),
obiekt (Venue), kryterium rozstrzygające / tiebreak (Tiebreaker), tabela
(Standing). Tam, gdzie aplikacja używa własnej nazwy (np. „station" w
Challonge, „sub-venue" w LeagueRepublic), podaję ją w cudzysłowie.

## 0. Źródła i metoda

Wyłącznie strony pierwszej strony (dokumentacja, centra pomocy, referencje
API, strony funkcji producenta), czytane publicznie, bez zakładania kont:

| Aplikacja | Źródła |
|---|---|
| Tournify | [help.tournifyapp.com](https://help.tournifyapp.com/en/), strony funkcji na tournifyapp.com |
| LeagueRepublic | [help.leaguerepublic.com](https://help.leaguerepublic.com/en/), [docs.api.leaguerepublic.com](https://docs.api.leaguerepublic.com/leaguerepublic-read-api.md), strony funkcji na leaguerepublic.com |
| Challonge | [kb.challonge.com](https://kb.challonge.com/en/), dokumentacja API ([challonge.apidog.io](https://challonge.apidog.io/), na którą przekierowuje dawne `api.challonge.com/v1/documents`) |
| Toornament | [help.toornament.com](https://help.toornament.com/), [developer.toornament.com](https://developer.toornament.com/v2/), jeden wpis z oficjalnego bloga (oznaczony) |
| SportsEngine | [help.sportsengine.com](https://help.sportsengine.com/en/) i jeden PDF z ich S3, podlinkowany z centrum pomocy |
| LeagueApps | [support.leagueapps.com](https://support.leagueapps.com/hc/en-us) (strony blokują pobranie przez Cloudflare; treść czytana przez publiczne API tego samego Zendeska, linki prowadzą do artykułów) |
| TeamSnap | [helpme.teamsnap.com](https://helpme.teamsnap.com/) |

Ograniczenia:

- **Nic nie było klikane w samych aplikacjach.** Każde zdanie to odczyt
  dokumentacji, nie obserwacja zachowania. Dokumentacja często mówi, gdzie
  jest przycisk, a milczy o skutkach — te luki zbiera §9.
- Część artykułów LeagueRepublic opiera się na zrzutach ekranu i filmach.
  Zrzuty były czytane, filmy nie.
- SportsEngine ma dwa produkty: nowy „Season Management" (z narzędziem
  „Scheduling Assistant") i starszy „Sport Management". Gotowe presety tabel
  pochodzą ze starszego. TeamSnap ma osobny produkt „Tournaments" i to jego
  dotyczą szczegółowe tiebreaki; „Clubs & Leagues" opisuje tabelę skąpo.
- Zbieranie z dokumentacji robiły równolegle cztery sesje pomocnicze;
  kluczowe twierdzenia o tiebreakach i wyniku na żywo (Tournify head-to-head,
  LeagueRepublic Latest/Final Score, Toornament tiebreakers, TeamSnap
  tiebreakers) zostały przeczytane ponownie u źródła przed zapisaniem.

## 1. Streszczenie

- **Generator ligi to w większości aplikacji dwa kroki: pary, potem sloty.**
  Najpierw powstają mecze (kto z kim, ile razy), potem są rozkładane na
  terminy i obiekty. Tournify robi to ręcznie kolejka po kolejce, bo pełnego
  automatu dla ligi nie ma; SportsEngine, LeagueApps, TeamSnap i
  LeagueRepublic mają osobne „sloty czasowe" na obiektach i automat, który
  w nie wkłada mecze. Challonge i Toornament w ogóle nie rozkładają meczów
  w czasie automatycznie — termin ustawia się per mecz albo hurtowo.
- **Liczba spotkań każdej pary:** od 1–2 (Tournify, Toornament bez
  ręcznych par) przez 1–3 (Challonge) do 1–4 (LeagueRepublic). SportsEngine
  i LeagueApps pytają o liczbę meczów na drużynę, nie o liczbę rund.
- **Algorytmu kojarzenia par nie opisuje nikt.** Toornament pisze tylko
  „standardowa metoda round robin", reszta nic. Kolejność drużyn i losowanie
  są udokumentowane jako rozstawienie (seed) w Challonge i Toornament; w
  aplikacjach ligowych — nie.
- **Ponowne generowanie: albo pełny reset, albo nietykanie istniejących
  meczów.** Challonge: reset usuwa wszystkie wyniki. Toornament: zmiana
  rozmiaru, metody par albo tabeli par resetuje wszystkie mecze fazy.
  SportsEngine i TeamSnap: zmiana reguł i slotów nie rusza istniejących
  meczów (trzeba uruchomić automat jeszcze raz albo przesunąć ręcznie).
  LeagueRepublic ma osobną operację dopełnienia brakujących meczów, ale
  tylko przy 2 albo 4 spotkaniach pary. Co ponowny automat robi z wpisanymi
  wynikami i ręcznymi korektami, nie mówi żadna dokumentacja aplikacji
  ligowej.
- **Wycofanie drużyny w trakcie: dominuje walkower.** Challonge i Toornament
  oddają pozostałe mecze walkowerem (Challonge automatycznie przy usunięciu
  uczestnika). Tournify ukrywa mecze i usuwa drużynę z tabeli („No show"),
  a walkowera nie ma — wpisuje się fikcyjny wynik. LeagueRepublic przy
  usuwaniu pyta o los wyników i przyszłych meczów, ale opcji nie wymienia.
  SportsEngine i TeamSnap nie pozwalają usunąć drużyny, która ma mecze
  (TeamSnap Tournaments: mecze z wynikiem).
- **Kolizje: od braku wykrywania do twardej blokady.** Brak wzmianki:
  Challonge, Toornament, Tournify (Tournify wprost: sędzia może zostać
  zdublowany). Ostrzeżenie: SportsEngine (ikona przy meczu), LeagueRepublic
  (panel z przyciskiem IGNORE). Blokada: LeagueApps w harmonogramie turnieju,
  automat TeamSnap dla klasy „Conflict". Zakres kolizji: obiekt, drużyna,
  trener, sędzia, a w TeamSnap i SportsEngine także odpoczynek między meczami.
- **Stany meczu:** Challonge `pending/open/complete` + flaga „underway";
  Toornament `pending/running/completed` liczone z danych; SportsEngine osiem
  stanów od „Unscheduled" do „Deleted"; LeagueRepublic dziewięć statusów
  wyniku (w tym walkower gospodarza/gościa, przerwany, unieważniony).
  **Wynik na żywo nie wchodzi do tabeli** w LeagueRepublic (wprost:
  „Latest Score" vs „Final Score").
- **Zmiana zakończonego wyniku:** w drabinkach (Challonge) cofa zależne mecze;
  w ligach wynik się po prostu edytuje. Blokady istnieją jako jawna operacja:
  „lock" w LeagueRepublic, walidacja grupy w Toornament.
- **Tiebreaki:** wszystkie aplikacje z opisem pozwalają ustawić kolejność.
  Head-to-head dla 3+ drużyn opisują Tournify (mała tabela, opcja
  UEFA/FIFA), Toornament (ponowne liczenie dla pozostałych), Challonge
  (zwycięstwa między remisującymi) i TeamSnap Tournaments (osobne kryteria
  dla 2 i 3+). **Co, gdy wszystko równe:** Toornament ma kryteria „manual"
  i „random" oraz dopuszcza wspólny `rank` przy unikalnym `position`;
  Challonge i Tournify mają ręczne punkty/korekty; SportsEngine — „kontakt
  z supportem"; reszta milczy.

## 2. Parametry generowania ligi

### 2.1. Ile razy gra każda para, kolejność, losowanie, pauza

- **Tournify:** grupa gra każdy z każdym „raz albo dwa razy"
  ([Format](https://help.tournifyapp.com/en/articles/8909549-format),
  [Create a format](https://help.tournifyapp.com/en/articles/8953884-create-a-format)).
  Mniej kolejek — przez filtr „Rounds" i planowanie tylko części
  ([FAQ Format](https://help.tournifyapp.com/en/articles/8970419-faq-format)).
  Przydział do grup ręczny albo „automated draw", zmienialny później
  ([Format](https://help.tournifyapp.com/en/articles/8909549-format)).
  Gospodarza i gościa da się zamienić per mecz
  ([FAQ Schedule](https://help.tournifyapp.com/en/articles/8974711-faq-schedule)).
  Kolejność drużyn i rozstawienie przy generowaniu par: **nie opisane**.
- **LeagueRepublic:** pary grają 1–4 razy
  ([What does your schedule maker do](https://help.leaguerepublic.com/en/articles/4227830-what-does-your-league-sports-schedule-maker-actually-do)).
  8 drużyn = 7 dni meczowych, 28 meczów; nieparzysta liczba jest planowana
  jak o jedną większa, z jedną pauzą na tydzień (tamże). **Generator nie
  tworzy meczu-pauzy**; dokumentacja proponuje ogłoszenie albo fikcyjną
  drużynę „bye", ukrywaną w tabeli przez wymuszenie pozycji 0
  ([Scheduling and byes](https://help.leaguerepublic.com/en/articles/639717-scheduling-and-byes)).
  Kolejność, rozstawienie i losowanie: **nie opisane**.
- **Challonge:** domyślnie jedno spotkanie, opcja „Round Robin 2x or 3x"
  ([Competition formats](https://kb.challonge.com/en/article/learn-about-challonge-competition-formats-1f8j1cf/));
  w API `group_stage_options.rr_iterations` 1–3, a dla samodzielnego round
  robin `round_robin_options.iterations` z domyślną wartością 2
  ([Create tournament](https://challonge.apidog.io/create-tournament-23619740e0.md)).
  Rozstawienie ręczne, „Shuffle Seeds" (losowe) albo według ratingu (PRO);
  grupy wężykiem („Serpentine system"), nierówne grupy dozwolone
  ([Participant management](https://kb.challonge.com/en/article/participant-management-1m6ooqe/)).
  Losowanie przez API tylko przed startem
  ([Randomize participants](https://challonge.apidog.io/randomize-a-tournaments-participants-23832032e0.md)).
  Pauza przy nieparzystej grupie round robin: **nie opisana** (artykuł o
  pauzach dotyczy drabinek,
  [Why some participants go straight to round 2](https://kb.challonge.com/en/article/why-some-participants-go-straight-to-round-2-1r639q3/)).
- **Toornament:** faza „League" albo „Round-robin groups";
  `pairing_method` = `standard` (domyślna, „standard round robin method"),
  `double_standard` (drugi raz w odwrotnej kolejności) albo `manual`
  ([Stage structure](https://developer.toornament.com/v2/core-concepts/structure/stage)).
  Więcej niż dwa razy — tylko ręczną tabelą par
  ([Pairing table](https://help.toornament.com/placement/the-pairing-table)).
  Rozstawienie automatyczne (wg daty dodania), ręczne albo losowe z
  zachowaniem zablokowanych miejsc; skład grup m.in. wężykiem
  ([How placement works](https://help.toornament.com/placement/how-placement-works)).
  Pauza jest w modelu typem meczu `bye` z jednym uczestnikiem
  ([Match](https://developer.toornament.com/v2/core-concepts/match/)), ale
  punkty za pauzę help opisuje jako tylko dla systemu szwajcarskiego
  ([New ways to award points](https://help.toornament.com/match/new-ways-to-award-points)).
- **SportsEngine:** „Generate Games" — wybór dywizji i drużyn, **liczba
  meczów na drużynę**
  ([Creating a schedule with Scheduling Assistant](https://help.sportsengine.com/en/articles/7207483-season-management-creating-a-schedule-with-scheduling-assistant)).
  Podsumowanie meczów na drużynę z podziałem dom/wyjazd
  ([Scheduling Assistant FAQ](https://help.sportsengine.com/en/articles/7208629-season-management-scheduling-assistant-faq)).
- **LeagueApps:** „Regular Round Robin", **łączna liczba meczów na drużynę**
  i **meczów na tydzień**; poprawny wynik tylko przy parzystych liczbach,
  inaczej narzędzie pokazuje „potential issue(s)" i pozwala zaakceptować
  mimo to
  ([Schedule Generator for Round Robin](https://support.leagueapps.com/hc/en-us/articles/360039863553-Using-the-Schedule-Generator-for-Round-Robin-Schedules)).
- **TeamSnap:** dla ligi liczba meczów albo rund **nie opisana**; jest
  „Balance Statistics" po automacie
  ([Create games in Scheduler](https://helpme.teamsnap.com/article/251-create-games-and-practices-in-scheduler)).

### 2.2. Daty, godziny, obiekty, strefa czasowa

- **Tournify:** każde boisko ma nazwę i godzinę startu per dzień meczowy;
  mecze idą jeden po drugim, bez godziny końca
  ([Add playing fields](https://help.tournifyapp.com/en/articles/9064427-add-playing-fields)).
  Jeden parametr „Match duration" obejmuje mecz i przerwę po nim, może
  różnić się per dywizja albo grupa
  ([Set the match duration](https://help.tournifyapp.com/en/articles/8974771-set-the-match-duration)).
  Przerwy i wydarzenia wstawia się ręcznie na boisko
  ([Adding breaks and events](https://help.tournifyapp.com/en/articles/9064637-adding-breaks-and-events)).
  Dni meczowe i lokalizacje osobno, terminarz budowany per dzień i
  lokalizacja ([Schedule](https://help.tournifyapp.com/en/articles/8909552-schedule),
  [Using locations](https://help.tournifyapp.com/en/articles/15374237-using-locations)).
  **Pełnego automatu dla ligi brak** — zalecany sposób to kolejka 1 na
  pierwszy dzień, kolejka 2 na drugi itd.; ograniczeń typu „bez meczów
  jeden po drugim" nie da się wpisać
  ([Schedule matches automatically](https://help.tournifyapp.com/en/articles/9064758-schedule-matches-automatically),
  [Create and manage a league](https://help.tournifyapp.com/en/articles/13790816-create-and-manage-a-competition-or-league-in-tournify)).
  Strefa czasowa: **nie opisana**.
- **LeagueRepublic:** dwa generatory
  ([Options for creating a schedule](https://help.leaguerepublic.com/en/articles/3860202-options-for-creating-a-schedule)):
  „Template" (minuty, do 24 drużyn, wszystkie drużyny grają w każdym
  slocie, powtarzalne sloty z limitem meczów) i „Advanced" (dowolne
  rozmiary, dostępność drużyn i obiektów, liczy się w tle od 1 do 24 godzin).
  Daty wyłączone jako „Closed Timeslots" albo zakładka dostępności
  ([Certain dates](https://help.leaguerepublic.com/en/articles/3123184-i-don-t-want-to-schedule-matches-in-certain-dates-how-do-i-do-this)).
  Kilka meczów jednego wieczoru: Advanced próbuje kolejnych godzin, gdy
  pierwsza zajęta
  ([Several timeslots on the same day](https://help.leaguerepublic.com/en/articles/639736-scheduling-over-several-timeslots-on-the-same-day)).
  Obiekt dzieli się na „sub-venues" (boiska, korty)
  ([League schedule generator](https://help.leaguerepublic.com/en/articles/3738007-league-schedule-generator)).
  Pełny terminarz można wygenerować z datą „To Be Confirmed"
  ([FIFA league for singles](https://help.leaguerepublic.com/en/articles/3822936-creating-a-fifa-league-for-singles-players)).
  Ustawienia strefy czasowej w helpie brak; API zwraca czas lokalny ligi
  i osobno epoch UTC w milisekundach
  ([Read API](https://docs.api.leaguerepublic.com/leaguerepublic-read-api.md)).
- **Challonge:** `starts_at` to planowany start, turniej nie startuje sam
  ([Create tournament](https://challonge.apidog.io/create-tournament-23619740e0.md)).
  Strefa czasowa organizatora z możliwością nadpisania, zalogowany widz
  widzi swoją
  ([How timezones work](https://kb.challonge.com/en/article/how-timezones-work-for-start-times-hn0dom/)).
  Czas meczu ustawia się per mecz po przypisaniu „station"
  ([Set times for matches](https://kb.challonge.com/en/article/how-to-set-times-for-matches-1jooy8g/));
  „station" to dowolne miejsce gry, przypisywane ręcznie albo automatycznie
  ([Stations](https://kb.challonge.com/en/article/how-to-create-and-assign-stations-j1xavx/)).
  Czas trwania meczu, odstęp i daty kolejek: **brak takich pól**.
- **Toornament:** turniej ma `timezone` (IANA) i daty początku/końca bez
  godzin ([Tournaments API](https://developer.toornament.com/v2/doc/organizer_tournaments));
  mecz ma `scheduled_datetime` i mapę `locations`
  ([Matches API](https://developer.toornament.com/v2/doc/organizer_matches));
  kolejki nie mają dat
  ([Rounds API](https://developer.toornament.com/v2/doc/organizer_rounds)).
  Termin ustawia się per mecz albo hurtowo
  ([How do I schedule my tournament](https://help.toornament.com/faq/how-do-i-schedule-my-tournament);
  blog: [bulk scheduling](https://blog.toornament.com/2023/09/new-feature-schedule-your-tournament-matches-in-bulk/)).
- **SportsEngine:** obiekty → sloty czasowe (obiekty, dni, daty, godziny)
  → reguły → mecze → „Autoschedule"
  ([Creating a schedule](https://help.sportsengine.com/en/articles/7207483-season-management-creating-a-schedule-with-scheduling-assistant)).
  Reguły: długość meczu, bufor między slotami, maks. meczów drużyny na
  dzień, minimalny odpoczynek, daty wyłączone, ograniczenia obiektów per
  dywizja, zakaz równoczesnych meczów wskazanych drużyn (wspólny trener)
  ([Scheduling rules](https://help.sportsengine.com/en/articles/7211601-draft-season-management-scheduling-rules)).
- **LeagueApps:** dni tygodnia, godziny startu (każda to slot), obiekty,
  meczów na tydzień, opcjonalnie dwumecze
  ([Schedule Generator for Round Robin](https://support.leagueapps.com/hc/en-us/articles/360039863553-Using-the-Schedule-Generator-for-Round-Robin-Schedules)).
  W harmonogramie turnieju mecze trafiają do „unscheduled game bank" i
  przeciąga się je na siatkę data × obiekt
  ([How do I schedule tournaments](https://support.leagueapps.com/hc/en-us/articles/10579170260119-How-do-I-schedule-tournaments)).
  Jedna strefa czasowa na serwis, opisana tylko przy rejestracji
  ([Program Details](https://support.leagueapps.com/hc/en-us/articles/360039380074-Program-Details)).
- **TeamSnap:** obiekty i „sub-venues", daty wyłączone (organizacja i
  obiekt), dni tygodnia, godzina startu, dodatkowe sloty godzinowe per
  dywizja
  ([Create games in Scheduler](https://helpme.teamsnap.com/article/251-create-games-and-practices-in-scheduler)).
  W Tournaments: długość meczu „od startu do startu" z rozgrzewką, min. i
  maks. odstęp między meczami drużyny, zgoda na mecze jeden po drugim,
  maks. meczów na dzień, okno godzinowe obiektu
  ([Tournament event settings](https://helpme.teamsnap.com/article/201-manage-tournament-event-settings));
  automat omija mecze już wstawione ręcznie
  ([Set up tournament schedule](https://helpme.teamsnap.com/article/494-set-up-tournament-event-schedule)).

## 3. Ponowne generowanie

- **Tournify:** ikona kłódki blokuje terminarz; po nadpisaniu kalendarza
  nie da się wrócić do poprzedniej wersji
  ([FAQ Schedule](https://help.tournifyapp.com/en/articles/8974711-faq-schedule)).
  Mecz można odpiąć z terminu przeciągając na listę „Not planned"
  ([Schedule matches manually](https://help.tournifyapp.com/en/articles/9066653-schedule-matches-manually)).
  Co dzieje się z wynikami i ręcznymi przesunięciami przy ponownym
  planowaniu: **nie opisane**.
- **LeagueRepublic:** wynik Advanced trzeba zaakceptować albo odrzucić,
  przed akceptacją nie widać go publicznie
  ([Scheduling missing matches](https://help.leaguerepublic.com/en/articles/639725-scheduling-missing-matches),
  [Matches not showing](https://help.leaguerepublic.com/en/articles/639493-reasons-matches-might-not-be-showing-on-your-site)).
  „Reschedule > MISSING MATCHES" dopełnia braki, ale tylko przy 2 albo 4
  spotkaniach pary (tamże). Usuwanie hurtowe per dywizja, wszystkich albo
  według statusu; by usunąć mecze po dacie — oznaczyć jako odwołane i
  skasować odwołane
  ([Deleting a schedule](https://help.leaguerepublic.com/en/articles/2625492-deleting-a-schedule)).
  Pełnego „wygeneruj ponownie" i jego skutków dla wyników: **nie opisano**.
- **Challonge:** reset służy dużym zmianom (np. dopisaniu uczestnika) i
  **kasuje wszystkie wpisane wyniki**
  ([Resetting a tournament](https://kb.challonge.com/en/article/resetting-a-tournament-omeed8/),
  [Reset API](https://challonge.apidog.io/reset-a-tournament-23827367e0.md)).
  Zakończony turniej można otworzyć ponownie i edytować wyniki
  ([Reopen tournament](https://kb.challonge.com/en/article/reopen-tournament-4jkuqg/)).
- **Toornament:** zmiana rozmiaru fazy, metody par albo tabeli par
  regeneruje fazę i **resetuje wszystkie jej mecze**
  ([Change the size](https://help.toornament.com/structures/change-the-size-of-your-tournament),
  [Double robin](https://help.toornament.com/structures/introducing-the-double-robin-format),
  [Pairing table](https://help.toornament.com/placement/the-pairing-table)).
  Rozstawienie i zablokowane miejsca przetrwają
  ([How placement works](https://help.toornament.com/placement/how-placement-works)).
  Zakazu „tylko przed startem" brak — jest ostrzeżenie.
- **SportsEngine:** zmiana obiektów albo reguł **nie przesuwa istniejących
  meczów**; trzeba uruchomić automat ponownie albo poprawić ręcznie
  ([Scheduling Assistant FAQ](https://help.sportsengine.com/en/articles/7208629-season-management-scheduling-assistant-faq)).
  Czy ponowny automat zachowuje ręczne zmiany i mecze z wynikiem: **nie
  opisane**.
- **LeagueApps:** przed akceptacją można generować ponownie
  ([Schedule Generator](https://support.leagueapps.com/hc/en-us/articles/360039863553-Using-the-Schedule-Generator-for-Round-Robin-Schedules));
  w turnieju można wygenerować mecze grupowe jeszcze raz z innymi
  parametrami ([How do I schedule tournaments](https://support.leagueapps.com/hc/en-us/articles/10579170260119-How-do-I-schedule-tournaments));
  usunięcia meczów nie da się cofnąć
  ([Cancel or reschedule games](https://support.leagueapps.com/hc/en-us/articles/360044988333-How-To-Cancel-Or-Reschedule-Games)).
  Nowy harmonogram klubowy działa tylko na pustym terminarzu
  ([New Club Scheduling](https://support.leagueapps.com/hc/en-us/articles/23315644300183-New-Club-Scheduling-Experience)).
- **TeamSnap:** usunięcie slotów albo zmiana dat **nie kasuje meczów, tylko
  je ukrywa**; usuwa się je wyłącznie przez skasowanie albo cofnięcie
  publikacji; zmiany wychodzą do drużyn przez „Publish League Schedules"
  ([Edit Scheduler events](https://helpme.teamsnap.com/article/252-edit-scheduler-events)).

## 4. Drużyna dodana albo wycofana po starcie

- **Tournify:** „No show" zostawia terminarz, ukrywa mecze drużyny przed
  publicznością i usuwa ją z tabeli grupy
  ([Mark a team as no show](https://help.tournifyapp.com/en/articles/9337249-mark-a-team-as-no-show)).
  Walkowera nie ma — wpisuje się fikcyjny wynik porażki
  ([FAQ Results](https://help.tournifyapp.com/en/articles/9145357-faq-results)).
  Artykuł o usuwaniu drużyny podaje tylko kroki
  ([Delete a team](https://help.tournifyapp.com/en/articles/8908707-delete-a-team)).
- **LeagueRepublic:** przy usuwaniu z dywizji kolejna strona pyta o wpisane
  wyniki i nadchodzące mecze; jest też „replace team"; **jakie to opcje —
  artykuł nie mówi**
  ([Removing a team](https://help.leaguerepublic.com/en/articles/639783-removing-a-team-from-a-division)).
  Strona funkcji obiecuje dopełnienie terminarza dla drużyny dołączającej
  w trakcie ([Scheduling features](https://www.leaguerepublic.com/features/scheduling.html)).
  Tabelę koryguje się ręcznie: punkty ±, wymuszona pozycja, 0 ukrywa
  ([Manually adjust the standings](https://help.leaguerepublic.com/en/articles/634277-can-i-manually-adjust-the-standings)).
- **Challonge:** dodać uczestnika można tylko przed startem
  ([Create participant](https://challonge.apidog.io/create-a-participant-23830076e0.md));
  w trakcie — reset z utratą wyników
  ([Resetting](https://kb.challonge.com/en/article/resetting-a-tournament-omeed8/)).
  Usunięcie w trakcie oznacza uczestnika jako nieaktywnego i **automatycznie
  oddaje walkowerem wszystkie jego pozostałe mecze**
  ([Delete/deactivate participant](https://challonge.apidog.io/deletedeactivate-a-participant-23832019e0.md),
  [Forfeits by removing participants](https://kb.challonge.com/en/article/how-to-report-indicate-forfeits-by-removing-participants-vsb6tt/)).
  Los rozegranych meczów w tabeli round robin: **nie opisany**.
- **Toornament:** uczestnika można dołożyć także po starcie meczów fazy;
  uczestnik z jakimkolwiek wynikiem jest zablokowany na swoim miejscu
  ([How placement works](https://help.toornament.com/placement/how-placement-works)).
  Dyskwalifikacja = walkower w meczu (przegrana, rywal wygrywa; obustronny
  — bez zwycięzcy), w lidze i grupach z konfigurowalnymi, także ujemnymi,
  punktami za walkower
  ([The forfeit](https://help.toornament.com/match/the-forfeit)).
  Wycofanie z całej fazy opisane tylko dla systemu szwajcarskiego
  ([Swiss system](https://help.toornament.com/structures/introducing-the-swiss-system)).
- **SportsEngine:** drużyny z zaplanowanymi meczami **nie da się usunąć**;
  przeniesienie do innej dywizji przelicza tabelę, a jej dawne mecze stają
  się meczami z rywalem spoza dywizji
  ([Edit teams and divisions](https://help.sportsengine.com/en/articles/8938021-season-management-edit-teams-and-divisions)).
- **LeagueApps:** można przenieść całą drużynę do innego programu
  ([Moving players and teams](https://support.leagueapps.com/hc/en-us/articles/360039383734-Moving-Players-and-Teams));
  skutków dla meczów i tabeli **nie opisano**.
- **TeamSnap:** drużynę można „retire" (zostaje jako archiwum) albo usunąć
  (wszystkie dane); usunięcie odmawia, gdy są wydarzenia organizacji
  ([Removing a team](https://helpme.teamsnap.com/article/1231-removing-a-team-from-your-account)).
  W Tournaments drużyny z meczami z wynikiem nie da się usunąć — trzeba
  wyczyścić wyniki, bo „0" to wynik
  ([Tournament divisions and teams](https://helpme.teamsnap.com/article/207-add-edit-tournament-divisions-and-teams)).

## 5. Kolizje terminów i obiektów

| Aplikacja | Co jest sprawdzane | Jak pokazane | Czy blokuje |
|---|---|---|---|
| Tournify | nic nie opisano; sędzia może trafić na dwa mecze naraz, automatu brak ([Referees](https://help.tournifyapp.com/en/articles/8925236-set-preferences-for-referees)) | — | nie opisano |
| LeagueRepublic | Advanced „nigdy nie zdubluje" drużyny ani obiektu ([Several timeslots](https://help.leaguerepublic.com/en/articles/639736-scheduling-over-several-timeslots-on-the-same-day)); UI podświetla zdublowaną drużynę/obiekt, niedostępność i „To Be Confirmed"; kolizje sędziów ([Glossary](https://help.leaguerepublic.com/en/articles/8805164-the-language-of-leaguerepublic-a-handy-glossary-for-beginners)) | panel „match conflicts" z przyciskiem IGNORE na zrzucie ([Scheduling features](https://www.leaguerepublic.com/features/scheduling.html)) | przycisk IGNORE sugeruje ostrzeżenie; wprost nie opisano. Sprawdzanie wyłącza się razem z obiektami ([Disabling venues](https://help.leaguerepublic.com/en/articles/639796-disabling-venues)) |
| Challonge | nic nie opisano | — | — |
| Toornament | nic nie opisano | — | — |
| SportsEngine | podwójna rezerwacja (także między sezonami) i złamanie reguł ([Scheduling Assistant FAQ](https://help.sportsengine.com/en/articles/7208629-season-management-scheduling-assistant-faq)); tylko w Season Management ([SM vs SeM](https://help.sportsengine.com/en/articles/7202912-sport-management-vs-season-management)) | ikona ostrzeżenia przy meczu, „View conflict details" | opisane jako ostrzeżenie; blokady nie opisano |
| LeagueApps | w turnieju: mecz upuszczony na inny mecz i nakładanie się na tym samym obiekcie, w obrębie programu ([Schedule tournaments](https://support.leagueapps.com/hc/en-us/articles/10579170260119-How-do-I-schedule-tournaments)); kalendarz obiektów „ułatwia zauważenie" ([Global Calendar](https://support.leagueapps.com/hc/en-us/articles/38230369036951-Global-Calendar-Guide)) | błąd | **tak** (turniej); w generatorze ligi nie opisano |
| TeamSnap | obiekt, drużyna (dwa mecze naraz albo jeden po drugim w różnych miejscach), trener, daty niedostępności drużyny; sprawdzane względem wszystkich terminarzy, także nieopublikowanych ([Scheduler conflicts](https://helpme.teamsnap.com/article/250-scheduler-conflicts)) | ostrzeżenia dwóch klas: „Conflict" (twarde) i „Preference" (min./maks. odstęp) ([Preference vs conflict](https://helpme.teamsnap.com/article/599-preference-warning-vs-conflict-warning)) | automat nie wstawi meczu w „Conflict"; konflikt trenera można zignorować |

Ręczna edycja terminarza: przeciąganie w Tournify
([Schedule manually](https://help.tournifyapp.com/en/articles/9066653-schedule-matches-manually))
i LeagueApps (siatka turnieju); hurtowe przesunięcie godzin i dat ±N dni w
LeagueRepublic
([Several timeslots](https://help.leaguerepublic.com/en/articles/639736-scheduling-over-several-timeslots-on-the-same-day));
hurtowe ustawienie terminu w Toornament; „Swap Weeks" w TeamSnap
([Scheduler](https://helpme.teamsnap.com/article/251-create-games-and-practices-in-scheduler)).

## 6. Wynik i stan meczu

### 6.1. Stany

- **Challonge:** `pending`, `open`, `complete`
  ([Update match](https://challonge.apidog.io/update-match-23619747e0.md));
  „underway" to flaga (`underway_at`), nie stan
  ([Change match state](https://challonge.apidog.io/change-match-state-23619748e0.md)).
  W trakcie można wpisywać częściowy wynik bez zwycięzcy
  ([Score reporting in progress](https://kb.challonge.com/en/article/score-reporting-for-matches-in-progress-wzkonk/)).
  Remis w round robin jest jawny (`tie: true`).
- **Toornament:** `pending`, `running`, `completed` — **liczone z danych**,
  nie ustawiane: `running`, gdy pojawi się jakikolwiek wynik, `completed`
  przy pełnym poprawnym rezultacie
  ([Match](https://developer.toornament.com/v2/core-concepts/match/)).
- **LeagueRepublic:** statusy Normal, Cancelled, Postponed, Home/Away
  Walkover, Home/Away Win Penalties, Abandoned, Void; osobno status daty
  Normal/To Be Confirmed
  ([Glossary](https://help.leaguerepublic.com/en/articles/8805164-the-language-of-leaguerepublic-a-handy-glossary-for-beginners),
  [Read API](https://docs.api.leaguerepublic.com/leaguerepublic-read-api.md)).
- **SportsEngine:** Unscheduled, Scheduled, In Progress, Completed,
  Postponed, Canceled, Delayed, Deleted
  ([Schedule games](https://help.sportsengine.com/en/articles/6345474-season-management-how-to-schedule-games-events));
  wpisanie wyniku i zakończenie meczu to osobne kroki (checkbox „Set scored
  games to completed",
  [Scoring](https://help.sportsengine.com/en/articles/7198583-season-management-scoring-adding-stats)).
- **LeagueApps:** wynik ma wariant Final, Final (OT), Cancelled,
  Rescheduled, Forfeit (wskazuje się „zwycięzcę"); checkbox wyłącza mecz z
  tabeli
  ([Updating scores](https://support.leagueapps.com/hc/en-us/articles/360039864233-Updating-Scores-Standings));
  w turnieju walkower obustronny
  ([Schedule tournaments](https://support.leagueapps.com/hc/en-us/articles/10579170260119-How-do-I-schedule-tournaments)).
- **TeamSnap:** stanów wyniku nie wymieniono; odwołanie to checkbox;
  walkower zapisuje się jako wynik, np. 1–0
  ([Enter game results](https://helpme.teamsnap.com/article/594-enter-game-results),
  [Cancel or delete](https://helpme.teamsnap.com/article/979-cancel-or-delete-games-and-events)).
- **Tournify:** stanów meczu **nie opisano**; wyniki i tabela aktualizują
  się w czasie rzeczywistym
  ([Getting started](https://help.tournifyapp.com/en/articles/15069302-getting-started-with-tournify)).

### 6.2. Wynik na żywo a tabela

- **LeagueRepublic:** wynik zapisuje się jako „Latest Score" (na żywo) albo
  „Final Score"; **Latest nie wpływa na tabelę**, Final tak (po akceptacji,
  jeśli włączona); wyłączenie funkcji kasuje wyniki Latest
  ([How live results work](https://help.leaguerepublic.com/en/articles/1149069-how-live-results-work-in-leaguerepublic)).
- **SportsEngine:** „Games Played" liczy tylko mecze „Completed"
  ([Standings options PDF](https://sportsengine-docs.s3.amazonaws.com/SportsEngine/One_Pager/Different_Types_of_Standings_Options.pdf));
  live scoring w starszym produkcie tylko dla trzech sportów, kończy się
  „Finalize Game"
  ([How to score live](https://help.sportsengine.com/en/articles/6314563-how-to-score-live)).
- **TeamSnap:** „TeamSnap Live!" to okno wyniku i czatu na poziomie drużyny,
  otwarte od godziny przed startem
  ([TeamSnap Live](https://helpme.teamsnap.com/article/211-using-teamsnap-live-chat-and-scoring)).

### 6.3. Edycja i cofanie zakończonego wyniku

- **Challonge:** ponowne otwarcie zakończonego meczu **automatycznie resetuje
  mecze, które z niego wynikają**
  ([Reopen a match](https://challonge.apidog.io/reopen-a-match-23832652e0.md),
  [Edit match results](https://kb.challonge.com/en/article/how-to-edit-match-results-1bf545k/)).
- **Toornament:** walidacja grupy buduje ranking końcowy i blokuje mecze;
  edycja wymaga cofnięcia walidacji. W drabince mecz blokuje się, gdy
  uczestnik zagrał kolejny
  ([My matches are locked](https://help.toornament.com/faq/my-matches-are-locked-why),
  [Group validation](https://help.toornament.com/match/group-round-validation)).
- **LeagueRepublic:** zablokowanych („locked") wyników nie zmienią
  administratorzy drużyn; blokada wyniku i statystyk osobno; opcjonalna
  akceptacja — do niej wynik jest ukryty, a tabela bez zmian
  ([Enter results, approve and lock](https://help.leaguerepublic.com/en/articles/2630955-how-to-enter-results-approve-and-lock)).
- **Tournify:** administrator może edytować albo wyczyścić wynik
  ([Process results](https://help.tournifyapp.com/en/articles/8954782-process-results));
  sędzia po zapisaniu już nie
  ([Let referees enter scores](https://help.tournifyapp.com/en/articles/8925192-let-referees-enter-scores)).
- **SportsEngine (starszy produkt):** zmiana typu tabeli w trakcie wymaga
  cofnięcia zakończonych meczów do „Scheduled" i ponownego wpisania
  ([Update standings after games finalized](https://help.sportsengine.com/en/articles/6326216-how-to-update-your-standings-after-games-have-been-finalized-league)).
- **TeamSnap:** administrator drużyny może zmienić wynik „w każdej chwili"
  ([Team schedule permissions](https://helpme.teamsnap.com/article/1088-manage-organization-team-schedule-permissions)).

### 6.4. Kto wpisuje

Wszędzie organizator. Dodatkowo: sędziowie i drużyny przez linki z
pięciominutowym oknem sporu (Tournify,
[Let teams enter scores](https://help.tournifyapp.com/en/articles/8909460-let-teams-or-players-enter-scores));
role z nadpisywalnymi uprawnieniami (LeagueRepublic,
[Roles and security](https://help.leaguerepublic.com/en/articles/981503-roles-and-security));
uczestnicy z możliwością sporu, który cofa walidację do decyzji admina
(Toornament,
[Participant match reporting](https://help.toornament.com/match/participant-match-reporting));
kapitanowie najwcześniej godzinę po starcie (LeagueApps,
[Scores as team captain](https://support.leagueapps.com/hc/en-us/articles/360039864253-How-to-Input-Scores-as-a-Team-Captain)).
Historii zmian wyniku nie opisuje żadna aplikacja.

## 7. Tiebreaki i punktacja

W/R/P = punkty za wygraną, remis i porażkę.

| Aplikacja | Punktacja | Kryteria i kolejność | Head-to-head przy 3+ | Gdy wszystko równe |
|---|---|---|---|---|
| Tournify | W/R/P konfigurowalne, warianty (wygrana różnicą N, remis po karnych itd.) ([Scoring and tiebreakers](https://help.tournifyapp.com/en/articles/8955366-scoring-and-tiebreakers)) | różnica, strzelone, head-to-head, wygrane, średnia pkt, najmniej straconych, czyste konta, statystyki własne; dowolna kolejność (przeciąganie) (tamże) | mała tabela remisujących: punkty, różnica, strzelone między nimi; domyślnie (UEFA) ponowne zastosowanie dla pozostałych, opcja (FIFA) przejście do kryteriów ogólnych ([Head-to-head](https://help.tournifyapp.com/en/articles/11554158-how-head-to-head-tiebreakers-work)) | nie opisano; ręczne punkty ± w tabeli ([FAQ Results](https://help.tournifyapp.com/en/articles/9145357-faq-results)) |
| LeagueRepublic | W/R/P, punkty za zdobyte/stracone, nadpisania wyników, bonusy ([Ranking](https://help.leaguerepublic.com/en/articles/639763-changing-the-way-the-standings-are-ranked), [Bonus points](https://help.leaguerepublic.com/en/articles/5527305-how-do-i-award-bonus-points-to-a-team)) | 1., 2., 3. kryterium z listy (pełna lista tylko na zrzutach) (Ranking) | head-to-head wymienione ([Getting started](https://help.leaguerepublic.com/en/articles/2127201-getting-started-guide-setting-up-your-league-in-leaguerepublic)), działanie nie opisane | nie opisano; wymuszenie pozycji ręcznie ([Adjust standings](https://help.leaguerepublic.com/en/articles/634277-can-i-manually-adjust-the-standings)) |
| Challonge | punkty za wygraną (1.0) i remis (0.5) meczu i gry; pola za porażkę brak ([Create tournament](https://challonge.apidog.io/create-tournament-23619740e0.md)) | do 3 tiebreaków w kolejności, m.in. „match wins vs tied" (tamże) | ranking wg zwycięstw między remisującymi ([Rank and tie-break](https://kb.challonge.com/en/article/rank-and-tie-break-statistics-1p5f7y4/)) | nie opisano; ręczne punkty tiebreak (tamże) |
| Toornament | kalkulatory: wynik (domyślnie 3/1/0), miejsce, zdobycze, pauza, walkower (może być ujemny) ([Calculators](https://developer.toornament.com/v2/core-concepts/structure/rankings/calculators)) | ogólne i head-to-head: punkty, wynik, walkower, zdobyte, stracone, różnica; mniej/więcej rozegranych, **manual**, **random**; od góry do dołu ([Tiebreakers](https://developer.toornament.com/v2/core-concepts/structure/rankings/tiebreakers), [help](https://help.toornament.com/match/the-tiebreakers)) | porównanie wyników z pozostałymi remisującymi; jeśli dwóch dalej równych — przeliczenie tylko dla nich (help) | `random` przelicza się po każdym remisowym meczu; bez niego wspólny `rank`, unikalny `position` tylko do wyświetlania ([Ranking items](https://developer.toornament.com/v2/doc/organizer_ranking_items)) |
| SportsEngine | presety (np. piłka 3/1, hokej IIHF) i własne W/R/P; nadpisanie punktów per mecz ([PDF](https://sportsengine-docs.s3.amazonaws.com/SportsEngine/One_Pager/Different_Types_of_Standings_Options.pdf), [Upload fields](https://help.sportsengine.com/en/articles/6310600-schedule-upload-fields-reference-guide)) | kryteria i reguły tiebreak w ustawieniach ([Standings settings](https://help.sportsengine.com/en/articles/7198563-season-management-standings-statistics-scoring-settings)); pełnej listy brak | IIHF: „head-to-head wins" (PDF), dla 3+ nie opisano | ręczne wskazanie przez kontakt z supportem ([Tool settings](https://help.sportsengine.com/en/articles/6325486-how-to-access-tool-settings)) |
| LeagueApps | W, OT W/L, odjęcie za walkower ([Standings rules](https://support.leagueapps.com/hc/en-us/articles/360039864993-Customize-Standings-Rules)) | trzy etapy Primary/Secondary/Fallback z listy (tamże) | opisane tylko dla dwóch drużyn (tamże) | nie opisano |
| TeamSnap (Tournaments) | system punktów automatyczny, wartości niewymienione; limit różnicy bramek ([Tournament settings](https://helpme.teamsnap.com/article/201-manage-tournament-event-settings)) | 9 kryteriów, przeciąganie, od góry (tamże) | osobne kryteria: „Head to Head" (2+), „Two Teams Only", „Head to Group" (3+, % zwycięstw w grupie remisujących), różnica tylko między remisującymi (tamże) | nie opisano |

## 8. Zestawienie per aplikacja

Jedno zdanie na pytanie, szczegóły i źródła w §2–§7.

| | Generowanie ligi | Ponowne generowanie | Drużyna wycofana | Kolizje | Stany / edycja wyniku | Tiebreaki |
|---|---|---|---|---|---|---|
| **Tournify** | 1–2× każdy z każdym; ręczne planowanie kolejka po kolejce na boiska z godziną startu i jednym „Match duration" | kłódka; nadpisania nie cofniesz; skutki dla wyników nie opisane | „No show": mecze ukryte, drużyna znika z tabeli; walkower = fikcyjny wynik | nie opisane (sędzia wprost niechroniony) | stanów brak w opisie; admin edytuje i czyści wynik | dowolna kolejność; head-to-head z małą tabelą i opcją UEFA/FIFA |
| **LeagueRepublic** | 1–4×; dwa generatory (szablon / zaawansowany z dostępnością), sloty, daty wyłączone, „To Be Confirmed" | akceptuj/odrzuć; dopełnienie braków; usuwanie hurtowe | opcje przy usuwaniu istnieją, niewymienione; korekty tabeli ręczne | generator nie dubluje; UI ostrzega, IGNORE | 9 statusów wyniku; Latest vs Final; akceptacja i blokada | 3 kryteria z listy; head-to-head bez opisu działania |
| **Challonge** | 1–3×, rozstawienie/losowanie; brak automatycznego rozkładu w czasie, „stations" | reset kasuje wyniki | usunięcie w trakcie = walkower we wszystkich pozostałych meczach | nie opisane | pending/open/complete + underway; ponowne otwarcie resetuje mecze zależne | do 3; zwycięstwa między remisującymi; ręczne punkty |
| **Toornament** | standard / podwójny / ręczne pary; termin per mecz albo hurtowo; strefa IANA | zmiana struktury resetuje mecze fazy, rozstawienie zostaje | walkower per mecz, punkty za walkower konfigurowalne | nie opisane | pending/running/completed liczone z danych; walidacja grupy blokuje | ogólne i H2H, manual, random; wspólny `rank` |
| **SportsEngine** | liczba meczów na drużynę, sloty na obiektach, reguły odpoczynku i dat | zmiana reguł nie przesuwa meczów | nie da się usunąć drużyny z meczami | ikona ostrzeżenia, szczegóły konfliktu | 8 stanów; wynik i zakończenie osobno | presety i własne; remis absolutny przez support |
| **LeagueApps** | meczów na drużynę i na tydzień, dni, godziny, obiekty | ponownie przed akceptacją; usunięcie nieodwracalne | nie opisane | w turnieju blokada; w lidze nie opisane | Final/OT/Cancelled/Rescheduled/Forfeit; wykluczenie z tabeli | Primary/Secondary/Fallback; H2H dla dwóch |
| **TeamSnap** | dni, godziny, sloty, daty wyłączone; liczba meczów nie opisana | zmiana dat ukrywa, nie kasuje meczów | retire albo usuń; z wynikiem — nie (Tournaments) | obiekt, drużyna, trener; twarde vs miękkie | stanów brak; walkower jako wynik | 9 kryteriów, osobno H2H dla 2 i 3+ (Tournaments) |

## 9. Czego dokumentacja nie mówi

Zebrane z całego badania. „Nie opisano" znaczy: nie znaleziono w źródłach z §0,
a nie: aplikacja tego nie robi.

- **Algorytm kojarzenia par** (metoda kołowa czy inna), kolejność kolejek i
  przydział gospodarza — żadna aplikacja.
- **Kolejność drużyn i losowanie przy generowaniu ligi** — żadna z
  aplikacji ligowych (Tournify, LeagueRepublic, SportsEngine, LeagueApps,
  TeamSnap); Challonge i Toornament opisują tylko rozstawienie.
- **Pauza w nieparzystej lidze** — Challonge nie opisuje; Toornament ma typ
  meczu `bye`, ale punkty za pauzę help przypisuje systemowi szwajcarskiemu.
- **Strefa czasowa** — Tournify, SportsEngine, TeamSnap nie opisują;
  LeagueApps tylko przy rejestracji; LeagueRepublic tylko w API.
- **Co ponowne generowanie robi z wpisanymi wynikami i ręcznymi
  przesunięciami** — żadna aplikacja ligowa. Challonge i Toornament mówią
  jedynie, że reset kasuje wszystko.
- **Czy zmiana długości meczu albo godziny startu przesuwa zaplanowane
  mecze** — Tournify nie opisuje.
- **Skutki usunięcia drużyny dla jej rozegranych meczów i tabeli** —
  Tournify, LeagueRepublic (opcje są, ale niewymienione), LeagueApps,
  Challonge (round robin), Toornament (poza walkowerem w meczu).
- **Jak walkower, mecz przerwany i unieważniony liczą się w tabeli** —
  LeagueRepublic; SportsEngine nie ma statusu walkowera.
- **Czy kolizja blokuje zapis** — LeagueRepublic (jest tylko przycisk
  IGNORE na zrzucie), SportsEngine; Tournify, Challonge, Toornament w ogóle
  nie opisują wykrywania kolizji.
- **Stany meczu** — Tournify; „w trakcie" — LeagueApps, TeamSnap.
- **Historia zmian wyniku** — żadna aplikacja.
- **Head-to-head przy 3+ drużynach** — LeagueRepublic, SportsEngine,
  LeagueApps.
- **Co, gdy wszystkie kryteria równe** — Tournify, LeagueRepublic, Challonge,
  LeagueApps, TeamSnap; SportsEngine odsyła do supportu; jedynie Toornament
  opisuje losowanie i wspólne miejsce.
