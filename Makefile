# Skróty do backendu w kontenerach. Frontend chodzi natywnie na node,
# tam używa się skryptów npm z katalogu głównego.
#
# Pierwsza instalacja: patrz docs/BACKEND.md
#
# Opis celu trzymamy w komentarzu `##` przy samym celu — `make help` czyta go
# stąd, żeby lista komend miała jedno źródło prawdy i nie rozjeżdżała się
# z dokumentacją.

# Sail czyta ./.env i compose.yaml ze swojego katalogu roboczego, więc każdy
# cel wchodzi najpierw do backend/. Wywołania zostają w rootcie monorepo.
SAIL := cd backend && ./vendor/bin/sail

# Composer chodzi w kontenerze — na hoście nie ma PHP. Tym samym obrazem
# instalował się szkielet, więc bootstrap nie wymaga działającego Saila.
# Tag `latest` nie psuje powtarzalności: wersje pakietów bierze composer.lock
# z repo, obraz dostarcza tylko sam Composer i PHP do jego uruchomienia.
#
# `-u` z UID hosta jest konieczne: bez niego Composer pisze jako root i vendor/
# staje się nieusuwalne bez sudo, a Pest nie zapisze swojego cache'u w
# vendor/pestphp (`mkdir(): Permission denied`). COMPOSER_HOME musi wtedy
# wskazywać katalog zapisywalny dla tego UID-a, bo /root już nim nie jest.
COMPOSER_RUN := docker run --rm \
	-u $(shell id -u):$(shell id -g) -e COMPOSER_HOME=/tmp/composer \
	-v "$(CURDIR)/backend:/opt" -w /opt laravelsail/php84-composer:latest

.PHONY: up down shell migrate fresh test lint install help

help:
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) \
		| sed -E 's/^([a-z-]+):.*## */\1|/' \
		| awk -F'|' '{ printf "%-9s- %s\n", $$1, $$2 }'

# vendor/ i .env nie są w repo, więc na czystym klonie trzeba je odtworzyć,
# zanim Sail w ogóle istnieje. Zależność jest order-only (`|`), żeby dotknięcie
# .env nie wymuszało ponownego composer install.
backend/.env:
	cp backend/.env.example backend/.env

backend/vendor: | backend/.env
	$(COMPOSER_RUN) composer install
	$(COMPOSER_RUN) php artisan key:generate

install: backend/vendor ## bootstrap czystego klonu (.env + composer install + klucz)

# Migracje są częścią `up`, nie osobnym krokiem do zapamiętania: sesje siedzą
# w bazie (SESSION_DRIVER=database), więc bez tabel aplikacja zwraca 500 na
# każdym żądaniu. Baza żyje w wolumenie Dockera, którego na czystym klonie nie
# ma. `migrate` jest idempotentne, a Sail czeka na healthcheck MySQL-a.
up: backend/vendor ## start kontenerów (PHP, MySQL) + migracje
	$(SAIL) up -d
	$(SAIL) artisan migrate --force

down: ## zatrzymanie kontenerów
	$(SAIL) down

shell: ## powłoka w kontenerze aplikacji
	$(SAIL) shell

migrate: ## migracje bazy
	$(SAIL) artisan migrate

fresh: ## migracje od zera z seedami demo
	$(SAIL) artisan migrate:fresh --seed

test: ## testy Pest
	$(SAIL) pest

lint: ## Pint
	$(SAIL) pint
