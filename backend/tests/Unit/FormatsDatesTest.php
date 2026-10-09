<?php

use App\Http\Resources\Concerns\FormatsDates;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * Zasób-atrapa: trait jest jedynym miejscem nadającym format, więc test bierze
 * go wprost, bez modelu i bez żądania HTTP.
 */
function dateFormatter(): object
{
    return new class
    {
        use FormatsDates;

        public function format(?DateTimeInterface $date): ?string
        {
            return $this->formatDate($date);
        }
    };
}

it('oddaje datę w ISO 8601 z offsetem +00:00, bez mikrosekund', function () {
    expect(dateFormatter()->format(Carbon::parse('2026-10-04 10:00:00.123456', 'UTC')))
        ->toBe('2026-10-04T10:00:00+00:00');
});

// Strefa aplikacji to UTC (ADR-0008), ale data spoza modelu może przyjść
// z innym offsetem. Ten sam moment ma wyjść w +00:00, a nie z obcym offsetem.
it('przelicza datę z innym offsetem na ten sam moment w UTC', function () {
    expect(dateFormatter()->format(CarbonImmutable::parse('2026-10-04T12:00:00+02:00')))
        ->toBe('2026-10-04T10:00:00+00:00');
});

it('nie zmienia strefy przekazanej daty', function () {
    $date = Carbon::parse('2026-10-04T12:00:00+02:00');

    dateFormatter()->format($date);

    expect($date->getOffsetString())->toBe('+02:00');
});

// `kickoffAt` meczu jest w kontrakcie nullowalne.
it('oddaje null dla braku daty', function () {
    expect(dateFormatter()->format(null))->toBeNull();
});
