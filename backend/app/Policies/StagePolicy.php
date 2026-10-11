<?php

namespace App\Policies;

use App\Models\Stage;
use App\Models\User;

/**
 * Faza należy do organizera przez turniej, więc reguła własności zostaje
 * w `TournamentPolicy` — tutaj tylko przejście przez relację.
 */
class StagePolicy
{
    public function __construct(private TournamentPolicy $tournaments) {}

    public function manage(User $user, Stage $stage): bool
    {
        return $this->tournaments->manage($user, $stage->tournament);
    }
}
