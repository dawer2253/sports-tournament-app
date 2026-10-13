<?php

namespace App\Leaderboards;

use App\Models\Player;
use App\Models\Team;

/** Wiersz klasyfikacji: zawodnik, drużyna jego zdarzeń i suma wartości. */
final readonly class StatLeaderboardRow
{
    public function __construct(
        public int $position,
        public Player $player,
        public Team $team,
        public int $value,
    ) {}
}
