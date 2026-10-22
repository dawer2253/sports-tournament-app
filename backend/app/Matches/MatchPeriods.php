<?php

namespace App\Matches;

use App\Models\Tournament;

/**
 * Podział meczu turnieju na części (`Tournament.periods`, #210): połowy,
 * tercje, kwarty. Ustawienie turnieju, a nie sportu, bo amatorskie mecze
 * mają różne części, a w koszu bywa bez kwart.
 *
 * Część zdarzenia liczy się przy odczycie z jego minuty, więc zmiana
 * ustawienia działa wstecz na wszystkie mecze turnieju.
 */
final readonly class MatchPeriods
{
    /**
     * Rzeczownik etykiety według liczby części, nie według sportu: kosz
     * grany w połowach ma „połowy”. Inna liczba części to „część”.
     */
    private const NOUNS = [2 => 'połowa', 3 => 'tercja', 4 => 'kwarta'];

    private const FALLBACK_NOUN = 'część';

    /**
     * @param  int  $count  liczba części, 1 to „bez podziału”
     * @param  ?int  $minutes  minuty jednej części, `null` przy jednej części
     */
    public function __construct(public int $count, public ?int $minutes) {}

    public static function of(Tournament $tournament): self
    {
        return new self($tournament->period_count, $tournament->period_minutes);
    }

    /** Czy turniej gra bez podziału: wtedy żadne zdarzenie nie ma części. */
    public function isUndivided(): bool
    {
        return $this->count === 1;
    }

    /**
     * Numer części zdarzenia z samej minuty (bez doliczonego czasu, #317):
     * `min(count, ceil(minute / minutes))`. „45+3” zostaje więc w 1. połowie,
     * a dogrywka trafia do ostatniej części. Stare zdarzenie z doliczonym
     * czasem zapisanym zwykłą liczbą (`47`) trafia do następnej części. `null`
     * bez minuty i w turnieju bez podziału.
     */
    public function periodOf(?int $minute): ?int
    {
        if ($minute === null || $this->isUndivided()) {
            return null;
        }

        return min($this->count, (int) ceil($minute / $this->minutes));
    }

    /** Etykieta części z numerem, np. „1. połowa”. */
    public function label(int $number): string
    {
        return $number.'. '.(self::NOUNS[$this->count] ?? self::FALLBACK_NOUN);
    }

    /**
     * @return array{count: int, minutes: ?int}
     */
    public function toArray(): array
    {
        return ['count' => $this->count, 'minutes' => $this->minutes];
    }
}
