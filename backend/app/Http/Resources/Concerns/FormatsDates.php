<?php

namespace App\Http\Resources\Concerns;

use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Jedyne miejsce, które nadaje datom w odpowiedziach format z „Konwencji"
 * kontraktu: ISO 8601 z offsetem `+00:00` (ADR-0008). Każda data w zasobie
 * przechodzi przez `formatDate()`.
 *
 * Surowy Carbon wstawiony do tablicy zasobu wyszedłby jako `…000000Z` — to też
 * poprawny `date-time`, więc Spectator by go przepuścił. Nadpisane
 * `serializeDate` w modelu nie pomaga, bo zasób buduje tablicę sam, a
 * `Carbon::serializeUsing()` jest w Carbonie 3 `@deprecated`.
 */
trait FormatsDates
{
    /**
     * Przelicza na UTC kopię daty, więc moment zostaje ten sam, a przekazany
     * obiekt nie zmienia strefy. `null` przechodzi bez zmian (`kickoffAt`
     * meczu jest w kontrakcie nullowalne).
     */
    protected function formatDate(?DateTimeInterface $date): ?string
    {
        return $date === null ? null : CarbonImmutable::instance($date)->utc()->toIso8601String();
    }
}
