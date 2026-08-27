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

| Cel | Komenda |
|---|---|
| Bootstrap czystego klonu | `make install` |
| Start kontenerów | `make up` |
| Zatrzymanie kontenerów | `make down` |
| Powłoka w kontenerze | `make shell` |
| Migracje | `make migrate` |
| Migracje od zera z seedami | `make fresh` |
| Testy (Pest) | `make test` |
| Formatowanie (Pint) | `make lint` |

Poza `install` cele `make` to cienkie opakowanie na `./vendor/bin/sail` — Sail wymaga
katalogu roboczego `backend/`, dlatego Makefile sam tam wchodzi. `install` działa
bez Saila (odtwarza dopiero jego binarkę), więc uruchamia Composera w kontenerze.

## Kontrakt API

`packages/api-contract/openapi.yaml` jest jedynym źródłem prawdy o API. Backend
kontraktu nie definiuje, tylko dowodzi, że go spełnia. Kolejność zmian: spec →
`npm run contract:generate` → kod. Szczegóły w [rootowym `AGENTS.md`](../AGENTS.md).
