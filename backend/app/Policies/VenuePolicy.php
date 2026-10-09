<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Venue;

/**
 * Obiekt należy do organizera przez turniej, więc reguła własności zostaje
 * w `TournamentPolicy` — tutaj tylko przejście przez relację.
 */
class VenuePolicy
{
    public function __construct(private TournamentPolicy $tournaments) {}

    public function manage(User $user, Venue $venue): bool
    {
        return $this->tournaments->manage($user, $venue->tournament);
    }
}
