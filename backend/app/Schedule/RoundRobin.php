<?php

namespace App\Schedule;

use InvalidArgumentException;

/**
 * Pary „każdy z każdym” według tablic Bergera (FIDE Handbook C.05, Annex 1),
 * razem z gospodarzem — orientacja z minimum n − 2 przerw w rundzie
 * (`docs/research/circle-method-berger.md` §3 i §4.2, decyzja #157).
 *
 * Czysta arytmetyka na pozycjach 0…n − 1: kto stoi na której pozycji,
 * rozstrzyga losowanie w `ScheduleGenerator`, a nie ta klasa.
 */
final class RoundRobin
{
    /**
     * Kolejki fazy jako listy par [gospodarz, gość].
     *
     * Przy nieparzystym n dochodzi widmo z najwyższym numerem, tak jak w
     * tablicach FIDE. Mecz z widmem to pauza, więc wypada z kolejki zamiast
     * stać w niej jako wiersz (decyzja #24).
     *
     * `meetings: 2` to czyste lustro: kolejka n − 1 + t (n przy nieparzystym)
     * powtarza kolejkę t z odwróconym gospodarzem.
     *
     * @return list<list<array{int, int}>>
     */
    public static function rounds(int $teams, int $meetings): array
    {
        if ($teams < 2) {
            throw new InvalidArgumentException("Terminarz potrzebuje co najmniej dwóch drużyn, podano {$teams}.");
        }

        if ($meetings !== 1 && $meetings !== 2) {
            throw new InvalidArgumentException("Para spotyka się raz albo dwa razy, podano {$meetings}.");
        }

        $slots = $teams + $teams % 2;
        $ghost = $slots > $teams ? $slots : null;

        $firstLeg = array_map(
            fn (array $round): array => array_values(array_filter(
                $round,
                fn (array $pair): bool => ! in_array($ghost, $pair, true),
            )),
            self::bergerTable($slots),
        );

        $rounds = $firstLeg;

        if ($meetings === 2) {
            foreach ($firstLeg as $round) {
                $rounds[] = array_map(fn (array $pair): array => [$pair[1], $pair[0]], $round);
            }
        }

        return array_map(
            fn (array $round): array => array_map(fn (array $pair): array => [$pair[0] - 1, $pair[1] - 1], $round),
            $rounds,
        );
    }

    /**
     * Tablica Bergera dla parzystego n, w numeracji FIDE (od jedynki).
     *
     * Kolejka 1 to 1 − n, 2 − (n − 1)…, czyli niższy numer gospodarzem. Każda
     * następna powstaje przez dodanie n/2 do każdego numeru poza n (modulo
     * n − 1, w zakresie 1…n − 1), z zachowaniem stron. Wyjątkiem jest numer n,
     * który zmienia stronę co kolejkę.
     *
     * @return list<list<array{int, int}>>
     */
    private static function bergerTable(int $n): array
    {
        $shift = fn (int $team): int => $team === $n ? $n : ($team - 1 + intdiv($n, 2)) % ($n - 1) + 1;

        $round = [[1, $n]];
        for ($k = 1; $k < intdiv($n, 2); $k++) {
            $round[] = [1 + $k, $n - $k];
        }

        $table = [$round];
        for ($r = 1; $r < $n - 1; $r++) {
            $round = array_map(fn (array $pair): array => match ($n) {
                $pair[1] => [$n, $shift($pair[0])],
                $pair[0] => [$shift($pair[1]), $n],
                default => [$shift($pair[0]), $shift($pair[1])],
            }, $round);
            $table[] = $round;
        }

        return $table;
    }
}
