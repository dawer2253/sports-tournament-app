# Backend: pierwsze uruchomienie

Backend nie jest jeszcze zainstalowany. Katalog `backend/` powstaje przy pierwszym
uruchomieniu poniższych kroków i od tego momentu jest częścią repo.

> **Nieprzetestowane.** Ten dokument powstał na maszynie bez Dockera i bez PHP,
> więc żaden z poniższych kroków nie został wykonany. Pierwsze przejście przez
> niego jest zadaniem osoby odpowiedzialnej za środowisko (S0). Popraw ten plik
> w miejscach, w których rzeczywistość okaże się inna.

## Wymagania

Tylko Docker. PHP, Composer i MySQL żyją w kontenerach i nie są instalowane na
hoście. Frontend zostaje poza Dockerem, na natywnym node.

## 1. Instalacja szkieletu

Z katalogu głównego repo, przy nieistniejącym jeszcze `backend/`:

```bash
curl -s "https://laravel.build/backend?with=mysql" | bash
```

Skrypt tworzy projekt Laravel w `backend/` i konfiguruje Sail z usługą MySQL.

## 2. Start środowiska

```bash
make up
```

Aplikacja odpowiada pod `http://localhost:8000`. Frontend celuje w
`http://localhost:8000/api/v1`, patrz `.env.example` w `apps/admin` i `apps/public`.

## 3. Warstwa API i autoryzacja

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

## 4. Zgodność z kontraktem

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

## Do potwierdzenia z zespołem

[`docs/PLAN.md`](PLAN.md) w decyzji #1 mówi o **Laravel 11**. Aktualną wersją jest
**Laravel 13**, a `laravel.build` instaluje zawsze najnowszą. Do rozstrzygnięcia:
czy aktualizujemy decyzję #1 do wersji 13, czy jest powód, żeby trzymać się 11.
Ta sama uwaga dotyczy Laravel Boost z decyzji #1: sprawdź, czy jest kompatybilny
z wybraną wersją, zanim wejdzie do `composer.json`.
