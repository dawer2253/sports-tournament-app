<?php

namespace App\Models\Concerns;

use App\Exceptions\FinishedMatchGuardException;

/**
 * Guard: nie usuwamy bytu powiązanego z meczem `finished` — ani na twardo,
 * ani na miękko. Rozegrany turniej ma dalej działać pod swoim publicznym
 * adresem, więc historia jest nienaruszalna.
 *
 * Guard siedzi w zdarzeniu `deleting` modelu, a nie w Policy ani w kontrolerze,
 * bo to jedyne miejsce, którego nie ominie ani seeder, ani przyszły kod
 * porządkujący. Policy odpowiada za własność, i tylko za nią.
 *
 * **Zakres: byty, które organizer kasuje ręcznie** — `Tournament`, `Team`,
 * `Player`, `Venue`. Struktura rozgrywek (`Stage`, `Round`, `Group`, `GameMatch`)
 * guarda nie ma świadomie: zarządza nią generator terminarza, a regenerowanie
 * fazy z rozegranymi meczami to nie pomyłka do zablokowania, tylko operacja
 * z ostrzeżeniem i kaskadą (decyzja #15). Reguły dla niej powstają razem
 * z generatorem w S2 i S4.
 *
 * Kasowanie kaskadowe w bazie guarda nie uruchamia — dlatego `tournaments.user_id`
 * jest `RESTRICT`, żeby usunięcie konta nie obeszło go od góry (ADR-0005).
 */
trait GuardsFinishedMatches
{
    public static function bootGuardsFinishedMatches(): void
    {
        static::deleting(function (self $model) {
            if ($model->hasFinishedMatches()) {
                throw FinishedMatchGuardException::for($model->guardLabel());
            }
        });
    }

    /** Czy z tym bytem wiąże się choć jeden mecz `finished`. */
    abstract public function hasFinishedMatches(): bool;

    /** Nazwa bytu w komunikacie błędu. */
    abstract protected function guardLabel(): string;
}
