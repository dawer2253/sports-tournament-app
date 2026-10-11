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
        } elseif ($scored < $conceded) {
            $this->lost++;
            $this->points += $points['loss'];
        } else {
            $this->drawn++;
            $this->points += $points['draw'];
        }
    }

    public function scoreDifference(): int
    {
        return $this->scoreFor - $this->scoreAgainst;
    }
}
