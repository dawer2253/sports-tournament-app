#!/bin/sh
# PROTOTYP (#277). Kolejność: przygotuj katalogi, podłącz uploady, zbuduj bazę,
# zcache'uj konfigurację, oddaj storage www-data, podnieś nginx + php-fpm.
#
# Migracje i seed są tu, bo prototyp ma wstać jednym `docker compose up`.
# W produkcji to kroki deployu (albo jednorazowy job), nie entrypoint.
#
# `depends_on: service_healthy` działa przy tworzeniu kontenerów, ale nie przy
# `docker compose restart`, gdzie baza i aplikacja wstają równolegle. Bez
# ponowień migrate wywalał entrypoint, gdy MySQL jeszcze nie przyjmował
# połączeń, i stack zostawał bez aplikacji.
set -eu

cd /var/www/html

mkdir -p \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    storage/app/public \
    bootstrap/cache

# Idempotentnie: symlink public/storage → storage/app/public.
if [ ! -e public/storage ]; then
    php artisan storage:link
fi

attempt=0
until php artisan migrate --force; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
        echo "Baza nie przyjęła migracji po 30 próbach." >&2
        exit 1
    fi
    sleep 2
done

php artisan db:seed --force

# Konfiguracja i trasy cache'owane raz, przy starcie, bo env jest runtime'owy.
# `artisan optimize` odpada: woła `view:cache`, a repo nie ma `resources/views`
# (backend oddaje wyłącznie JSON) i komenda wywala entrypoint.
php artisan config:cache
php artisan route:cache

chown -R www-data:www-data storage bootstrap/cache

exec /usr/bin/supervisord -c /etc/supervisord.conf
