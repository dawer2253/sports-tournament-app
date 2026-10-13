<?php

namespace App\Http\Resources;

use App\Matches\MatchPeriods;
use App\Matches\MatchRelation;
use App\Models\GameMatch;
use App\Models\Sport;
use Illuminate\Http\Request;

/**
 * Strona meczu (`PublicMatchDetail`, #210): `PublicMatch` ze strzelcami
 * plus relacja z częścią meczu i wynikiem po zdarzeniu (`MatchRelation`).
 *
 * Oczekuje tego co `MatchResource` oraz zdarzeń wczytanych przez
 * `MatchRelation::eagerLoad()` — z nich liczą się też strzelcy.
 *
 * @mixin GameMatch
 */
class PublicMatchDetailResource extends PublicMatchResource
{
    public function __construct(GameMatch $match, private Sport $sport, private MatchPeriods $periods)
    {
        parent::__construct($match, $sport);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + MatchRelation::of($this->resource, $this->sport, $this->periods);
    }
}
