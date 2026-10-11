#!/usr/bin/env bash
# Laravel dla suity E2E: osobna baza `e2e`, wyczyszczona i zaseedowana raz na
# przebieg, a potem `artisan serve` na porcie 8001. Uruchamia go `webServer`
# z `playwright.config.ts`, więc nie wołaj go ręcznie.
#
# Baza jest osobna, bo przeglądarka rozmawia z osobnym procesem serwera, a więc
# transakcja `RefreshDatabase` jej nie obejmie. Reset bazy deweloperskiej
# (`make fresh`) odpada: wolumen MySQL-a jest wspólny dla równoległych sesji.
#
# Konto `root`, bo tylko ono założy brakującą bazę: Sail daje użytkownikowi
# `sail` prawa wyłącznie do `laravel` i `testing%`. `migrate:fresh --force`
# zakłada bazę sam, gdy jej nie ma. Hasło roota to `DB_PASSWORD` z `.env`
# (compose ustawia nim `MYSQL_ROOT_PASSWORD`), na CI tak samo — patrz job `e2e`.
#
# Zmienne idą przez środowisko procesu, a Laravel ładuje `.env` w trybie
# immutable, więc wygrywają z plikiem. `--no-reload` przekazuje je serwerowi PHP
# w całości; bez niego `serve` czyści zmienne wczytane z `.env`, żeby potomek
# przeczytał plik od nowa.
#
# `exec` na końcu jest konieczny: Playwright kończy serwer sygnałem (patrz
# `gracefulShutdown` w konfiguracji), a powłoka jako PID 1 w kontenerze by go
# zignorowała i kontener z portem 8001 przeżyłby przebieg.
set -euo pipefail

cd "$(dirname "$0")/../../backend"

PORT=8001
export DB_DATABASE=e2e
export DB_USERNAME=root
export APP_URL="http://localhost:${PORT}"

serve_command() {
  local host=$1
  echo "php artisan migrate:fresh --seed --force && exec php artisan serve --no-reload --host=${host} --port=${PORT}"
}

# Na CI PHP stoi natywnie, tak jak w jobie `backend`. Lokalnie PHP żyje
# wyłącznie w kontenerze (backend/AGENTS.md), więc serwer wstaje w jednorazowym
# kontenerze obrazu Saila z wystawionym portem. `--no-deps`, bo MySQL ma już
# stać po `make up`: bez tej flagi compose odtworzyłby go, gdyby konfiguracja
# różniła się choćby ścieżką montowania (np. z worktree).
if [ -n "${CI:-}" ]; then
  exec bash -c "$(serve_command 127.0.0.1)"
fi

exec docker compose run --rm --no-deps \
  --publish "${PORT}:${PORT}" \
  --env "DB_DATABASE=${DB_DATABASE}" --env "DB_USERNAME=${DB_USERNAME}" --env "APP_URL=${APP_URL}" \
  laravel.test bash -c "$(serve_command 0.0.0.0)"
