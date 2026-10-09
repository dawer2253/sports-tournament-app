<?php

namespace App\Models\Concerns;

use App\Exceptions\PublicFileCleanupException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Logo turnieju i herb drużyny: plik na dysku `public`, a w kolumnie
 * `logo_path` jego ścieżka (#88, #111). Adres składa wyłącznie `logoUrl()`,
 * żeby host zawsze szedł z bieżącego `APP_URL` i nikt nie składał go sam.
 *
 * Nazwę pliku nadaje `store()` (40 losowych znaków i rozszerzenie z treści),
 * więc każdy upload daje nowy adres i nie trzeba wersji w adresie.
 *
 * Stary plik znika dopiero po commicie: wycofana transakcja nie może zostawić
 * wiersza wskazującego skasowany plik. Nieudane kasowanie idzie do
 * `report()`, a odpowiedź zostaje sukcesem — sierota na dysku jest tańsza niż
 * błąd po zapisanej zmianie.
 */
trait HasLogo
{
    /** Katalog na dysku `public`, w którym ląduje plik. */
    abstract protected function logoDirectory(): string;

    public function logoUrl(): ?string
    {
        return $this->logo_path === null ? null : Storage::disk('public')->url($this->logo_path);
    }

    /**
     * Najpierw nowy plik, potem wiersz, a po commicie skasowanie starego.
     * Nieudany zapis wiersza kasuje nowy plik i idzie dalej, więc stary plik
     * i `logo_path` zostają. Dwa równoległe uploady mogą zostawić sierotę —
     * to akceptujemy (#111, pkt 6).
     */
    public function replaceLogo(UploadedFile $file): void
    {
        $previousPath = $this->logo_path;
        $newPath = $file->store($this->logoDirectory(), 'public');

        if ($newPath === false) {
            throw new RuntimeException("Nie udało się zapisać pliku w „{$this->logoDirectory()}”.");
        }

        try {
            $this->forceFill(['logo_path' => $newPath])->save();
        } catch (Throwable $exception) {
            $this->logo_path = $previousPath;
            Storage::disk('public')->delete($newPath);

            throw $exception;
        }

        self::deletePublicPathAfterCommit($previousPath);
    }

    /** Bez logo nic się nie dzieje — operacja jest idempotentna (kontrakt). */
    public function removeLogo(): void
    {
        $previousPath = $this->logo_path;

        if ($previousPath === null) {
            return;
        }

        $this->forceFill(['logo_path' => null])->save();

        self::deletePublicPathAfterCommit($previousPath);
    }

    /**
     * Kasuje plik albo cały katalog po commicie bieżącej transakcji, a bez
     * transakcji od razu. Dysk ma `'throw' => false`, więc porażkę zgłasza
     * zwracając `false`, ale łapany jest też wyjątek — na wypadek dysku
     * skonfigurowanego inaczej.
     */
    protected static function deletePublicPathAfterCommit(?string $path, bool $directory = false): void
    {
        if ($path === null) {
            return;
        }

        DB::afterCommit(function () use ($path, $directory): void {
            $disk = Storage::disk('public');

            try {
                $deleted = $directory ? $disk->deleteDirectory($path) : $disk->delete($path);
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
