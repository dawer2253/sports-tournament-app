<?php

namespace App\Models\Concerns;

use App\Exceptions\PublicFileCleanupException;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Sprzątanie dysku `public` po zmianie w bazie, która osierociła plik albo
 * katalog (#111). Kasowanie idzie po commicie bieżącej transakcji, a bez
 * transakcji od razu: wycofana zmiana nie może zostawić wiersza wskazującego
 * skasowany plik.
 *
 * Porażka trafia do `report()`, a odpowiedź zostaje sukcesem — sierota na
 * dysku jest tańsza niż błąd po zapisanej zmianie. Dysk ma `'throw' => false`,
 * więc porażkę zgłasza, zwracając `false`, ale łapany jest też wyjątek — na
 * wypadek dysku skonfigurowanego inaczej.
 */
trait DeletesPublicFilesAfterCommit
{
    protected static function deletePublicFileAfterCommit(?string $path): void
    {
        self::afterCommitOnPublicDisk($path, fn ($disk): bool => $disk->delete($path));
    }

    protected static function deletePublicDirectoryAfterCommit(string $directory): void
    {
        self::afterCommitOnPublicDisk($directory, fn ($disk): bool => $disk->deleteDirectory($directory));
    }

    /** @param  callable(Filesystem): bool  $delete */
    private static function afterCommitOnPublicDisk(?string $path, callable $delete): void
    {
        if ($path === null) {
            return;
        }

        DB::afterCommit(function () use ($path, $delete): void {
            try {
                $deleted = $delete(Storage::disk('public'));
            } catch (Throwable $exception) {
                report(PublicFileCleanupException::for($path, $exception));

                return;
            }

            if (! $deleted) {
                report(PublicFileCleanupException::for($path));
            }
        });
    }
}
