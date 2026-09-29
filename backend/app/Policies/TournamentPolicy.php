<?php

namespace App\Policies;

use App\Models\Tournament;
use App\Models\User;

/**
 * Turniej jest jedynym korzeniem własności (decyzja #5), więc dostęp do niego
 * i do całego poddrzewa rozstrzyga `user_id`. Odmowa to 403 z kontraktu
 * (`Forbidden`), a nie 404 — wykrywa ją policy, nie zawężone zapytanie.
 *
 * Jedna zdolność `manage` obejmuje odczyt i zapis, bo dostęp do turnieju ma
 * dokładnie jedno konto („Organizer" w `CONTEXT.md`). Policy sprawdza
 * **wyłącznie własność**: kontrakt definiuje 403 jako „zasób należy do innego
 * organizera", więc ograniczenie wynikające ze statusu turnieju to reguła
 * domenowa i daje 422, a nie odmowę tutaj.
 *
 * Wołana z middleware'u `can` na trasie, nie z kontrolera — powody opisuje
 * „Autoryzacja poddrzewa turnieju" w `backend/AGENTS.md`.
 */
class TournamentPolicy
{
    public function manage(User $user, Tournament $tournament): bool
    {
        return $tournament->user()->is($user);
    }
}
