<?php

namespace App\Matches;

use App\Models\GameMatch;
use Carbon\CarbonInterface;

/**
 * Bieżąca część meczu na żywo (#297): które kolumny zegara zmienia zapis
 * meczu. Reguły stoją w opisie `MatchUpdate` w kontrakcie, a walidację pól
 * części robi `UpdateMatchRequest`.
 *
 * Start części stempluje serwer swoim czasem, klient czasu nie wysyła. Minutę
 * liczy przeglądarka z `period_started_at`, więc tu jej nie ma.
 */
final class LiveClock
{
    /**
     * Kolumny zegara po zapisie: najpierw skutek zmiany stanu, potem pola
     * części z ciała, które go nadpisują.
     *
     * `status: live` meczu, który już trwa, zegara nie rusza: okno meczu
     * wysyła stan przy każdym „Zapisz”. Powrót z `finished` do `live` wraca do
     * ostatniej części bez zegara i bez przerwy — tablica pokazuje wtedy samo
     * „Na żywo”, a nie minutę od 1′.
     *
     * @param  array<string, mixed>  $data  zwalidowane ciało `PATCH /matches/{match}`
     * @return array<string, mixed>
     */
    public static function changes(GameMatch $match, array $data, CarbonInterface $now): array
    {
        $before = $match->status;
        $after = $data['status'] ?? $before;
        $changes = [];

        if ($after !== $before) {
            $changes = match ($after) {
                'live' => $before === 'scheduled'
                    ? ['live_period' => 1, 'period_started_at' => $now, 'on_break' => false]
                    : ['live_period' => $match->live_period ?? 1, 'period_started_at' => null, 'on_break' => false],
                // Ostatnia część zostaje w bazie na wypadek powrotu do `live`.
                'finished' => ['period_started_at' => null, 'on_break' => false],
                default => ['live_period' => null, 'period_started_at' => null, 'on_break' => false],
            };
        }

        if (array_key_exists('periodRunning', $data)) {
            $changes = $data['periodRunning']
                ? ['live_period' => $data['livePeriod'], 'period_started_at' => $now, 'on_break' => false]
                : [...$changes, 'period_started_at' => null, 'on_break' => true];
        }

        return $changes;
    }
}
