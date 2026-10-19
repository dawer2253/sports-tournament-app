<?php

namespace App\Standings;

use App\Models\Team;

/**
 * Wiersz tabeli w trakcie liczenia: bilans drużyny z zakończonych meczów.
 * Ten sam kształt liczy też mini-tabelę `head_to_head`, tylko z meczów
 * między remisującymi.
 */
final class StandingRow
{
    /** Miejsce nadaje kalkulator po posortowaniu, `1..n`. */
    public int $position = 0;

    public int $played = 0;

    public int $won = 0;

    public int $drawn = 0;

    public int $lost = 0;

    public int $scoreFor = 0;

    public int $scoreAgainst = 0;

    public int $points = 0;

    /** @var list<'win'|'draw'|'loss'> wyniki w kolejności doliczania */
    private array $results = [];

    public function __construct(public readonly Team $team) {}

    /**
     * Dolicza jeden zakończony mecz z perspektywy tej drużyny.
     *
     * @param  array{win: int, draw: int, loss: int}  $points
     */
    public function record(int $scored, int $conceded, array $points): void
    {
        $this->played++;
        $this->scoreFor += $scored;
        $this->scoreAgainst += $conceded;

        if ($scored > $conceded) {
            $this->won++;
            $this->points += $points['win'];
            $this->results[] = 'win';
        } elseif ($scored < $conceded) {
            $this->lost++;
            $this->points += $points['loss'];
            $this->results[] = 'loss';
        } else {
            $this->drawn++;
            $this->points += $points['draw'];
            $this->results[] = 'draw';
        }
    }

    /**
     * Forma: wyniki pięciu ostatnio doliczonych meczów, najnowszy na końcu.
     * Kolejność doliczania ustala kalkulator (po kolejce).
     *
     * @return list<'win'|'draw'|'loss'>
     */
    public function form(): array
    {
        return array_slice($this->results, -5);
    }

    public function scoreDifference(): int
    {
        return $this->scoreFor - $this->scoreAgainst;
    }
}
