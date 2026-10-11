<?php

namespace App\Schedule;

use Illuminate\Support\Facades\DB;

/**
 * Wypełnienie `tournaments.match_duration` długością ze sportu turnieju.
 * Wydzielone z migracji, żeby dało się to sprawdzić testem: migracja sama
 * biegnie raz na czystej bazie, gdzie nie ma jeszcze żadnego turnieju.
 *
 * Logika jest addytywna i idempotentna — nadpisuje wartość każdego turnieju
 * wartością jego sportu. Po migracji żaden turniej nie jest jeszcze ruszany
 * przez organizerów, więc nie ma czego „poprawiać” po cichu.
 */
class MatchDurationBackfill
{
    public static function run(): void
    {
        foreach (DB::table('sports')->pluck('config', 'id') as $sportId => $config) {
            $duration = json_decode($config, true)['defaultMatchDuration'] ?? null;

            if ($duration === null) {
                continue;
            }

            DB::table('tournaments')->where('sport_id', $sportId)->update(['match_duration' => $duration]);
        }
    }
}
