<?php

namespace App\Rules;

use Closure;
use DateTimeZone;
use Illuminate\Contracts\Validation\ValidationRule;
use Throwable;

/**
 * Strefa IANA (`Europe/Warsaw`), potrzebna rozkładowi dat do arytmetyki
 * „+7 dni o tej samej godzinie” i „następny dzień o godzinie startu”. Panel
 * bierze ją z przeglądarki (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
 */
class IanaTimeZone implements ValidationRule
{
    public const MESSAGE = 'Podaj strefę czasową w formacie IANA, np. Europe/Warsaw.';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! $this->isValid($value)) {
            $fail(self::MESSAGE);
        }
    }

    private function isValid(string $value): bool
    {
        try {
            new DateTimeZone($value);

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
