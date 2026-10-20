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

    /** Punkty w setach (#301); `null` w sporcie bez setów. */
    public ?int $rallyPointsFor = null;

    public ?int $rallyPointsAgainst = null;

    /** @var list<'win'|'draw'|'loss'> wyniki w kolejności doliczania */
    private array $results = [];

    /**
     * @param  bool  $sets  sport z setami: wiersz liczy punkty w setach, a mecz
     *                      wygrany różnicą jednego seta daje punkty po secie
     *                      decydującym
     */
    public function __construct(public readonly Team $team, private readonly bool $sets = false)
    {
        if ($sets) {
            $this->rallyPointsFor = 0;
            $this->rallyPointsAgainst = 0;
        }
    }

    /**
     * Dolicza jeden zakończony mecz z perspektywy tej drużyny. W sporcie
     * z setami zdobycze to sety wygrane, a `$rally` to punkty w setach
     * `[zdobyte, stracone]`; mecz rozstrzygnięty różnicą jednego seta (3:2,
     * 2:1) daje `winDecidingSet` i `lossDecidingSet` (#301).
     *
     * @param  array{win: int, draw: int, loss: int, winDecidingSet?: int, lossDecidingSet?: int}  $points
     * @param  array{int, int}|null  $rally
     */
    public function record(int $scored, int $conceded, array $points, ?array $rally = null): void
    {
        $this->played++;
        $this->scoreFor += $scored;
        $this->scoreAgainst += $conceded;

        if ($this->sets) {
            $this->rallyPointsFor += $rally[0] ?? 0;
            $this->rallyPointsAgainst += $rally[1] ?? 0;
        }

        $decidingSet = $this->sets && abs($scored - $conceded) === 1;

        if ($scored > $conceded) {
            $this->won++;
            $this->points += $decidingSet ? $points['winDecidingSet'] : $points['win'];
            $this->results[] = 'win';
        } elseif ($scored < $conceded) {
            $this->lost++;
            $this->points += $decidingSet ? $points['lossDecidingSet'] : $points['loss'];
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
