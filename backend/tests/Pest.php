<?php

use App\Models\Sport;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| Testy funkcjonalne biegną na bazie "testing" (patrz phpunit.xml), którą Sail
| zakłada przy pierwszym starcie kontenera MySQL. RefreshDatabase migruje ją
| przed każdym testem, więc zestaw nie zależy od stanu bazy deweloperskiej.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Helpery
|--------------------------------------------------------------------------
|
| Autoryzacja to token Bearer w nagłówku (kontrakt, `securitySchemes`), więc
| test nie używa `actingAs()` — przechodzi tą samą drogą co panel, przez
| prawdziwy token Sanctuma.
|
*/

function actingAsOrganizer(?User $user = null): TestCase
{
    $user ??= User::factory()->create();

    return test()->withToken($user->createToken('test')->plainTextToken);
}

/**
 * Sporty wstawia migracja (decyzja #10), więc test bierze je z bazy po kodzie,
 * a nie z factory — `SportFactory` celowo nie istnieje.
 */
function sport(string $code): Sport
{
    return Sport::where('code', $code)->firstOrFail();
}

/**
 * Komunikat, który kontrakt obiecuje we wspólnej odpowiedzi błędu
 * (`components/responses/{name}`). Spectator waliduje schemat, nie przykład,
 * więc zgodność tekstu trzeba asertować osobno (klasa błędu z #53). Ścieżka
 * idzie z konfiguracji Spectatora, żeby oba mechanizmy czytały ten sam plik.
 */
function contractErrorMessage(string $response): string
{
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $message = $spec['components']['responses'][$response]['content']['application/json']['example']['message'];

    expect($message)->toBeString()->not->toBeEmpty();

    return $message;
}

/**
 * Podróbka dysku `public` z prawdziwym `url`. Goły `Storage::fake('public')`
 * gubi `url` dysku, więc adres pliku wychodzi względny i Spectator odrzuca go
 * na `format: uri` (research `docs/research/upload-obrazow-laravel.md` §2.4).
 */
function fakePublicDisk(): void
{
    Storage::fake('public', ['url' => config('filesystems.disks.public.url')]);
}

/**
 * Podmienia podróbkę dysku `public` na taką, której kasowanie zawodzi tak jak
 * prawdziwy dysk z `'throw' => false`: zwraca `false`. Zapis i odczyt działają
 * dalej, na tym samym katalogu. Wywołaj po `fakePublicDisk()`.
 */
function failDeletionsOnPublicDisk(): void
{
    $disk = Storage::disk('public');

    Storage::set('public', new class($disk->getDriver(), $disk->getAdapter(), $disk->getConfig()) extends FilesystemAdapter
    {
        public function delete($paths): bool
        {
            return false;
        }

        public function deleteDirectory($directory): bool
        {
            return false;
        }
    });
}

/**
 * Nagłówki żądania z plikiem. Spectator waliduje ciało tylko wtedy, gdy
 * `Content-Type` jest dosłownie kluczem z kontraktu, bez `boundary`
 * (research §5.1). `Accept` każe oddać błędy jako JSON.
 *
 * @return array<string, string>
 */
function multipartHeaders(): array
{
    return ['Content-Type' => 'multipart/form-data', 'Accept' => 'application/json'];
}

/**
 * Drużyna usunięta miękko z żywymi zawodnikami. Kaskada w `Team` nie dopuszcza
 * do tego stanu przez model, więc test stawia go z pominięciem zdarzeń —
 * wiązanie zawodnika z trasy ma go obsłużyć i tak (#79, pkt 5), bo wiersze
 * mogą powstać poza modelem.
 */
function softDeleteTeamLeavingPlayers(Team $team): void
{
    Team::withoutEvents(fn () => $team->delete());

    expect($team->players()->withTrashed()->whereNull('deleted_at')->exists())->toBeTrue();
}

/**
 * Czy drugie połączenie wstawi kolejkę na samym końcu indeksu `rounds`, póki
 * transakcja testu trzyma blokady tego, co test zrobił przed chwilą. Koniec
 * indeksu to miejsce, w które trafiają kolejki każdej nowej fazy, więc
 * blokada szczeliny w tym miejscu zderza ze sobą generowania w niezależnych
 * turniejach (deadlock z E2E przy trzech workerach). Faza o tym id nie
 * istnieje, dlatego sonda wyłącza u siebie klucze obce; czeka najwyżej
 * sekundę i niczego nie zostawia.
 */
function anotherConnectionCanAppendRound(): bool
{
    config(['database.connections.probe' => config('database.connections.'.DB::getDefaultConnection())]);
    $probe = DB::connection('probe');
    $probe->statement('SET SESSION innodb_lock_wait_timeout = 1');
    $probe->statement('SET SESSION foreign_key_checks = 0');
    $probe->beginTransaction();

    try {
        $probe->table('rounds')->insert(['stage_id' => 4_294_967_295, 'name' => 'Sonda', 'order' => 1]);

        return true;
    } catch (QueryException $e) {
        // 1205: „Lock wait timeout exceeded”.
        if (($e->errorInfo[1] ?? null) !== 1205) {
            throw $e;
        }

        return false;
    } finally {
        $probe->rollBack();
        DB::purge('probe');
    }
}

/**
 * Uruchamia `$test` poza transakcją `RefreshDatabase`. Laravel ponawia
 * transakcję po deadlocku tylko na najwyższym poziomie, a w zagnieżdżonej
 * rzuca `DeadlockException` — inaczej test ponowienia nie zobaczy. Wszystko,
 * co `$test` zapisze, zostaje zatwierdzone, dlatego helper czyści potem każdą
 * tabelę poza `migrations` i `sports` (sporty wstawia migracja) i otwiera
 * transakcję z powrotem, żeby `RefreshDatabase` miał co wycofać.
 */
function outsideTestTransaction(Closure $test): void
{
    $connection = DB::connection();
    $connection->rollBack();

    try {
        $test();
    } finally {
        $schema = $connection->getSchemaBuilder();
        $schema->withoutForeignKeyConstraints(function () use ($schema, $connection): void {
            foreach ($schema->getTableListing(schemaQualified: false) as $table) {
                if (! in_array($table, ['migrations', 'sports'], true)) {
                    $connection->table($table)->delete();
                }
            }
        });
        $connection->beginTransaction();
    }
}

/**
 * Udaje deadlock (1213) na pierwszych `$times` zapytaniach zaczynających się
 * od `$sqlPrefix`, zanim trafią do bazy. Laravel rozpoznaje go po komunikacie
 * MySQL-a, tak samo jak prawdziwy.
 */
function failWithDeadlock(string $sqlPrefix, int $times): void
{
    DB::connection()->beforeExecuting(function (string $query) use ($sqlPrefix, &$times): void {
        if ($times > 0 && str_starts_with($query, $sqlPrefix)) {
            $times--;

            throw new QueryException(DB::getDefaultConnection(), $query, [], new PDOException(
                'SQLSTATE[40001]: Serialization failure: 1213 Deadlock found when trying to get lock; try restarting transaction'
            ));
        }
    });
}
