<?php

namespace App\Matches;

/**
 * Reguły seta w sporcie z setami (#301, ADR-0012), wspólne dla walidacji
 * zapisu meczu, wyniku liczonego z setów i tabeli. Reguły opisuje
 * `MatchUpdate` w kontrakcie, a słownik hasło „Set” w `CONTEXT.md`.
 *
 * Format seta to `Tournament.setFormat`: `setsToWin`, `setPoints`,
 * `decidingSetPoints`, `minLead`. Set to `['home' => int, 'away' => int]`.
 */
final class SetScores
{
    public const COMPLETE = 'complete';

    public const INCOMPLETE = 'incomplete';

    public const INVALID = 'invalid';

    /**
     * Próg seta o indeksie `$index` (od 0): set decydujący, ostatni możliwy
     * (`2 × setsToWin − 1`), gra się do `decidingSetPoints`, a pozostałe do
     * `setPoints`.
     *
     * @param  array{setsToWin: int, setPoints: int, decidingSetPoints: int, minLead: int}  $format
     */
    public static function threshold(int $index, array $format): int
    {
        return $index === 2 * $format['setsToWin'] - 2 ? $format['decidingSetPoints'] : $format['setPoints'];
    }

    /**
     * Zakończony: zwycięzca ma próg, a przegrany co najwyżej próg minus
     * przewaga, albo (przy przewadze 2) zwycięzca przekroczył próg dokładnie
     * o dwa punkty — gra na przewagi. Niedokończony: gra może jeszcze trwać.
     * Każdy inny wynik jest niemożliwy.
     *
     * @param  array{home: int, away: int}  $set
     * @return self::COMPLETE|self::INCOMPLETE|self::INVALID
     */
    public static function classify(array $set, int $threshold, int $minLead): string
    {
        $winner = max($set['home'], $set['away']);
        $loser = min($set['home'], $set['away']);

        $complete = $winner > $loser && ($minLead === 1
            ? $winner === $threshold
            : ($winner === $threshold && $loser <= $threshold - 2) || ($winner > $threshold && $winner - $loser === 2));

        if ($complete) {
            return self::COMPLETE;
        }

        $incomplete = $minLead === 1
            ? $winner < $threshold
            : $winner < $threshold || ($winner - $loser <= 1 && $loser >= $threshold - 1);

        return $incomplete ? self::INCOMPLETE : self::INVALID;
    }

    /**
     * Sety wygrane `[gospodarz, gość]`. Liczą się tylko sety zakończone, więc
     * niedokończony ostatni set meczu trwającego wyniku nie zmienia.
     *
     * @param  list<array{home: int, away: int}>  $sets
     * @param  array{setsToWin: int, setPoints: int, decidingSetPoints: int, minLead: int}  $format
     * @return array{int, int}
     */
    public static function won(array $sets, array $format): array
    {
        $won = [0, 0];

        foreach ($sets as $index => $set) {
            if (self::classify($set, self::threshold($index, $format), $format['minLead']) === self::COMPLETE) {
                $won[$set['home'] > $set['away'] ? 0 : 1]++;
            }
        }

        return $won;
    }

    /**
     * Punkty w setach `[gospodarz, gość]`: suma punktów ze wszystkich setów.
     *
     * @param  list<array{home: int, away: int}>  $sets
     * @return array{int, int}
     */
    public static function rallyPoints(array $sets): array
    {
        return [
            array_sum(array_column($sets, 'home')),
            array_sum(array_column($sets, 'away')),
        ];
    }

    /**
     * Błędy listy setów meczu w danym stanie, po kluczach kontraktu:
     * `sets.{n}` przy secie, `sets` przy całym meczu. Pierwszy błędny set
     * kończy sprawdzanie, bo od niego nie wiadomo, kto prowadzi.
     *
     * @param  list<array{home: int, away: int}>  $sets
     * @param  array{setsToWin: int, setPoints: int, decidingSetPoints: int, minLead: int}  $format
     * @return array<string, string>
     */
    public static function errors(array $sets, string $status, array $format): array
    {
        if ($status === 'scheduled') {
            return $sets === [] ? [] : ['sets' => 'Mecz zaplanowany nie ma setów. Wyczyść listę: sets: [].'];
        }

        $won = [0, 0];
        $last = array_key_last($sets);

        foreach ($sets as $index => $set) {
            $key = "sets.{$index}";

            if (max($won) >= $format['setsToWin']) {
                return [$key => 'Mecz rozstrzygnął się wcześniej, więc tego seta nie było.'];
            }

            $threshold = self::threshold($index, $format);
            $kind = self::classify($set, $threshold, $format['minLead']);

            if ($kind === self::INVALID) {
                return [$key => self::invalidMessage($set, $threshold, $format['minLead'])];
            }

            if ($kind === self::INCOMPLETE) {
                if ($index !== $last || $status === 'finished') {
                    return [$key => 'Set nie jest zakończony. Trwać może tylko ostatni set meczu trwającego.'];
                }

                continue;
            }

            $won[$set['home'] > $set['away'] ? 0 : 1]++;
        }

        if ($status === 'finished' && max($won) < $format['setsToWin']) {
            return ['sets' => "Mecz zakończony potrzebuje zwycięzcy: {$format['setsToWin']} wygranych setów."];
        }

        return [];
    }

    /**
     * @param  array{home: int, away: int}  $set
     */
    private static function invalidMessage(array $set, int $threshold, int $minLead): string
    {
        $rule = $minLead === 1
            ? "gra się do {$threshold} pkt"
            : sprintf('gra się do %d pkt, a od %2$d:%2$d na przewagi', $threshold, $threshold - 1);

        return "Set nie może skończyć się wynikiem {$set['home']}:{$set['away']}: {$rule}.";
    }
}
