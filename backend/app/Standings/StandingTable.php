<?php

namespace App\Standings;

use App\Models\Sport;
use App\Models\Stage;

/**
 * Jedna policzona tabela: faza `league` albo grupa (`StandingTable`
 * w kontrakcie). Niesie kryteria, według których ją ułożono, żeby zdanie
 * pod tabelą zgadzało się z wierszami także w podglądzie.
 */
final readonly class StandingTable
{
    /**
     * @param  list<string>  $tiebreakers  kody `TiebreakerCode` w kolejności stosowania
     * @param  list<StandingRow>  $rows
     */
    public function __construct(
        public Stage $stage,
        public Sport $sport,
        public array $tiebreakers,
        public array $rows,
    ) {}
}
