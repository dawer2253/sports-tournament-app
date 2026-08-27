# Backend: pierwsze uruchomienie

Backend stoi w `backend/` — Laravel 13 na Sailu, z MySQL-em w kontenerze.
Ten dokument opisuje, jak podnieść go na czystym klonie.

> **Przetestowane** na Windows 11 + Docker Desktop 29.7.2 (sierpień 2026).
> Szkielet jest już zainstalowany i zacommitowany — tu opisujemy tylko
> uruchamianie. Zapis tego, co i jak powstało przy instalacji:
> [`BACKEND-INSTALACJA.md`](BACKEND-INSTALACJA.md).

## Wymagania

Tylko Docker. PHP, Composer i MySQL żyją w kontenerach i nie są instalowane na
hoście. Frontend zostaje poza Dockerem, na natywnym node.

**Windows: potrzebny WSL2.** Sail sam odmawia startu poza nim
(`Unsupported operating system [MINGW64_NT-...]`), więc `make` i `./vendor/bin/sail`
uruchamiaj z powłoki WSL2, nie z Git Basha ani PowerShella. `make` nie jest
częścią Windowsa — w WSL2 dochodzi przez `sudo apt install make`.

## Start środowiska

Na czystym klonie najpierw bootstrap, potem start:

```bash
make install   # tylko za pierwszym razem
make up
```

`vendor/` i `.env` nie są w repo, więc na świeżym klonie `./vendor/bin/sail`
jeszcze nie istnieje i żaden cel Saila nie ma czym zadziałać. `make install`
odtwarza jedno i drugie: kopiuje `.env.example`, uruchamia `composer install`
w kontenerze `laravelsail/php84-composer` (na hoście nie ma PHP) i generuje
`APP_KEY`. Cel jest plikowy, więc powtórne wywołanie nic nie robi, a `make up`
ma go w zależnościach — samo `make up` na czystym klonie też zadziała.

`make up` kończy się migracjami i nie jest to ozdobnik: sesje siedzą w bazie
(`SESSION_DRIVER=database`), a baza żyje w wolumenie Dockera, którego na czystym
klonie nie ma. Bez tabel aplikacja zwraca **500 na każdym żądaniu**. `migrate`
jest idempotentne, więc przy kolejnych `make up` tylko przelatuje.

Aplikacja odpowiada pod `http://localhost:8000` — `/` to health check zwracający
`{"status":"ok"}`. Backend oddaje wyłącznie JSON, bez warstwy widoków (szkieletowy
front na Vite został usunięty, patrz [`BACKEND-INSTALACJA.md`](BACKEND-INSTALACJA.md)).
Frontend celuje w `http://localhost:8000/api/v1`, patrz `.env.example`
w `apps/admin` i `apps/public`.

Sail domyślnie wystawia aplikację na porcie **80**, nie 8000. Port podnosi
`APP_PORT=8000` z `.env` — dlatego ta zmienna jest w `.env.example` i nie należy
jej usuwać, bo rozjedzie się z kontraktem.

Pozostałe cele wypisuje `make help` (opisy trzymają się komentarzy `##` przy
celach w [`Makefile`](../Makefile), więc lista nie rozjeżdża się z dokumentacją).
Wszystkie są cienkim opakowaniem na `./vendor/bin/sail`, który wymaga katalogu
roboczego `backend/` (czyta stamtąd `.env` i `compose.yaml`) — Makefile wchodzi
tam sam.

### Windows: uprawnienia do `storage/`

Jeżeli trzymasz repo na dysku Windows (`C:\...`) i sięgasz do niego przez Docker
Desktop, bind mount należy do roota (`uid=0` w opcjach montowania 9p). Kontenerowy
użytkownik `sail` nie zapisze wtedy `storage/`, Blade nie skompiluje widoków i
aplikacja zwraca **500** z komunikatem o `tempnam()`. Lekarstwo jest w
`.env.example` — odkomentuj:

```
SUPERVISOR_PHP_USER=root
```

Na macOS i Linuksie zostaw to zakomentowane: tam mount przejmuje UID hosta,
który zgadza się z `sail`. Problem znika też, gdy repo leży w systemie plików
WSL2 zamiast na `C:` — to zresztą wariant zalecany przez Laravela, bo jest
znacznie szybszy.

## Warstwa API i autoryzacja

**Jeszcze nie zrobione — to zakres [#6](https://github.com/dawer2253/sports-tournament-app/issues/6).**

```bash
make shell
```

W kontenerze:

```bash
php artisan install:api
composer require laravel/sanctum
composer require --dev hotmeteor/spectator
php artisan migrate
```

`install:api` zakłada `routes/api.php` i prefiks `/api`. Prefiks wersji (`/v1`)
dokładamy w `bootstrap/app.php` albo w grupie tras: kontrakt zakłada
`http://localhost:8000/api/v1`.

## Zgodność z kontraktem

Kontrakt leży w [`packages/api-contract/openapi.yaml`](../packages/api-contract/openapi.yaml)
i jest jedynym źródłem prawdy o kształcie API. Backend nie definiuje kontraktu,
tylko dowodzi, że go spełnia.

W `tests/Pest.php` wskaż spec Spectatorowi:

```php
// config/spectator.php
'sources' => [
    'local' => [
        'source' => 'local',
        'base_path' => base_path('../packages/api-contract'),
    ],
],
```

Każdy test funkcjonalny endpointu powinien kończyć się asercją zgodności:

```php
it('zwraca listę turniejów zgodną z kontraktem', function () {
    Spectator::using('openapi.yaml');

    actingAsOrganizer()
        ->getJson('/api/v1/tournaments')
        ->assertValidRequest()
        ->assertValidResponse(200);
});
```

Jeżeli endpoint ma zwracać coś, czego nie ma w spec, **najpierw zmienia się spec**,
potem regeneruje klienta (`npm run contract:generate`) i dopiero wtedy pisze kod.
Odwrotna kolejność kończy się rozjazdem, przed którym cały ten mechanizm ma chronić.

## Wersja Laravela

Bierzemy **najnowszą**, czyli Laravel 13. `laravel.build` instaluje ją domyślnie,
więc nic nie przypinasz. Decyzja #1 w [`docs/PLAN.md`](PLAN.md) jest zaktualizowana
(pierwotnie planowano wersję 11).

**Laravel Boost działa na Laravelu 13**, ale nie jest zainstalowany — sprawdzenie
zgodności i ostrzeżenie przed `boost:install` opisuje
[`BACKEND-INSTALACJA.md`](BACKEND-INSTALACJA.md).
