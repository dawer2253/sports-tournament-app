# syntax=docker/dockerfile:1.7
#
# PROTOTYP (#277): obraz „prod-podobny" Laravela + obu SPA w jednym kontenerze
# (nginx + php-fpm pod supervisorem). Nie jest to obraz produkcyjny do main —
# odpowiada na pytanie, czy taki kształt w ogóle się spina i co wymaga zmiany.
#
# Kontekst budowy to root repo, bo build frontów potrzebuje workspace'ów npm,
# a build backendu — `backend/` obok `packages/api-contract` (Spectator czyta
# kontrakt po ścieżce relatywnej, ale w runtime nie jest potrzebny).

# ---------- 1. fronty: statyczne bundle ----------
FROM node:24-alpine AS frontend
WORKDIR /repo

# Manifesty wszystkich workspace'ów: `npm ci` czyta je, zanim dotknie źródeł.
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/public/package.json apps/public/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY e2e/package.json e2e/package.json

# Playwright jest tylko w devDependencies packages/ui; w tym obrazie nie ma
# przeglądarki i nie ma po co jej ściągać.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

COPY packages ./packages
COPY apps ./apps

# Adres API wsiąka w build (Vite, build-time). Jeden origin → ścieżka względna.
# Panel stoi pod /admin/, więc dostaje base; strona publiczna zostaje na /.
ARG VITE_API_URL=/api/v1
ARG VITE_PUBLIC_URL=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_PUBLIC_URL=${VITE_PUBLIC_URL}

RUN npm run build -w @tournament/admin -- --base=/admin/
RUN npm run build -w @tournament/public

# ---------- 2. backend: php-fpm + nginx ----------
FROM php:8.5-fpm-alpine AS app

# mbstring i opcache są już wbudowane w php:8.5-fpm-alpine (`php -m`), więc
# `docker-php-ext-install` ich nie dubluje — próba kończy się na `modules/*`.
# Dokładamy tylko to, czego obraz nie ma: pdo_mysql, pcntl i bcmath.
RUN apk add --no-cache nginx supervisor unzip \
 && docker-php-ext-install pdo_mysql pcntl bcmath \
 && rm -rf /tmp/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY backend/ ./

# --no-scripts: `package:discover` potrzebuje środowiska runtime (env z compose),
# a nie build-time. Manifest powstanie przy pierwszym boocie i wyląduje
# w bootstrap/cache, które entrypoint oddaje www-data.
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist \
      --optimize-autoloader --no-scripts

# Strona publiczna leży poza public/ Laravela (nginx podaje ją z root
# location /), panel — w public/admin, żeby podanie go nie walczyło z aliasem.
COPY --from=frontend /repo/apps/admin/dist /var/www/html/public/admin
COPY --from=frontend /repo/apps/public/dist /var/www/frontend/public

COPY prototype/prod-stack/nginx.conf /etc/nginx/http.d/default.conf
COPY prototype/prod-stack/supervisord.conf /etc/supervisord.conf
COPY prototype/prod-stack/entrypoint.sh /usr/local/bin/entrypoint

RUN chmod +x /usr/local/bin/entrypoint \
 && mkdir -p storage/framework/cache storage/framework/sessions \
      storage/framework/views storage/logs storage/app/public bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/entrypoint"]
