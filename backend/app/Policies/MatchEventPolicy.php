<?php

namespace App\Policies;

use App\Models\MatchEvent;
use App\Models\User;

/**
 * Zdarzenie należy do organizera przez mecz, fazę i turniej, więc reguła
 * własności zostaje w `TournamentPolicy` — tutaj tylko przejście przez relacje.
 */
class MatchEventPolicy
{
    public function __construct(private TournamentPolicy $tournaments) {}

    public function manage(User $user, MatchEvent $event): bool
    {
        return $this->tournaments->manage($user, $event->match->stage->tournament);
    }
}
