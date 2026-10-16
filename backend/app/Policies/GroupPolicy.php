<?php

namespace App\Policies;

use App\Models\Group;
use App\Models\User;

/**
 * Grupa należy do organizera przez turniej, więc reguła własności zostaje
 * w `TournamentPolicy` — tutaj tylko przejście przez relację.
 */
class GroupPolicy
{
    public function __construct(private TournamentPolicy $tournaments) {}

    public function manage(User $user, Group $group): bool
    {
        return $this->tournaments->manage($user, $group->tournament);
    }
}
