# Skróty do backendu w kontenerach. Frontend chodzi natywnie na node,
# tam używa się skryptów npm z katalogu głównego.
#
# Pierwsza instalacja: patrz docs/BACKEND.md

SAIL := backend/vendor/bin/sail

.PHONY: up down shell migrate fresh test lint help

help:
	@echo "up       - start kontenerów (PHP, MySQL)"
	@echo "down     - zatrzymanie kontenerów"
	@echo "shell    - powłoka w kontenerze aplikacji"
	@echo "migrate  - migracje bazy"
	@echo "fresh    - migracje od zera z seedami demo"
	@echo "test     - testy Pest"
	@echo "lint     - Pint"

up:
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
