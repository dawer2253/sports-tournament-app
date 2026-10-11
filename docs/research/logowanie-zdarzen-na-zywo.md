# Logowanie zdarzeń na żywo (sędzia stolikowy)

Badanie na potrzeby ticketu
[#189 „S3: research — logowanie zdarzeń na żywo (sędzia stolikowy)"](https://github.com/dawer2253/sports-tournament-app/issues/189)
(mapa [#187 „Mapa: S3 — eventy i strona publiczna"](https://github.com/dawer2253/sports-tournament-app/issues/187)).
Data: 11 października 2026.
Precedens formy: [`docs/research/terminarz-w-aplikacjach-turniejowych.md`](terminarz-w-aplikacjach-turniejowych.md).

**Ten plik ustala fakty, nie podejmuje decyzji.** Opisuje, co publiczna
dokumentacja aplikacji prowadzących rozgrywki na żywo mówi o wpisywaniu
zdarzeń meczowych przez operatora przy stoliku: sposobie wpisywania (jedno
kliknięcie, presety, skróty), korekcie i cofaniu, wielu operatorach
i uprawnieniach, zachowaniu zdarzeń przy przejściu meczu w stan zakończony
oraz o tym, czy liczba zdarzeń bywa weryfikowana wobec wyniku. Nie wskazuje,
którą drogą pójść — to należy do ticketów decyzyjnych pod mapą. Terminy
domenowe według [`CONTEXT.md`](../../CONTEXT.md): mecz (Match), zdarzenie
meczowe (MatchEvent), zdobycze (Score), organizer (Organizer). Tam, gdzie
aplikacja używa własnej nazwy (np. „action" w FIBA LiveStats, „rally"
w e-Scoresheet), podaję ją w cudzysłowie.

## 0. Źródła i metoda

Wyłącznie strony pierwszej strony (centra pomocy, dokumentacja techniczna,
podręczniki producenta, karty produktu), czytane publicznie, bez zakładania
kont:

| Aplikacja | Co to jest | Źródła |
|---|---|---|
| GameChanger | prowadzenie statystyk i relacji dla drużyn amatorskich i szkolnych (baseball, softball, koszykówka, siatkówka, futbol, hokej i in.) | [help.gc.com](https://help.gc.com/hc/en-us), wpisy na [gc.com](https://gc.com/) |
| e-Scoresheet (Data Project / Genius Sports) | oficjalny elektroniczny protokół meczu siatkówki, używany przez sędziów i stolik na turniejach federacyjnych (FIVB, CEV) | podręcznik producenta [eScoreManual.pdf](https://volleyboll.se/download/18.3cd01bd8185c4d85a0e8d9d9/1674563246426/eScoreManual.pdf), karta [e-Scoresheet Tablet](https://play.google.com/store/apps/details?id=it.dataproject.eScoreSheetTablet) |
| FIBA LiveStats (Genius Sports) | oprogramowanie stołu statystycznego do koszykówki, dystrybuowane przez FIBA | [dokumentacja feedu LiveStats In-Arena](https://developer.geniussports.com/livestats/tvfeed/index_basketball.html), [strona FIBA LiveStats](https://about.fiba.basketball/en/services/data-and-video-solutions/fiba-live-stats) |
| Torneo by Sofascore | darmowe narzędzie organizera od Sofascore do tworzenia i prowadzenia rozgrywek | [torneo-sofascore.helpscoutdocs.com](https://torneo-sofascore.helpscoutdocs.com/) |
| Tournify | generator i prowadzenie turniejów amatorskich (piłka, siatkówka, darty i in.) | [help.tournifyapp.com](https://help.tournifyapp.com/en/), strony funkcji [tournifyapp.com](https://tournifyapp.com/en/features/scorekeeping) |
| Toornament | platforma turniejowa (głównie esport) | [help.toornament.com](https://help.toornament.com/) |
| Challonge | drabinki i ligi turniejowe | [kb.challonge.com](https://kb.challonge.com/en/) |
| SportsEngine | system zarządzania ligami i klubami; producent ma trzy narzędzia do wyniku: Sport Management, Season Management i SportsEngine Play | [help.sportsengine.com](https://help.sportsengine.com/en/), [help.sportsengineplay.com](https://help.sportsengineplay.com/en/) |
| TeamSnap | zarządzanie drużynami i rozgrywkami | [helpme.teamsnap.com](https://helpme.teamsnap.com/) |

Ograniczenia:

- **Nic nie było klikane w samych aplikacjach.** Każde zdanie to odczyt
  dokumentacji, nie obserwacja zachowania. Dokumentacja często mówi, gdzie jest
  przycisk, a milczy o skutkach — te luki zbiera §8.
- Dwa podręczniki są PDF-ami pobranymi i odczytanymi lokalnie (e-Scoresheet,
  Statisticians' Manual FIBA). Podręcznik użytkownika FIBA LiveStats v5 jest
  w serwisach zewnętrznych za blokadą (Manualzz zwraca 403, Scribd wymaga
  konta) — **nie został przeczytany**; o edycji zdarzeń w LiveStats mówi tylko
  dokumentacja feedu telewizyjnego.
- Aplikacje konsumenckie typu FlashScore i Sofascore (sama aplikacja wynikowa)
  **nie były w zakresie**: nie mają operatora wpisującego zdarzenia meczu.
  Sofascore ma natomiast osobne narzędzie dla organizera (Torneo), które jest
  w tabeli, oraz funkcję „crowdsourcingu", opisaną w §4.
- Dokumentacja marketingowa (strony funkcji producenta) jest traktowana jako
  źródło o tym, co producent deklaruje, a nie o mechanice.

## 1. Streszczenie

- **Są dwa światy i różnica jest strukturalna.** Jeden to aplikacje
  „zdarzeniowe": operator wpisuje kolejne akcje/zagrania, a wynik jest z nich
  liczony (GameChanger, e-Scoresheet, FIBA LiveStats). Drugi to aplikacje
  „wynikowe": nie ma zdarzeń, wpisuje się sam wynik lub sety (Toornament,
  Challonge, SportsEngine, TeamSnap, Tournify, Torneo w trybie wyniku).
  Aplikacje z rodziny turniejowej (Toornament, Challonge, Tournify) **nie mają
  w ogóle zdarzeń meczowych** — mają wynik. Pojedyncze zdarzenie (bramka,
  kartka) pojawia się tam jako opcjonalna statystyka gracza, obok wyniku,
  w osobnym kroku (Tournify, Torneo).
- **Wpisywanie to w praktyce klikanie presetu albo skrót klawiszowy.**
  e-Scoresheet ma „Assign point key" i konfigurowalne skróty klawiszowe dla
  faz gry; przyciski mają osobne akcje (punkt, time-out, zmiana, sankcja,
  libero). GameChanger to wybór zagrania z listy, a w koszykówce „tapnij
  zawodnika, tapnij statystykę". FIBA LiveStats wpisuje typ i podtyp akcji.
  SportsEngine Play ma „preset scoring options".
- **Korekta jest standardem, historia — nie.** Undo ostatniej akcji ma
  e-Scoresheet (z oknem potwierdzenia), GameChanger (koszykówka: „Undo"
  i „Delete"), Torneo (edycja/usunięcie zdarzenia), Tournify (edycja
  i wyczyszczenie wyniku). Edycja zdarzenia z przeszłości działa w GameChanger
  (ograniczona do wybranych uczestników i wyników zagrania) i w Torneo.
  **Widocznej historii zmian nie opisuje żadna aplikacja poza e-Scoresheet**
  („technical comments" to wyłącznie lista ręcznych zmian, tylko do odczytu)
  i feedem FIBA LiveStats (znaczniki czasu edycji/wstawienia/usunięcia akcji).
- **Wielu operatorów: uprawnienia tak, uzgadnianie konfliktów prawie nigdy.**
  Toornament ma granularne uprawnienia (m.in. „Report results"), GameChanger —
  model ról (Staff / wszyscy potwierdzeni / tylko wybrani), Tournify — linki
  logowania dla sędziów i drużyn oraz podzbiór uprawnień administratora,
  SportsEngine — „Full/Limited Access". **Żadna aplikacja nie opisuje
  automatycznego łączenia dwóch równoczesnych wpisów**; jedyne mechanizmy to
  nadpisanie przez admina (Tournify) albo spór i rozstrzygnięcie admina
  (Toornament). SportsEngine wprost radzi, by przy jednym meczu pracowała
  jedna osoba.
- **Zamknięcie meczu zwykle da się cofnąć, ale nie zawsze.** GameChanger ma
  „Resume Scoring" na zakończonym meczu (z zamrożoną „Recap Story"),
  Torneo — osobny tryb „Post-match editing", e-Scoresheet — zatwierdzenie
  protokołu hasłami sędziego i supervisora. Tournify domyślnie **zabrania**
  edycji po zamknięciu fazy, Toornament blokuje mecze po walidacji grupy.
- **Spójności liczby zdarzeń z wynikiem nie pilnuje nikt jako reguły.**
  Tam, gdzie wynik **liczy się** ze zdarzeń (e-Scoresheet, FIBA LiveStats,
  GameChanger), rozjazd jest niemożliwy z definicji. Tam, gdzie wynik wpisuje
  się osobno (Tournify, SportsEngine, TeamSnap, Toornament, Challonge,
  Torneo), zdarzenia są osobnym bytem i **żadna dokumentacja nie opisuje
  kontroli „suma bramek = wynik"**.

## 2. Jak wpisuje się zdarzenie (jedno kliknięcie, presety, skróty, telefon)

- **e-Scoresheet:** punkt przypisuje się „Assign point key" albo klawiszem
  funkcyjnym, który wcześniej przypisano do tej funkcji; osobne przyciski mają
  time-out, zmiana, sankcja, libero, protest
  ([podręcznik, §5 „Assigning a Point"](https://volleyboll.se/download/18.3cd01bd8185c4d85a0e8d9d9/1674563246426/eScoreManual.pdf)).
  Sekcja „Shortcut" pozwala przypisać klawisz lub kombinację klawiszy do fazy
  gry. Ten sam podręcznik opisuje aplikację **e-Scoresheet Tablet**, łączącą
  się z głównym programem w modułach „Bench", „Referee" i „Press": „Referees
  to follow the match events in real time and […] Teams to submit legit game
  requests" (karta w Google Play). Sędzia przy stoliku pracuje więc na
  tablecie, a dane płyną do protokołu.
- **GameChanger:** prowadzi „Play by Play"; operator wybiera wynik zagrania
  z listy. W koszykówce opis jest wprost „tapnij, aby przypisać": „Use the
  Play by Play section to correct any mistakes", a zmianę zawodnika lub wyniku
  robi się, tapując konkretne zagranie
  ([Edit Plays Basketball](https://help.gc.com/hc/en-us/articles/30557078509709-Edit-Plays-Basketball)).
  W baseballu do wyboru jest m.in. zbiór dopuszczalnych wyników zagrania
  ([Editing Past Plays](https://help.gc.com/hc/en-us/articles/360031203911-Editing-Past-Plays)).
  Aplikacja działa na iOS i Androidzie — scoring idzie z telefonu/tabletu.
- **FIBA LiveStats:** operator wpisuje akcję jako typ i podtyp ze
  zdefiniowanej listy (np. `2pt`/`dunk`, `3pt`/`stepbackjumpshot`,
  `foul`/`personal`, `substitution`/`in`), z wartościami i współrzędnymi
  ([Action Types](https://developer.geniussports.com/livestats/tvfeed/index_basketball.html)).
  W tej samej dokumentacji występują dwie role przy stole: `statisticianType`
  = `OPERATOR` („The person entering the statistics") i `CALLER` („The person
  calling the statistics"). Program chodzi na komputerze w hali (feed po LAN),
  więc przy stoliku jest stacja, a nie telefon.
- **SportsEngine Play** (streaming): „preset scoring options" w nakładce
  wyniku, czas gry strzałkami
  ([How to Manually Score](https://help.sportsengineplay.com/en/articles/6825310-how-to-manually-score)).
  Przy sprzęcie **Scorebird** wynik i period idą automatycznie z tablicy hali —
  operator w ogóle nie wpisuje zdarzeń
  ([Scorebird](https://help.sportsengineplay.com/en/articles/6825306-how-to-score-automatically-with-a-scorebird-device)).
- **TeamSnap Live!:** wynik zmienia się tapnięciem pola drużyny i przełączaniem
  wartości, a baseball ma sportowy tracker (B/S/O, inningi). To okno czatu
  i wyniku na poziomie drużyny, „aktywne godzinę przed startem"
  ([Using TeamSnap Live!](https://helpme.teamsnap.com/article/211-using-teamsnap-live-chat-and-scoring)).
- **Torneo by Sofascore:** tryb „Live edit" opisuje wprost cztery rodzaje
  zdarzeń: „enter goals, cards, substitutions, and penalties as they happen"
  ([Live editing](https://torneo-sofascore.helpscoutdocs.com/article/219-live-editing)).
- **Tournify:** wynik wpisuje się przyciskiem „Score"; statystyki gracza
  (gol, żółta/czerwona kartka lub własne) włącza się osobno i wpisuje razem
  z wynikiem meczu. Panel administratora jest „fully responsive", wprost
  polecany na telefonie i tablecie
  ([Enter scores](https://help.tournifyapp.com/en/articles/9144326-enter-scores),
  [Track player statistics](https://help.tournifyapp.com/en/articles/8909418-track-player-statistics)).
  Strona funkcji mówi o wpisywaniu „sometimes just a single click"
  (cytat klienta na stronie producenta — to marketing, nie specyfikacja).
- **Toornament, Challonge:** **brak zdarzeń meczowych.** Toornament zna tylko
  pojęcia „Match Result" i „Match Score" oraz „Game Result"/„Game Score"
  (set/gry w meczu), bez zdarzeń w ich obrębie
  ([Difference between Result & Score](https://help.toornament.com/match/difference-between-result-score),
  [Define your Match Format](https://help.toornament.com/match/define-your-match-format)).
  Challonge pozwala wpisać wynik/sety, dodać set i potwierdzić zwycięzcę
  ([Score Reporting For Matches In-Progress](https://kb.challonge.com/en/article/score-reporting-for-matches-in-progress-wzkonk/)).
- **SportsEngine HQ:** Live Scoring wpisuje zagrania pojedynczo i generuje
  relację „play-by-play" oraz statystyki, ale **tylko dla futbolu, hokeja
  i lakrosse'a**; inne sporty mają Quick Score (sam wynik) albo Tabular Stats
  ([How to Score Live](https://help.sportsengine.com/en/articles/6314563-how-to-score-live)).

## 3. Korekta zdarzenia i cofanie

| Aplikacja | Cofnięcie ostatniego | Edycja zdarzenia z przeszłości | Usunięcie | Historia |
|---|---|---|---|---|
| GameChanger | „Undo" ([Edit Plays Basketball](https://help.gc.com/hc/en-us/articles/30557078509709-Edit-Plays-Basketball)) | tak, tapnięcie zagrania; ograniczone: tylko wybrane wyniki i uczestnicy ([Editing Past Plays](https://help.gc.com/hc/en-us/articles/360031203911-Editing-Past-Plays)) | „Delete" (koszykówka) | brak opisanej |
| e-Scoresheet | „Undo" z oknem potwierdzenia anuluje poprzednią akcję; osobny „Replay" cofa/powtarza wymianę ([podręcznik, §13, §16](https://volleyboll.se/download/18.3cd01bd8185c4d85a0e8d9d9/1674563246426/eScoreManual.pdf)) | przez cofanie kolejnych akcji | przez cofanie | „technical comments": lista ręcznych zmian, tylko do odczytu |
| FIBA LiveStats | nie opisano UI; feed ma pola `editeddatetime`, `inserteddatetime`, `deleteddatetime`, `origMessageId` ([feed](https://developer.geniussports.com/livestats/tvfeed/index_basketball.html)) | akcja może dostać znacznik edycji; można ją „wstawić" poza kolejnością | znacznik usunięcia | znaczniki czasu w feedzie |
| Torneo | „Edit or delete details if a mistake is made"; „Errors can be corrected by editing or deleting individual events" ([Live editing](https://torneo-sofascore.helpscoutdocs.com/article/219-live-editing)) | tak | tak | brak opisanej |
| Tournify | nie opisano osobnego undo; wynik można edytować lub wyczyścić ([Process results](https://help.tournifyapp.com/en/articles/8954782-process-results)) | tak (admin) | „clear the result" | brak opisanej |
| TeamSnap | brak undo; wynik przełącza się jak przy wpisywaniu | tak (przełączenie wartości) | brak opisu | brak opisanej |
| SportsEngine | brak opisu undo; nie można zmienić metody punktowania dla jednego meczu ([How to Score Live](https://help.sportsengine.com/en/articles/6314563-how-to-score-live)) | edycja statystyk i wyniku po fakcie (Quick Score / Tabular Stats / Edit Stats) | brak opisu | brak opisanej |
| Toornament | edycja wyniku; mecz zablokowany po walidacji grupy ([Group & Round Validation](https://help.toornament.com/match/group-round-validation)) | tak | przez zmianę wyniku | brak opisanej |
| Challonge | „all scores (and sets) can be updated and edited as frequently as necessary" ([In-Progress](https://kb.challonge.com/en/article/score-reporting-for-matches-in-progress-wzkonk/)) | tak | tak (nadpisanie) | brak opisanej |

Uwagi do tabeli:

- **e-Scoresheet** traktuje akcje jako ciąg i cofa wyłącznie ostatnią, z jawnym
  pytaniem o potwierdzenie; „Replay" jest przeznaczony na zmianę decyzji sędziego
  o wymianie. Podręcznik opisuje także blokadę: mniej niż 8 sekund od
  poprzedniego punktu wywołuje ostrzeżenie i prosi o wybór.
- **GameChanger** ma jawną pułapkę opisaną w dokumentacji: „Since the app will
  only sync while the game is being scored, edits should be made prior to the
  game being finalized"; nie każdy zawodnik pojawi się przy edycji i nie każde
  zagranie da się edytować. Edycja zawodnika ofensywnego dotyczy jednego
  minionego zagrania, defensywnego — „for the remainder of the game".
- **FIBA LiveStats** to jedyne źródło, które wprost modeluje edycję, wstawienie
  i usunięcie akcji (znaczniki czasu + `origMessageId` odsyłający do pierwotnej
  wiadomości). To dowód z kontraktu danych, że edycja zdarzeń istnieje, ale
  **nie opisuje interfejsu operatora**.
- **Tournify** rozdziela role: sędzia lub drużyna **nie mogą** zaktualizować
  wyniku po wysłaniu, a administrator może wynik sędziego „overrule"
  ([Let referees enter scores](https://help.tournifyapp.com/en/articles/8925192-let-referees-enter-scores)).

## 4. Wielu operatorów i uprawnienia

- **Toornament** ma najbardziej rozbudowany model: osobne uprawnienie
  „Report results" daje dostęp do menu Matches i edycji wyników, a obok niego
  „Administrate tournament", „Setup structure", „Manage participants",
  „Place participants" i inne. Dokumentacja radzi trzymać co najmniej dwa
  poziomy (head admini + reszta) i „All admins should probably be able to
  Report results"
  ([Manage your Admins Permissions](https://help.toornament.com/organizer/manage-your-admins-permissions)).
  Do tego dochodzi raportowanie przez uczestników z **sporem**: drugi uczestnik
  może zakwestionować raport, mecz staje się „unvalidated", a admin rozstrzyga,
  wpisując własny raport; decyzji admina nie da się już zakwestionować, ale
  można ją później edytować
  ([Participant Match Reporting](https://help.toornament.com/match/participant-match-reporting)).
- **GameChanger:** uprawnienia „Scorekeepers" ustawia się na „All confirmed
  members" albo „Only selected members"; domyślne zależą od sportu (Staff dla
  baseballa/softballu, Confirmed members dla pozostałych), a wyznaczony
  scorekeeper nie musi mieć roli Staff. W lidze/turnieju **jeden** scorekeeper
  może prowadzić mecz obu drużyn naraz („Head-to-Head scoring")
  ([Scorekeeping Permissions](https://help.gc.com/hc/en-us/articles/33827901166605-Scorekeeping-and-Live-Streaming-Permissions),
  [League and Tournament Scorekeeping](https://help.gc.com/hc/en-us/articles/5997544631309-League-and-Tournament-Scorekeeping)).
- **Tournify:** administrator może dostać uprawnienie „enter scores" **bez**
  prawa zmiany formatu czy terminarza; sędziowie i drużyny dostają unikalne
  linki logowania **bez hasła** („no password needed"). Statystyk graczy przez
  linki **nie da się** wpisywać — wtedy wyłącznie panel admina. Nagłówek
  „Dealing with conflicts" w artykule o linkach drużyn jest **pusty**
  ([Enter scores](https://help.tournifyapp.com/en/articles/9144326-enter-scores),
  [Let referees enter scores](https://help.tournifyapp.com/en/articles/8925192-let-referees-enter-scores),
  [Let teams or players enter scores](https://help.tournifyapp.com/en/articles/8909460-let-teams-or-players-enter-scores)).
- **e-Scoresheet:** role są rozdzielone fizycznie — osobne logowanie do usługi
  live, osobne moduły „Bench", „Referee" i „Press" na tablecie, a na końcu
  meczu protokół zatwierdzają **hasłami sędzia i supervisor**
  ([podręcznik, §22](https://volleyboll.se/download/18.3cd01bd8185c4d85a0e8d9d9/1674563246426/eScoreManual.pdf)).
- **FIBA LiveStats:** przy meczu pracuje dwóch statystyków o różnych rolach —
  `OPERATOR` (wpisuje) i `CALLER` (wywołuje zdarzenia); feed rozsyła dane
  do systemów zewnętrznych po LAN
  ([feed](https://developer.geniussports.com/livestats/tvfeed/index_basketball.html)).
- **SportsEngine:** do statystyk trzeba uprawnienia „Full Access" albo
  „Limited Access - Website"; przy live scoringu dokumentacja wprost radzi
  „having one person using Score Live is best"
  ([How to Score Live](https://help.sportsengine.com/en/articles/6314563-how-to-score-live)).
- **TeamSnap:** bez ról do wyniku — „Anyone on the team can change the score in
  real-time", z żartobliwym dodatkiem „Just make sure no one's fudging the
  results…" ([TeamSnap Live!](https://helpme.teamsnap.com/article/211-using-teamsnap-live-chat-and-scoring)).
- **Torneo / Sofascore:** crowdsourcing pozwala użytkownikom Sofascore
  **sugerować** zmiany zdarzeń („goals or cards") przez „Suggest Changes";
  akceptuje je admin Sofascore. W samym Torneo sugestie crowdsourcingowe
  **nie nadpisują** danych automatycznie — redaktor je przegląda i zatwierdza;
  przy częściowych danych meczu zaakceptowane sugestie mogą zostać zachowane
  ([Crowdsourcing on Sofascore](https://torneo-sofascore.helpscoutdocs.com/article/228-crowdsourcing-on-sofascore),
  [How crowdsourcing interacts with Torneo](https://torneo-sofascore.helpscoutdocs.com/article/229-how-crowdsourcing-interacts-with-torneo)).

**Konflikt dwóch równoczesnych wpisów:** żadna z aplikacji powyżej nie opisuje
automatycznego scalenia ani blokady edycji ze względu na drugiego operatora.
Dostępne mechanizmy to nadpisanie (Tournify: admin nadpisuje wynik sędziego),
spór rozstrzygany przez admina (Toornament) albo wprost zalecenie pracy jednej
osoby (SportsEngine).

## 5. Zdarzenia przy meczu `live` a zamknięcie meczu

- **GameChanger:** mecz kończy się jawnie („Game Over"), powstaje
  niezmienialna „Recap Story". Do zakończonego meczu można wrócić przyciskiem
  **„Resume Scoring"** (na tym samym urządzeniu i koncie) i dopisywać zagrania;
  dokumentacja radzi wybrać „Exit Game" zamiast „End Game", jeśli przewiduje się
  powrót ([Finalizing Games](https://help.gc.com/hc/en-us/articles/360030865152-Finalizing-Games)).
- **Torneo by Sofascore:** tryb „Live edit" działa w trakcie meczu, a po jego
  zakończeniu wchodzi się w osobny tryb **„Post-match editing"** z wyborem:
  pełne szczegóły albo „Result Only Mode" (sam wynik). „Post-match edits may
  affect standings and statistics"
  ([Post-match editing](https://torneo-sofascore.helpscoutdocs.com/article/220-post-match-editing)).
- **e-Scoresheet:** koniec seta i koniec meczu są jawnymi krokami
  z potwierdzeniem; zamknięcie protokołu wymaga haseł sędziego i supervisora,
  a „technical notes" (ręczne zmiany) są od tego momentu **tylko do odczytu**.
  Dokumentacja nie opisuje ponownego otwarcia zamkniętego protokołu w tym
  podręczniku.
- **Tournify:** sędzia **nie może** zaktualizować wyniku po wysłaniu, a domyślnie
  wynik można wysyłać tylko dla fazy „currently in progress". Po zamknięciu fazy
  (kliknięcie „Start" dla następnej) wysyłanie wyników do wcześniejszych faz
  jest niemożliwe, chyba że wyłączy się opcję „Teams and referees can only
  submit results for matches in the current phase"
  ([Let referees enter scores](https://help.tournifyapp.com/en/articles/8925192-let-referees-enter-scores)).
- **Toornament:** po walidacji grupy/ligi mecze stają się **zablokowane**,
  a ustawienia wpływu na ranking (punktacja, tiebreaki, parowanie) nieedytowalne
  ([Group & Round Validation](https://help.toornament.com/match/group-round-validation)).
  Zmiana zakończonego wyniku jest możliwa, dopóki mecz nie jest zablokowany
  (por. także `docs/research/terminarz-w-aplikacjach-turniejowych.md`, §6.3).
- **SportsEngine:** wynik i zamknięcie meczu to osobne kroki (checkbox „Set
  scored games to completed"), a metoda punktowania jest przypisana do meczu na
  stałe („You are not able to use different scoring methods for a single game")
  ([How to Score Live](https://help.sportsengine.com/en/articles/6314563-how-to-score-live),
  [Scoring](https://help.sportsengine.com/en/articles/7198583-season-management-scoring-adding-stats)).
- **TeamSnap Live!:** okno żyje czasowo — aktywne godzinę przed startem do dwóch
  godzin po (albo pięć godzin od startu, gdy brak godziny końca); sam wynik
  końcowy wpisuje się osobno w zakładce Schedule
  ([TeamSnap Live!](https://helpme.teamsnap.com/article/211-using-teamsnap-live-chat-and-scoring),
  [Enter Game Results](https://helpme.teamsnap.com/article/594-enter-game-results)).
- **Challonge:** mecz „in progress" można raportować i edytować dowolną liczbę
  razy, bez wyłaniania zwycięzcy do końca
  ([In-Progress](https://kb.challonge.com/en/article/score-reporting-for-matches-in-progress-wzkonk/)).

## 6. Spójność liczby zdarzeń z wynikiem

- **Wynik liczony ze zdarzeń — rozjazd niemożliwy z definicji:**
  - e-Scoresheet: ostatni punkt kończy seta, wynik seta i meczu jest sumą
    przypisanych punktów;
  - FIBA LiveStats: każde zdarzenie niesie `score1`/`score2` „after this action
    is complete", a box score jest agregatem akcji;
  - GameChanger: edycja zagrania „will be reflected in the game's score and
    stats" ([Edit Plays Basketball](https://help.gc.com/hc/en-us/articles/30557078509709-Edit-Plays-Basketball)).
- **Wynik wpisywany osobno od zdarzeń — dwie niezależne dane:**
  - Tournify: wynik to jedno pole, a statystyki gracza (gole, kartki) to
    osobna, opcjonalna funkcja włączana na poziomie turnieju, wpisywana „razem
    z wynikiem meczu"; przez linki sędziów/drużyn statystyk wpisać nie można
    ([Track player statistics](https://help.tournifyapp.com/en/articles/8909418-track-player-statistics)).
  - SportsEngine: Live Scoring (zagrania + statystyki) to **jedna z metod**
    punktowania meczu, obok Quick Score i Tabular Stats; dla jednego meczu nie
    można ich mieszać, a Live Scoring jest tylko dla trzech sportów
    ([How to Score Live](https://help.sportsengine.com/en/articles/6314563-how-to-score-live)).
  - Torneo: zdarzenia wpisuje się w trybie live/post-match, a klasyfikacja
    liczona jest z wyniku; dokumentacja ostrzega tylko, że edycja może wpłynąć
    na tabelę i statystyki.
  - TeamSnap, Toornament, Challonge: wynik bez zdarzeń — nie ma czego
    porównywać.
- **Żadna dokumentacja nie opisuje jawnej kontroli „suma zdarzeń bramkowych =
  końcowy wynik"** ani ostrzeżenia, gdy się nie zgadzają. Jedyne pokrewne
  mechanizmy to ostrzeżenie Torneo, że edycja po meczu wpłynie na statystyki,
  oraz uwaga e-Scoresheet, że dokładne logowanie przekłada się na poprawne
  statystyki i tabelę.

## 7. Zestawienie per aplikacja

| | Zdarzenia? | Wpisywanie | Cofanie/edycja | Wielu operatorów | Po zamknięciu |
|---|---|---|---|---|---|
| **GameChanger** | tak, „Play by Play" | wybór zagrania; koszykówka: undo/delete/edycja | undo ostatniego, edycja wybranych zagran (z ograniczeniami), delete | uprawnienia Staff/wszyscy/wybrani; jeden scorekeeper na mecz (także dla obu drużyn) | „Resume Scoring" na zakończonym meczu |
| **e-Scoresheet** | tak, ciąg akcji siatkówki | „Assign point key" / skróty klawiszowe; tablet sędziego | „Undo" z potwierdzeniem, „Replay"; historia zmian tylko do odczytu | role: główny program + moduły Referee/Bench/Press; hasła sędziego i supervisora | zatwierdzenie protokołu hasłami; brak opisu ponownego otwarcia |
| **FIBA LiveStats** | tak, `action` z typem/podtypem | typ + podtyp akcji, wartości, współrzędne | feed niesie znaczniki `edited`/`inserted`/`deleted` i `origMessageId` | role `OPERATOR` i `CALLER` przy stole | brak opisu w przeczytanych źródłach |
| **Torneo (Sofascore)** | tak: gole, kartki, zmiany, karne | tryb „Live edit" | edycja lub usunięcie pojedynczego zdarzenia | crowdsourcing jako sugestie zatwierdzane przez redaktora | osobny tryb „Post-match editing" (pełny / sam wynik) |
| **Tournify** | nie jako zdarzenia; opcjonalne statystyki gracza | przycisk „Score"; statystyki osobno; panel responsywny | edycja/wyczyszczenie wyniku przez admina | uprawnienie „enter scores"; linki sędziów/drużyn bez hasła; admin nadpisuje sędziego | sędzia nie edytuje po wysłaniu; faza zamknięta blokuje wysyłkę (do wyłączenia) |
| **Toornament** | brak | wynik/gry i sety | edycja wyniku; walidacja grupy blokuje mecze | granularne uprawnienia („Report results"); raport uczestnika + spór do admina | mecze zablokowane po walidacji |
| **Challonge** | brak | wynik/sety + dodawanie setów | edycja dowolną liczbę razy | brak opisu ról do wyniku | edycja możliwa; brak progu |
| **SportsEngine** | tak, ale tylko futbol/hokej/lakros | zagrania z listy (Live Scoring); presety w SE Play; Scorebird automatycznie | brak opisu undo; metoda punktowania stała dla meczu | uprawnienia Full/Limited Access; zalecenie „one person" | wynik i zamknięcie osobno |
| **TeamSnap** | brak (jest tracker B/S/O) | przełączenie wyniku w Live! lub wpis w Schedule | przełączenie wartości; brak undo | **każdy** w drużynie może zmieniać wynik | okno Live! żyje czasowo; wynik końcowy osobno |

## 8. Czego dokumentacja nie mówi

Zebrane z całego badania. „Nie opisano" znaczy: nie znaleziono w źródłach z §0,
a nie: aplikacja tego nie robi.

- **Interfejs operatora FIBA LiveStats** (skróty, undo, widok) — przeczytano
  tylko dokumentację feedu; podręcznik użytkownika v5 był niedostępny.
- **Automatyczne scalanie dwóch równoczesnych wpisów** — żadna aplikacja;
  Tournify ma wręcz pusty nagłówek „Dealing with conflicts".
- **Widoczna historia zmian zdarzenia** — poza e-Scoresheet (lista ręcznych
  zmian, tylko do odczytu) i znacznikami czasu w feedzie FIBA LiveStats.
- **Jawna weryfikacja „suma zdarzeń = wynik"** — żadna aplikacja.
- **Undo/redo jako para** — opisany jest tylko undo (e-Scoresheet „Replay" jest
  bliżej ponowienia wymiany niż reda); reda nie opisuje nikt.
- **Zachowanie zdarzeń przy powrocie meczu ze stanu zakończonego** — dla
  e-Scoresheet i FIBA LiveStats brak opisu; GameChanger opisuje wznawianie,
  ale nie skutki dla już policzonych statystyk.
- **Limit czasu na korektę i okno sporu** — poza Toornament (spór bez terminu);
  Tournify z tej samej rodziny ma pięciominutowe okno przy wpisie drużyn
  (por. `docs/research/terminarz-w-aplikacjach-turniejowych.md`, §6.4), ale nie
  przy zdarzeniach.
- **Praca offline przy stoliku** — GameChanger wspomina o punktowaniu offline
  i późniejszej synchronizacji, ale nie dla zdarzeń z drugiego operatora;
  reszta milczy.

## 9. Nie sprawdzone

- **Nie klikałem niczego w aplikacjach.** Wszystko to odczyt dokumentacji
  i podręczników, nie obserwacja działania.
- **Nie przeczytałem podręcznika FIBA LiveStats v5** (Manualzz 403, Scribd za
  kontem). Wnioski o edycji zdarzeń w tym programie opieram wyłącznie na
  dokumentacji feedu telewizyjnego.
- **Nie oglądałem filmów instruktażowych** (m.in. GameChanger Academy,
  e-Scoresheet — lista 14 filmów szkoleniowych Volleyball New Brunswick),
  czytałem tylko ich tytuły i opisy.
- **Nie sprawdziłem aplikacji sędziowskich innych dyscyplin** (piłka ręczna,
  tenis stołowy, curling) ani dedykowanych narzędzi statystycznych typu
  TurboStats/eScore/UnderDraft poza tym, co wynikało z wyszukiwania; nie czytałem
  ich dokumentacji.
- **Nie sprawdziłem, czy i jak aplikacje rozstrzygają konflikt wersji przy
  edycji offline** (kolejność scalania, konflikty pól).
- **Nie sprawdziłem kontraktów API aplikacji turniejowych pod kątem zdarzeń**
  (Toornament, Challonge mają publiczne API; tu czytałem tylko help center).
- **Nie ustalałem, które z tych zachowań są potrzebne w S3** — to należy do
  ticketów decyzyjnych pod mapą [#187](https://github.com/dawer2253/sports-tournament-app/issues/187).
