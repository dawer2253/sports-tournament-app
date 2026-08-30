# backend — Laravel 13 + Sail

Obowiązują [zasady globalne z rootu](../AGENTS.md). Pierwsze uruchomienie i opis
środowiska: [`docs/BACKEND.md`](../docs/BACKEND.md).

## PHP i Composer żyją w kontenerze

Na hoście stoi **tylko Docker**. Nie instaluj PHP, Composera ani MySQL-a
lokalnie — nie są potrzebne i nie są częścią setupu zespołu.

Domyślny szkielet Laravela wypełnia ten plik instrukcjami bootstrapu (instalacja
PHP przez skrypt z sieci, `composer require laravel/boost`). Zostały świadomie
usunięte, bo są sprzeczne z powyższym. Jeżeli `php artisan boost:install` kiedyś
je tu z powrotem wygeneruje, przywróć ten nagłówek.

## Komendy (uruchamiaj z rootu monorepo)

Pełna lista celów z opisami: `make help`. Opisy żyją w komentarzach `##` przy
celach w [`Makefile`](../Makefile) i nie są tu powtarzane, żeby zmiana nazwy celu
nie wymagała edycji dwóch plików.

Poza `install` cele `make` to cienkie opakowanie na `./vendor/bin/sail` — Sail wymaga
katalogu roboczego `backend/`, dlatego Makefile sam tam wchodzi. `install` działa
bez Saila (odtwarza dopiero jego binarkę), więc uruchamia Composera w kontenerze.

## Backend oddaje wyłącznie JSON

Nie ma tu warstwy widoków ani frontu. Szkielet Laravela przychodzi z Vite,
Tailwindem i widokiem `welcome.blade.php` — zostały usunięte razem z
`backend/package.json`. Dwa powody:

- front to `apps/admin` i `apps/public`, poza Dockerem, na natywnym node;
- monorepo trzyma **jeden** `package-lock.json` w rootcie (patrz
  [zasady globalne](../AGENTS.md)), a `backend/` nie jest workspace'em, więc
  drugie drzewo npm nikomu by się nie instalowało — a bez zbudowanego manifestu
  Vite widok `welcome` zwracał 500 na czystym klonie.

**Nie uruchamiaj `npm` w tym katalogu.** Jeżeli któryś generator odtworzy tu
`package.json` albo widok z `@vite`, usuń go. `/` zostaje health checkiem
zwracającym `{"status":"ok"}` — na tym stoi smoke test środowiska.

## Schemat i modele

Kształt bazy wynika z ERD w [`docs/PLAN.md`](../docs/PLAN.md) §3. Trzy miejsca
wyglądają jak niedoróbka, a są wymuszone przez PHP i MySQL — powody opisuje
[ADR 0005](../docs/adr/0005-schemat-ustepuje-ograniczeniom-php-i-mysql.md),
przeczytaj go, zanim któreś z nich „naprawisz":

- **Model meczu nazywa się `GameMatch`**, mimo że byt nazywa się `Match`.
- **Nie dodawaj `RESTRICT` wewnątrz poddrzewa turnieju.** Zakaz usuwania bytu
  z rozegranym meczem realizuje guard w modelach (`GuardsFinishedMatches`),
  zwracający **422** (tak stanowi kontrakt), nie Policy i nie klucz obcy.
  Obejmuje byty kasowane ręcznie, nie strukturę spod generatora.
- **Przynależność grupy do turnieju sprawdzi Form Request**, nie klucz obcy —
  predykat `Team::groupBelongsToSameTournament()` czeka na CRUD drużyn w S1.

Poza tym:

- **Sporty wstawia migracja, nie seeder** — to dane systemowe, a ich `config`
  musi zgadzać się z przykładem `GET /sports` w kontrakcie. `SportFactory`
  celowo nie istnieje.
- Modele konfigurujemy **atrybutami** (`#[Fillable]`, `#[Table]`), tak jak
  robi to szkielet Laravela 13, a nie właściwościami `protected $fillable`.

## Autoryzacja

Sanctum w trybie tokenowym: token Bearer w nagłówku `Authorization`, bez daty
wygaśnięcia, bez ciasteczek i bez stanu sesji. Trzy rzeczy wyglądają jak pomyłka,
a wynikają wprost z kontraktu:

- **Nieudane logowanie to 422, nie 401.** Kontrakt nie przewiduje przy `/login`
  odpowiedzi 401, a komunikat wraca pod kluczem `email`. 401 zostaje wyłącznie
  dla żądań do zasobów chronionych bez ważnego tokenu.
- **`/logout` unieważnia tylko token użyty w tym żądaniu**, nie wszystkie tokeny
  organizera.
- **Powtórzone hasło sprawdza `same:passwordConfirmation`, nie `confirmed`.**
  Reguła `confirmed` szuka pola `password_confirmation`, a kontrakt ma pola
  w camelCase.

Testy nie logują się przez `actingAs()`. Helper `actingAsOrganizer()`
z `tests/Pest.php` wydaje prawdziwy token, żeby test przechodził tę samą drogę
co panel.

## Kontrakt API

`packages/api-contract/openapi.yaml` jest jedynym źródłem prawdy o API. Backend
kontraktu nie definiuje, tylko dowodzi, że go spełnia. Kolejność zmian: spec →
`npm run contract:generate` → kod. Szczegóły w [rootowym `AGENTS.md`](../AGENTS.md).
