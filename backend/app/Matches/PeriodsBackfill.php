<?php

namespace App\Matches;

use Illuminate\Support\Facades\DB;

/**
 * Wypełnienie `tournaments.period_count` i `period_minutes` podziałem meczu
 * ze sportu turnieju (#210). Wydzielone z migracji jak
 * `MatchDurationBackfill`, żeby dało się to sprawdzić testem: migracja biegnie
 * raz na czystej bazie, gdzie nie ma jeszcze żadnego turnieju.
 *
 * Nadpisuje podział każdego turnieju podziałem jego sportu, więc jest
 * idempotentne. Przed migracją żaden organizer nie mógł go ustawić.
 */
class PeriodsBackfill
{
    public static function run(): void
    {
        foreach (DB::table('sports')->pluck('config', 'id') as $sportId => $config) {
            $periods = json_decode($config, true)['defaultPeriods'] ?? null;

            if ($periods === null) {
                continue;
            }

            DB::table('tournaments')->where('sport_id', $sportId)->update([
                'period_count' => $periods['count'],
                'period_minutes' => $periods['minutes'],
            ]);
        }
    }
}
