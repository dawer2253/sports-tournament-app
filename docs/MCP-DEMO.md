# Demo MCP: liga zakładana przez agenta w Claude Desktop

Organizator pisze w Claude Desktop jedno polecenie, a agent zakłada ligę, dodaje
drużyny i układa terminarz z datami przez lokalny serwer MCP aplikacji
(`apps/mcp-server`). Turniej zostaje szkicem, który organizator przegląda
w panelu i sam publikuje. Wszystko działa lokalnie, na jednym komputerze, i
służy wyłącznie do nagrania filmu demo (decyzja #27 w `docs/PLAN.md`, ticket
[#335](https://github.com/dawer2253/sports-tournament-app/issues/335)).

## Co jest w środku

Serwer to proces stdio w TypeScripcie. Desktop uruchamia go przez `node` wprost
ze źródeł, bez budowania. Przy starcie serwer loguje się do API
(`POST /login`) kontem organizatora z seeda i woła te same endpointy co panel,
przez klienta z kontraktu (`@tournament/api-client`). Wystawia trzy narzędzia:

| Narzędzie | Co robi |
|---|---|
| `create_tournament` | zakłada szkic ligi (nazwa, kod sportu: `football`, `basketball`, `volleyball`) |
| `add_teams` | dodaje drużyny po kolei; odrzucone przez API raportuje i idzie dalej |
| `generate_schedule` | losuje pary w kolejkach i nadaje kolejkom daty co tydzień (domyślnie od 18:00 czasu warszawskiego); ponowne wywołanie losuje od nowa |

Narzędzia do publikacji nie ma: stan turnieju ustawia organizator.

## 1. Backend z seedem

```bash
make up      # Sail: Laravel na :8000 i MySQL
make fresh   # migrate:fresh --seed, zeruje bazę deweloperską
```

`make fresh` czyści całą bazę `laravel`, także turnieje założone wcześniej przez
panel. Na nagranie to dobrze, bo lista turniejów w panelu zaczyna się od
samego demo.

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

- `TOURNAMENT_API_URL` — adres API **z prefiksem `/api/v1`**.
- `TOURNAMENT_PANEL_URL` — adres panelu; z niego idą linki w odpowiedziach agenta.
- `TOURNAMENT_EMAIL`, `TOURNAMENT_PASSWORD` — konto organizatora z seeda.

Po zapisaniu pliku **zamknij Desktop całkowicie** (także z zasobnika
systemowego / paska menu) i uruchom go ponownie. Serwer `turnieje` powinien być
widoczny w menu narzędzi w polu wiadomości, z trzema narzędziami.

## 4. Polecenie do wklejenia

```text
Załóż ligę piłkarską „Liga Osiedlowa Jesień 2026” dla 8 drużyn, start 1 listopada, mecze co tydzień. Drużyny: Wilki Bemowo, Sokoły Ursus, Orły Bielany, Lwy Wola, Rysie Targówek, Żubry Praga, Jastrzębie Ochota, Borsuki Mokotów.
```

Agent woła po kolei `create_tournament`, `add_teams` i `generate_schedule`
(Desktop pyta o zgodę przy każdym narzędziu; na nagranie można zezwolić na
stałe). Na koniec pokazuje w czacie siedem kolejek z parami i datami
(niedziele, 18:00) oraz link do terminarza w panelu.

## 5. Akceptacja w panelu

1. Otwórz link z czatu (`http://localhost:5173/tournaments/<id>/schedule`) i
   zaloguj się kontem z seeda, jeśli panel o to poprosi.
2. Przejrzyj terminarz: 7 kolejek po 4 mecze, kolejka co tydzień.
3. W ustawieniach turnieju (`…/tournaments/<id>/settings`) kliknij
   **„Opublikuj”**. Dopiero teraz turniej jest widoczny na stronie publicznej.

Gdy terminarz się nie podoba, można poprosić agenta np. „zrób z rewanżami”:
`generate_schedule` ułoży terminarz od nowa (z `meetings: 2`) i nadpisze
poprzedni.

## Gdy serwer się nie podłącza

- **Logi MCP w Desktopie**: Settings → Developer pokazuje stan serwera i link
  do logów. Pliki leżą w `%APPDATA%\Claude\logs` (Windows) albo
  `~/Library/Logs/Claude` (macOS): `mcp.log` i `mcp-server-turnieje.log`.
  Serwer pisze tam swoje komunikaty z prefiksem `[tournament-mcp]`.
- **„Brakuje zmiennych środowiskowych: …”** — w `env` wpisu brakuje którejś
  z czterech zmiennych. Serwer kończy się wtedy od razu.
- **„Backend nie odpowiada pod …”** — Sail nie stoi albo adres jest zły. Sprawdź
  `make up` i czy `TOURNAMENT_API_URL` kończy się na `/api/v1`. Serwer startuje
  także bez backendu i zaloguje się przy pierwszym wywołaniu narzędzia.
- **„Logowanie organizatora … nie powiodło się”** — konto nie istnieje (baza
  bez seeda: `make fresh`) albo hasło w `env` jest inne niż w seedzie.
- **Serwer nie startuje wcale** — zła ścieżka w `args` (musi być absolutna) albo
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
