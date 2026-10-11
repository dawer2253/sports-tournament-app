<?php

namespace App\Schedule;

use Carbon\CarbonImmutable;

/**
 * Wejście rozkładu dat (`POST /stages/{stage}/schedule/dates`), już
 * zwalidowane i przeliczone przez Form Request. `startAt` jest w UTC
 * (ADR-0008), a arytmetyka dnia dzieje się w `timeZone`.
 */
final readonly class DatePlan
{
    /**
     * @param  'interval'|'continuous'  $mode
     * @param  list<int>  $venueIds
     */
    public function __construct(
        public string $mode,
        public CarbonImmutable $startAt,
        public string $timeZone,
        public ?int $intervalDays,
        public ?string $dayEndTime,
        public array $venueIds,
        public ?int $fromRound,
    ) {}
}
