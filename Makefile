# Skróty do backendu w kontenerach. Frontend chodzi natywnie na node,
# tam używa się skryptów npm z katalogu głównego.
#
# Pierwsza instalacja: patrz docs/BACKEND.md

# Sail czyta ./.env i compose.yaml ze swojego katalogu roboczego, więc każdy
# cel wchodzi najpierw do backend/. Wywołania zostają w rootcie monorepo.
SAIL := cd backend && ./vendor/bin/sail

# Composer chodzi w kontenerze — na hoście nie ma PHP. Tym samym obrazem
# instalował się szkielet, więc bootstrap nie wymaga działającego Saila.
COMPOSER_RUN := docker run --rm -v "$(CURDIR)/backend:/opt" -w /opt laravelsail/php84-composer:latest

.PHONY: up down shell migrate fresh test lint install help

help:
	@echo "install  - bootstrap czystego klonu (.env + composer install + klucz)"
	@echo "up       - start kontenerów (PHP, MySQL)"
	@echo "down     - zatrzymanie kontenerów"
	@echo "shell    - powłoka w kontenerze aplikacji"
	@echo "migrate  - migracje bazy"
	@echo "fresh    - migracje od zera z seedami demo"
	@echo "test     - testy Pest"
	@echo "lint     - Pint"

# vendor/ i .env nie są w repo, więc na czystym klonie trzeba je odtworzyć,
# zanim Sail w ogóle istnieje. Zależność jest order-only (`|`), żeby dotknięcie
# .env nie wymuszało ponownego composer install.
backend/.env:
	cp backend/.env.example backend/.env

backend/vendor: | backend/.env
	$(COMPOSER_RUN) composer install
	$(COMPOSER_RUN) php artisan key:generate

install: backend/vendor

up: backend/vendor
	$(SAIL) up -d

down:
	$(SAIL) down

shell:
	$(SAIL) shell

migrate:
	$(SAIL) artisan migrate

fresh:
	$(SAIL) artisan migrate:fresh --seed

test:
	$(SAIL) pest

lint:
	$(SAIL) pint
