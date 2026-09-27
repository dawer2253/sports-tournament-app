<?php

namespace App\Policies;

use App\Models\Tournament;
use App\Models\User;

/**
 * Turniej jest jedynym korzeniem własności (decyzja #5), więc dostęp do niego
 * i do całego poddrzewa rozstrzyga `user_id`. Odmowa to 403 z kontraktu
 * (`Forbidden`), a nie 404 — wykrywa ją policy, nie zawężone zapytanie.
 */
class TournamentPolicy
{
    public function view(User $user, Tournament $tournament): bool
    {
        return $tournament->user()->is($user);
    }
}
