<?php

namespace App\Policies;

use App\Models\TeamRegistration;
use App\Models\User;

/**
 * Zgłoszenie należy do organizera przez turniej, więc reguła własności
 * zostaje w `TournamentPolicy` — tutaj tylko przejście przez relację.
 */
class TeamRegistrationPolicy
{
    public function __construct(private TournamentPolicy $tournaments) {}

    public function manage(User $user, TeamRegistration $registration): bool
    {
        return $this->tournaments->manage($user, $registration->tournament);
    }
}
