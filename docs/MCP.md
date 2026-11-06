# Serwer MCP: turniej prowadzony przez agenta w Claude Desktop

Organizator pisze w Claude Desktop zwykłym językiem, a agent prowadzi turniej
przez lokalny serwer MCP aplikacji (`apps/mcp-server`). Agent zakłada turniej
w dowolnym formacie, dodaje drużyny, zawodników i obiekty, układa terminarz albo
drabinkę, wpisuje wyniki i zdarzenia, czyta tabelę, rozpatruje zgłoszenia
i publikuje turniej. Serwer działa lokalnie, na jednym komputerze (decyzja #27
w `docs/PLAN.md`).

Historia: [#335](https://github.com/dawer2253/sports-tournament-app/issues/335)
dał trzy narzędzia do nagrania demo, a
[#338](https://github.com/dawer2253/sports-tournament-app/issues/338) rozszerzył
je na cały turniej. Zasady stoją w
[ADR-0014](adr/0014-serwer-mcp-to-cienka-warstwa-narzedzi-nad-kontraktem.md).

## Co jest w środku

Serwer to proces stdio w TypeScripcie. Desktop uruchamia go przez `node` wprost
ze źródeł, bez budowania. Przy starcie serwer loguje się do API
(`POST /login`) kontem organizatora z seeda i woła te same endpointy co panel,
przez klienta z kontraktu (`@tournament/api-client`). Narzędzia leżą
w `apps/mcp-server/src/tools/`, po pliku na obszar.

### Katalog narzędzi

Podpowiedzi to kolumna „Rodzaj”:

- **odczyt** ma `readOnlyHint: true`;
- **dodaje** ma `destructiveHint: false`;
- **nadpisuje** ma `destructiveHint: true`. Należy tu każda edycja, generowanie i usunięcie.

Claude Desktop pyta o zgodę przy narzędziach nadpisujących.

| Obszar | Narzędzie | Rodzaj | Co robi |
|---|---|---|---|
| Odczyt | `list_sports` | odczyt | sporty: kody, remisy, sety, typy zdarzeń, statystyki, domyślne ustawienia |
| | `list_tournaments` | odczyt | turnieje organizatora po 20, z filtrem statusów |
| | `get_tournament` | odczyt | ustawienia, format, fazy z grupami, drużyny z id i grupą |
| | `get_standings` | odczyt | tabela ligi albo tabele grup |
| | `get_leaderboard` | odczyt | klasyfikacja zawodników; tylko turniej opublikowany |
| Turniej | `create_tournament` | dodaje | szkic w formacie `league`, `knockout` albo `groups_playoff` |
| | `update_tournament` | nadpisuje | nazwa, slug, długość meczu, części gry, sety, punktacja, kolejność rozstrzygania remisów w tabeli, kolor, zapisy |
| | `set_tournament_status` | nadpisuje | szkic, opublikowany (`active`) albo zakończony |
| | `delete_tournament` | nadpisuje | usuwa turniej z całym drzewem |
| Drużyny | `add_teams` | dodaje | paczka nazw |
| | `update_team` | nadpisuje | nazwa |
| | `delete_team` | nadpisuje | razem z zawodnikami i meczami zaplanowanymi |
| Zawodnicy | `list_players` | odczyt | skład drużyny |
| | `add_players` | dodaje | paczka: imię i nazwisko, numer, pozycja |
| | `update_player` | nadpisuje | pola podane; `null` czyści numer albo pozycję |
| | `delete_player` | nadpisuje | API odmawia, gdy zawodnik ma zdarzenia w meczu rozpoczętym |
| Obiekty | `list_venues` | odczyt | boiska i hale |
| | `add_venues` | dodaje | paczka: nazwa, adres |
| | `update_venue` | nadpisuje | nazwa, adres |
| | `delete_venue` | nadpisuje | mecze zaplanowane zostają bez obiektu |
| Fazy | `draw_groups` | nadpisuje | losuje skład grup (serwer tasuje drużyny) |
| | `set_groups` | nadpisuje | skład grup podany ręcznie |
| | `set_group_qualifiers` | nadpisuje | ile drużyn wychodzi z grupy |
| | `generate_schedule` | nadpisuje | pary w kolejkach: liga albo faza grupowa; bez terminów |
| | `generate_bracket` | nadpisuje | drabinka z rozstawienia `from_groups`, `random` albo `manual` |
| | `set_schedule_dates` | nadpisuje | terminy meczów fazy: co N dni albo dzień po dniu, z obiektami |
| Mecze | `list_matches` | odczyt | mecze po 50, z filtrem fazy, kolejki i statusu |
| | `update_match` | nadpisuje | termin i obiekt jednego meczu |
| | `set_match_result` | nadpisuje | wynik, sety albo karne; mecz zakończony albo trwający |
| | `clear_match_result` | nadpisuje | cofa mecz do zaplanowanych |
| Zdarzenia | `list_match_events` | odczyt | gole, kartki, punkty meczu |
| | `add_match_events` | dodaje | paczka zdarzeń |
| | `update_match_event` | nadpisuje | typ, drużyna, zawodnik, minuta |
| | `delete_match_event` | nadpisuje | usuwa zdarzenie |
| Zgłoszenia | `list_registrations` | odczyt | zgłoszenia ze strony publicznej, z kontaktem i składem |
| | `accept_registration` | dodaje | tworzy drużynę z zawodnikami ze zgłoszenia |
| | `reject_registration` | nadpisuje | odrzuca i kasuje dane kontaktowe |

Loga turnieju i drużyn oraz zegar meczu na żywo zostają w panelu.

### Konwencje

Pełne uzasadnienie jest w ADR-0014. Przy dopisywaniu narzędzia:

- **Nazwy i parametry po angielsku, opisy po polsku**, w słownictwie
  z [`CONTEXT.md`](../CONTEXT.md). Czas w parametrach i odpowiedziach to czas
  warszawski: `YYYY-MM-DD HH:MM` albo osobno `YYYY-MM-DD` i `HH:MM`. Offset
  liczy serwer na dzień meczu (ADR-0008).
- **Tylko id.** Zapis przyjmuje id, a odczyt je podaje. Serwer nie dopasowuje
  nazw.
- **Opis mówi, co narzędzie robi, kiedy API odmawia i jakie są skutki.** Nie
  wydaje agentowi poleceń („wywołaj potem…”), bo katalog konektorów tego
  zabrania. Pilnuje tego test w `src/server.test.ts`.
- **Podpowiedzi z `src/tools/kit.ts`**: `READ`, `ADD`, `EDIT`, `REMOVE`,
  `REPLACE`. Każde narzędzie ma `title` i `outputSchema`, co też sprawdza test.
- **Paczki przez `addEach` (`src/tools/batch.ts`)**: po kolei; `422` pomija
  z powodem; inny błąd przerywa i mówi, co weszło.
- **Odpowiedź**: dane w `structuredContent` zgodne z `outputSchema` oraz polskie
  zdania z id w `content`. Długie listy są stronicowane albo skracane.
- **Błędy API przechodzą bez zmian.** `422` daje `isError` z `message`
  i błędami pól. Po `401` serwer loguje się raz jeszcze. Gdy backend nie
  odpowiada, komunikat podaje adres.

## 1. Backend z seedem

```bash
make up      # Sail: Laravel na :8000 i MySQL
make fresh   # migrate:fresh --seed, zeruje bazę deweloperską
```

`make fresh` czyści całą bazę `laravel`, także turnieje założone wcześniej przez
panel. Na nagranie to dobrze, bo lista turniejów w panelu zaczyna się od
samego demo. Gdy bazy nie chcesz zerować, wystarczy `sail artisan migrate`.
Baza bez najnowszych migracji daje `500` przy zdarzeniach meczowych (brak
kolumny `added_time`).

Konto organizatora z seeda: `dawid@example.com` / `tajnehaslo123`
(`grep -n "dawid@example.com" -A1 backend/database/seeders/DemoTournamentSeeder.php`).

## 2. Zależności i panel

W rootcie repo:

```bash
npm install
```

Node musi być w wersji 24 lub nowszej i być w `PATH`, który widzi Claude
Desktop (`node --version`). Starszy Node nie uruchomi plików `.ts` bez flag.

Panel ma celować w Laravela, nie w mocka: w `apps/admin/.env` ustaw
`VITE_API_URL=http://localhost:8000/api/v1` (wzór w `apps/admin/.env.example`),
a potem:

```bash
npm run dev:admin   # panel na :5173
```

## 3. Wpis w `claude_desktop_config.json`

Plik konfiguracji Desktopu:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

Najprościej otworzyć go z Desktopu: Settings → Developer → Edit Config. Dopisz
serwer w `mcpServers`, podmieniając ścieżkę na absolutną ścieżkę do repo:

```json
{
  "mcpServers": {
    "turnieje": {
      "command": "node",
      "args": ["/ABSOLUTNA/ŚCIEŻKA/DO/sports-tournament-app/apps/mcp-server/src/index.ts"],
      "env": {
        "TOURNAMENT_API_URL": "http://localhost:8000/api/v1",
        "TOURNAMENT_PANEL_URL": "http://localhost:5173",
        "TOURNAMENT_EMAIL": "dawid@example.com",
        "TOURNAMENT_PASSWORD": "tajnehaslo123"
      }
    }
  }
}
```

Na Windowsie ścieżka w JSON-ie idzie z podwójnymi ukośnikami wstecznymi
(`"C:\\Users\\…\\apps\\mcp-server\\src\\index.ts"`) albo ze zwykłymi `/`.

- `TOURNAMENT_API_URL`: adres API **z prefiksem `/api/v1`**.
- `TOURNAMENT_PANEL_URL`: adres panelu; z niego idą linki w odpowiedziach agenta.
- `TOURNAMENT_EMAIL`, `TOURNAMENT_PASSWORD`: konto organizatora z seeda.

Po zapisaniu pliku **zamknij Desktop całkowicie** (także z zasobnika
systemowego / paska menu) i uruchom go ponownie. Serwer `turnieje` powinien być
widoczny w menu narzędzi w polu wiadomości, z 37 narzędziami.

## 4. Przykładowe polecenia

Liga od zera, czyli scenariusz demo:

```text
Załóż ligę piłkarską „Liga Osiedlowa Jesień 2026” dla 8 drużyn, start 1 listopada, mecze co tydzień. Drużyny: Wilki Bemowo, Sokoły Ursus, Orły Bielany, Lwy Wola, Rysie Targówek, Żubry Praga, Jastrzębie Ochota, Borsuki Mokotów.
```

Agent woła po kolei `create_tournament`, `add_teams`, `generate_schedule`
i `set_schedule_dates`, a na koniec pokazuje siedem kolejek z parami i datami
(niedziele, 18:00) oraz link do terminarza w panelu. Turniej jest szkicem.

Prowadzenie sezonu:

```text
Dodaj do Wilków Bemowo zawodników: Jan Kowalski (9, napastnik), Adam Nowak (1, bramkarz), Piotr Wiśniewski (5).
```

```text
Wilki wygrały z Sokołami 3:1. Gole: Kowalski 12' i 40', Wiśniewski 77' dla Wilków, dla Sokołów samobój Nowaka w 60'. Pokaż potem tabelę.
```

```text
Opublikuj ligę i otwórz zapisy do końca listopada.
```

Puchar z grupami:

```text
Załóż turniej koszykówki z grupami i pucharem dla tych 8 drużyn: …. Wylosuj dwie grupy, z każdej wychodzą dwie, mecze w sobotę 21 listopada od 10:00 do 18:00 na dwóch boiskach: Hala Wola i Hala Bemowo.
```

## 5. Akceptacja w panelu

1. Otwórz link z czatu (`http://localhost:5173/tournaments/<id>/schedule`) i
   zaloguj się kontem z seeda, jeśli panel o to poprosi.
2. Przejrzyj terminarz: 7 kolejek po 4 mecze, kolejka co tydzień.
3. Opublikuj turniej: przyciskiem **„Opublikuj”** w ustawieniach turnieju
   (`…/tournaments/<id>/settings`) albo poleceniem do agenta, który zawoła
   `set_tournament_status`. Dopiero wtedy turniej jest widoczny na stronie
   publicznej.

Gdy terminarz się nie podoba, można poprosić agenta np. „zrób z rewanżami”:
`generate_schedule` ułoży pary od nowa (z `meetings: 2`), a `set_schedule_dates`
nada im terminy.

## Gdy serwer się nie podłącza

- **Logi MCP w Desktopie**: Settings → Developer pokazuje stan serwera i link
  do logów. Pliki leżą w `%APPDATA%\Claude\logs` (Windows) albo
  `~/Library/Logs/Claude` (macOS): `mcp.log` i `mcp-server-turnieje.log`.
  Serwer pisze tam swoje komunikaty z prefiksem `[tournament-mcp]`.
- **„Brakuje zmiennych środowiskowych: …”**: w `env` wpisu brakuje którejś
  z czterech zmiennych. Serwer kończy się wtedy od razu.
- **„Backend nie odpowiada pod …”**: Sail nie stoi albo adres jest zły. Sprawdź
  `make up` i czy `TOURNAMENT_API_URL` kończy się na `/api/v1`. Serwer startuje
  także bez backendu i zaloguje się przy pierwszym wywołaniu narzędzia.
- **„Logowanie organizatora … nie powiodło się”**: konto nie istnieje (baza
  bez seeda: `make fresh`) albo hasło w `env` jest inne niż w seedzie.
- **Serwer nie startuje wcale**: zła ścieżka w `args` (musi być absolutna) albo
  Desktop widzi starszy Node. Sprawdź w terminalu:

  ```bash
  node --version
  ```

  i uruchom serwer ręcznie z tymi samymi zmiennymi; powinien wypisać na stderr
  „Zalogowano jako …” i czekać na wejście (wyjście: Ctrl+C):

  ```bash
  TOURNAMENT_API_URL=http://localhost:8000/api/v1 TOURNAMENT_PANEL_URL=http://localhost:5173 TOURNAMENT_EMAIL=dawid@example.com TOURNAMENT_PASSWORD=tajnehaslo123 node apps/mcp-server/src/index.ts
  ```

Nie sprawdzałem układu, w którym Desktop działa na Windowsie, a repo i Node
leżą w WSL. Wtedy `"command": "node"` szuka Node'a w Windowsie, nie w WSL.
