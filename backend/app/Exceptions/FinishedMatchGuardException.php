<?php

namespace App\Exceptions;

use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Rzucane, gdy ktoś próbuje usunąć byt powiązany z meczem o statusie `finished`.
 *
 * Celowo **409 Conflict**, a nie 403: organizer ma pełne prawo do tego turnieju,
 * więc odpowiedź „nie wolno ci" byłaby kłamstwem. Blokuje go stan danych —
 * rozegrany mecz — a nie brak uprawnień.
 */
class FinishedMatchGuardException extends ConflictHttpException
{
    public function __construct(string $what)
    {
        parent::__construct("Nie można usunąć: {$what} ma powiązane rozegrane mecze.");
    }
}
