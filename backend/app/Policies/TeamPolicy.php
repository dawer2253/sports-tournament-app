<?php

namespace App\Policies;

use App\Models\Team;
use App\Models\User;

/**
 * Drużyna należy do organizera przez turniej, więc reguła własności zostaje
 * w `TournamentPolicy` — tutaj tylko przejście przez relację.
 */
class TeamPolicy
{
    public function __construct(private TournamentPolicy $tournaments) {}

    public function manage(User $user, Team $team): bool
    {
        return $this->tournaments->manage($user, $team->tournament);
    }
}
