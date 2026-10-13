<?php

namespace App\Http\Resources;

use App\Leaderboards\MatchScorers;
use App\Models\GameMatch;
use App\Models\Sport;
use Illuminate\Http\Request;

/**
 * Mecz strony publicznej (`PublicMatch`, #208): kształt `Match`
 * (`MatchResource`) plus strzelcy policzeni przy odczycie. Sport przychodzi
 * z zewnątrz, jak w `MatchEventResource`, bo lista nie może pytać o niego co
 * wiersz.
 *
 * Oczekuje tego co `MatchResource` oraz zdarzeń wczytanych przez
 * `MatchScorers::eagerLoad()`.
 *
 * @mixin GameMatch
 */
class PublicMatchResource extends MatchResource
{
    public function __construct(GameMatch $match, private Sport $sport)
    {
        parent::__construct($match);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + [
            'scorers' => MatchScorers::of($this->resource, $this->sport),
        ];
    }
}
