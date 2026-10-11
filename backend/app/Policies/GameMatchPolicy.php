<?php

namespace App\Policies;

use App\Models\GameMatch;
use App\Models\User;

/**
 * Mecz należy do organizera przez fazę, a faza przez turniej, więc reguła
 * własności zostaje w `TournamentPolicy` — tutaj tylko przejście przez relację.
 * Klasa nosi nazwę modelu (`GameMatch`), bo tak wykrywa ją Laravel; byt
 * w domenie i w API nazywa się `Match` (ADR-0005).
 */
class GameMatchPolicy
{
    public function __construct(private TournamentPolicy $tournaments) {}

    public function manage(User $user, GameMatch $match): bool
    {
        return $this->tournaments->manage($user, $match->stage->tournament);
    }
}
