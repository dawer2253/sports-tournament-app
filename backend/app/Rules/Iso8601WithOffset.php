<?php

namespace App\Rules;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Date;
use Throwable;

/**
 * Data na wejściu z **wymaganym offsetem** (ADR-0008). Pierwszy `requestBody`
 * z datą (`POST /stages/{stage}/schedule/dates`, `startAt`) podlega trzem
 * regułom ADR-a; to jest ta jedna wspólna reguła, a nie kopia w każdym
 * Form Requeście.
 *
 * Data bez offsetu daje `422`, bo nie wiadomo, który moment klient miał na
 * myśli — domyślna strefa przesunęłaby mecz o godzinę lub dwie bez ostrzeżenia.
 * `toUtc()` przelicza przyjęty moment na UTC, bo Eloquent przy zapisie strefy
 * nie przelicza.
 */
class Iso8601WithOffset implements ValidationRule
{
    public const MESSAGE = 'Podaj datę z offsetem, np. 2026-09-06T10:00:00+02:00.';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! self::hasOffset($value)) {
            $fail(self::MESSAGE);

            return;
        }

        try {
            self::toUtc($value);
        } catch (Throwable) {
            $fail(self::MESSAGE);
        }
    }

    /** Czy napis kończy się offsetem `+02:00` albo `Z`. */
    public static function hasOffset(string $value): bool
    {
        return (bool) preg_match('/(?:Z|[+-]\d{2}:\d{2})$/', $value);
    }

    /**
     * Ten sam moment w UTC. `Date::parse` zachowuje offset napisu, a `utc()`
     * przelicza strefę — tą samą drogą co Eloquent („Kontekst" w ADR-0008).
     */
    public static function toUtc(string $value): CarbonImmutable
    {
        return CarbonImmutable::instance(Date::parse($value))->utc();
    }
}
