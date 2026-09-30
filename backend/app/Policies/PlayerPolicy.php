<?php

namespace App\Policies;

use App\Models\Player;
use App\Models\User;

/**
 * Zawodnik należy do organizera przez drużynę i jej turniej, więc reguła
 * własności zostaje w `TournamentPolicy` — tutaj tylko przejście przez relacje.
 *
 * `$player->team` nie bywa tu `null`: wiązanie zawodnika z trasy wymaga żywej
 * drużyny (`Player::resolveRouteBinding`), a `SoftDeletes` ukryłby usuniętą
 * także w relacji.
 */
class PlayerPolicy
{
    public function __construct(private TournamentPolicy $tournaments) {}

    public function manage(User $user, Player $player): bool
    {
        return $this->tournaments->manage($user, $player->team->tournament);
    }
}
