<?php

namespace App\Rules;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\Validator;

/**
 * Górny limit dzieci rodzica (drużyn turnieju, zawodników drużyny, obiektów
 * turnieju) dla `after()` w Form Requeście tworzącym dziecko.
 *
 * Limit to stan rodzica, nie pole z ciała, więc błąd idzie pod klucz kolekcji
 * (`teams`, `players`, `venues` — tak stanowi kontrakt). Relacje rodziców
 * pomijają dzieci usunięte miękko, więc te się do limitu nie liczą.
 *
 * Sprawdzenie i zapis to dwa kroki, więc równoległe żądania mogą razem
 * przekroczyć limit. Dla panelu jednego organizera to akceptowalne; blokada
 * wiersza rodzica byłaby tu na wyrost. To samo dotyczy unikalności wśród
 * żywego rodzeństwa (`UniqueAmongLiveSiblings`), której nie pilnuje indeks.
 */
final class ChildLimit
{
    /**
     * @return callable(Validator): void
     */
    public static function check(HasMany $children, int $max, string $errorKey, string $message): callable
    {
        return function (Validator $validator) use ($children, $max, $errorKey, $message): void {
            if ($children->count() >= $max) {
                $validator->errors()->add($errorKey, $message);
            }
        };
    }
}
