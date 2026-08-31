Instrukcje dla agentów w tym repo trzymamy pod neutralną nazwą, żeby czytało je
każde narzędzie, nie tylko Claude Code.

**Przeczytaj teraz [`AGENTS.md`](AGENTS.md)** i stosuj się do niego.

## Wytyczne Laravel Boost poniżej są przycięte

Blok `<laravel-boost-guidelines>` generuje `php artisan boost:install`. Usunięto
z niego fragmenty sprzeczne z tym repo, bo agent czytający dwie sprzeczne
instrukcje wykona jedną z nich losowo. Wypadły:

- **`vendor/bin/sail` jako prefiks każdej komendy** — komendy opisuje
  [`AGENTS.md`](AGENTS.md) i [`Makefile`](../Makefile), a poza WSL2 Sail w ogóle
  nie startuje (patrz [`docs/BACKEND.md`](../docs/BACKEND.md)).
- **`.ai/rules` i `record-rule` jako miejsce na ustalenia** — to repo trzyma
  decyzje w [`docs/adr/`](../docs/adr/) i [`CONTEXT.md`](../CONTEXT.md).
- **Vite, frontend, deployment, `browser-logs` i `package.json`** — backend
  oddaje wyłącznie JSON, nie ma tu npm ani przeglądarki.
- **„twórz fabryki i seedery do nowych modeli"** — [`AGENTS.md`](AGENTS.md)
  stanowi inaczej dla danych systemowych (sporty wstawia migracja,
  `SportFactory` celowo nie istnieje).

**Te uwagi stoją nad blokiem świadomie.** `GuidelineWriter` podmienia całą
zawartość między znacznikami `<laravel-boost-guidelines>`, więc cokolwiek
wpisanego do środka zniknie przy następnym `boost:install`. Wtedy przytnij blok
ponownie, zamiast godzić się na sprzeczność. Sam tekst wytycznych zostaje po
angielsku, bo pochodzi z pakietu.

## Komendy

Cele `make` z korzenia monorepo (`make up`, `make shell`, `make test`,
`make lint`, `make migrate`, `make fresh`), a poza WSL2 — gdzie ani `make`, ani
Sail nie działają — przez Compose. Obie drogi i jedyną pełną postać komendy
opisuje [`docs/BACKEND.md`](../docs/BACKEND.md); nie powtarzamy jej tutaj, żeby
nie rozjechała się w dwóch plikach.

Wszędzie niżej, gdzie wytyczne mówią o `artisan`, `pint` czy `pest`, chodzi
o uruchomienie ich w kontenerze.

===

<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application running on PHP 8.5. You are an expert with the Laravel ecosystem. Always use the APIs that match the installed major version of each package — do not assume a version.

Before relying on a package's API, confirm its installed version: run `composer show --direct` to list direct dependencies with versions, or `composer show <vendor/package>` for a single package.

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.

## Searching Documentation (IMPORTANT)

- Use `search-docs` before changes that depend on Laravel ecosystem APIs, behavior, configuration, or version-specific syntax. Skip it for copy-only edits and other changes where package documentation is irrelevant. Reuse sufficient results already in context instead of searching again.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Artisan

- Use `artisan list` to discover available commands and `artisan [command] --help` to check parameters.
- Inspect routes with `artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `artisan config:show app.name`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== tests rules ===

# Test Enforcement

- Test every code change by adding or updating a test.
- Run the affected tests and ensure they pass.
- Test the changed behavior and its important failure modes, but do not add tests beyond them.
- Read the `testing-best-practices` skill before writing tests.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.).
- If you're creating a generic PHP class, use `artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `pint --dirty --format agent` (or `make lint`) before finalizing changes, to ensure your code matches the project's expected style.
- `pint --test` only reports issues; run `pint` without it to fix them. CI runs the `--test` mode as a gate.

=== pest/core rules ===

# Pest

- This project uses Pest. Create tests with `artisan make:test --pest {name}`.
- Do not include the test suite directory in `{name}`. Use `SomeFeatureTest`, not `Feature/SomeFeatureTest`.
- Read the `testing-best-practices` skill for guidance on coverage, naming, structure, dependency isolation, and review.
- Do not delete tests or test files without approval. They are part of the application.

## Running Tests

- Run the narrowest set of tests that covers the change. Pass a file path or `--filter=testName` to `pest`.
- Rerun a test after each change to it.
- After the feature tests pass, run the complete suite with `make test`.

</laravel-boost-guidelines>
