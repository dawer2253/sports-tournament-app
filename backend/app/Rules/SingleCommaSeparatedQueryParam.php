<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\Request;

/**
 * Pilnuje, że tablicowy parametr query przyszedł w kształcie, który opisuje
 * kontrakt: **raz**, z wartościami po przecinku (`?status=draft,active`).
 *
 * Odrzuca dwa kształty, w których PHP po cichu gubi wartości:
 *
 * - powtórzony klucz (`?status=draft&status=active`) — w `$_GET` zostaje sama
 *   ostatnia wartość;
 * - notacja nawiasowa (`?status[]=draft`) — kontrakt nie umie jej opisać żadnym
 *   `style`.
 *
 * Reguła siedzi tutaj, a nie przy konkretnym Form Requeście, bo przecinek jest
 * konwencją **całego** kontraktu (`## Konwencje` w `openapi.yaml`), więc następny
 * tablicowy parametr potrzebuje dokładnie tego samego sprawdzenia.
 *
 * Patrzy na surowy query string, bo w `$_GET` śladu po powtórzeniu już nie ma.
 */
readonly class SingleCommaSeparatedQueryParam implements ValidationRule
{
    public function __construct(private Request $request) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $occurrences = 0;
        $bracketed = false;

        foreach (explode('&', (string) $this->request->server('QUERY_STRING')) as $pair) {
            if ($pair === '') {
                continue;
            }

            $key = urldecode(explode('=', $pair, 2)[0]);

            if ($key === $attribute) {
                $occurrences++;
            } elseif (str_starts_with($key, $attribute.'[')) {
                $occurrences++;
                $bracketed = true;
            }
        }

        if ($occurrences > 1 || $bracketed) {
            $fail("Parametr :attribute podaj raz, z wartościami po przecinku, np. {$attribute}=draft,active.");
        }
    }
}
