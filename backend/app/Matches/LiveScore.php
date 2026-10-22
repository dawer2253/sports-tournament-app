<?php

namespace App\Matches;

use App\Leaderboards\MatchScorers;
use App\Models\GameMatch;
use App\Models\MatchEvent;

/**
 * Wynik meczu trwającego zmieniany zdarzeniami (#317, ADR-0013).
 *
 * Zdarzenie-zdobycz (typ ze statystyki-zdobyczy sportu, samobój przeciwnikowi)
 * przesuwa zapisany wynik o swoją wartość, ale wyłącznie w meczu `live`. Mecz
 * zakończony zostaje bez zmian, a sport z setami nigdy: jego wynik to sety
 * liczone przez serwer, a zdarzenia to wybrane akcje (ADR-0012).
 */
final class LiveScore
{
    /**
     * Zdobycz zdarzenia jako `[gospodarz, gość]` według sportu turnieju;
     * `[0, 0]` dla kartki, faulu, typu spoza zdobyczy i sportu z setami.
     *
     * @return array{int, int}
     */
    public static function gainOf(MatchEvent $event): array
    {
        $match = $event->match;
        $sport = $match->stage->tournament->sport;

        if ($sport->hasSets()) {
            return [0, 0];
        }

        return MatchScorers::gain($event->type, $event->team_id, $match, MatchScorers::scoringValues($sport));
    }

    /**
     * Przesuwa zapisany wynik o różnicę zdobyczy. Status i wynik czytamy
     * z zablokowanego wiersza, żeby dwie bramki zapisane naraz nie nadpisały
     * się nawzajem; wynik nie schodzi poniżej 0 (obcięcie, nie 422).
     *
     * @param  array{int, int}  $after  zdobycz po zmianie zdarzenia
     * @param  array{int, int}  $before  zdobycz przed zmianą zdarzenia
     */
    public static function shift(GameMatch $match, array $after, array $before): void
    {
        $delta = [$after[0] - $before[0], $after[1] - $before[1]];

        if ($delta === [0, 0]) {
            return;
        }

        $locked = GameMatch::whereKey($match->id)->lockForUpdate()->firstOrFail();

        if ($locked->status !== 'live') {
            return;
        }

        $locked->update([
            'home_score' => max(0, ($locked->home_score ?? 0) + $delta[0]),
            'away_score' => max(0, ($locked->away_score ?? 0) + $delta[1]),
        ]);
    }
}
