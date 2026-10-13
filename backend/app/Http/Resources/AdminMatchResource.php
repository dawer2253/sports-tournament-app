<?php

namespace App\Http\Resources;

use App\Models\GameMatch;
use Illuminate\Http\Request;

/**
 * Mecz dla panelu: kształt `Match` (`MatchResource`) plus `collisions`
 * policzone przy odczycie (#158). Strona publiczna oddaje `PublicMatchResource`,
 * bo kolizja to narzędzie organizatora.
 *
 * Kolizje przychodzą z zewnątrz, z jednego przebiegu po całym turnieju, a nie
 * z `toArray()`: `CollisionCalculator::forTournament()` liczy je raz dla całej
 * strony, a każdy zasób tylko wyjmuje swój wpis.
 *
 * @mixin GameMatch
 */
class AdminMatchResource extends MatchResource
{
    /**
     * @param  array<int, list<array{type: string, matchId: int}>>  $collisions
     */
    public function __construct(GameMatch $match, private array $collisions = [])
    {
        parent::__construct($match);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + [
            'collisions' => $this->collisions[$this->resource->id] ?? [],
        ];
    }
}
