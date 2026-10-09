<?php

namespace App\Exceptions;

use RuntimeException;
use Throwable;

/**
 * Nie udało się skasować pliku albo katalogu z dysku `public` po zmianie,
 * która go osierociła. Nigdy nie jest rzucany do klienta, tylko trafia do
 * `report()`: wiersz w bazie jest już zapisany, więc odpowiedź zostaje
 * sukcesem, a na dysku zostaje sierota do sprzątnięcia ręcznie (#111).
 */
class PublicFileCleanupException extends RuntimeException
{
    public static function for(string $path, ?Throwable $previous = null): self
    {
        return new self("Nie udało się skasować „{$path}” z dysku public.", previous: $previous);
    }
}
