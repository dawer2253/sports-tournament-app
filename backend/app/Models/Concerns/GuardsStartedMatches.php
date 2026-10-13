<?php

namespace App\Models\Concerns;

use App\Exceptions\StartedMatchGuardException;

/**
 * Guard: nie usuwamy bytu powiązanego z meczem rozegranym albo trwającym
 * (`finished` albo `live`) — ani na twardo, ani na miękko. Rozegrany turniej
 * ma dalej działać pod swoim publicznym adresem, więc historia jest
 * nienaruszalna, a mecz trwający za chwilę stanie się historią.
 *
 * Guard siedzi w zdarzeniu `deleting` modelu, a nie w Policy ani w kontrolerze,
 * bo to jedyne miejsce, którego nie ominie ani seeder, ani przyszły kod
 * porządkujący. Policy odpowiada za własność, i tylko za nią.
 *
 * **Zakres: byty, które organizer kasuje ręcznie** — `Tournament`, `Team`,
 * `Player`, `Venue`. Struktura rozgrywek (`Stage`, `Round`, `Group`, `GameMatch`)
 * guarda nie ma świadomie: zarządzają nią generatory terminarza
 * (`App\Schedule\ScheduleGenerator`) i drabinki (`App\Schedule\BracketGenerator`),
 * a regułę dla regeneracji trzymają same — faza z meczem rozpoczętym daje 422
 * (decyzje #157 i #215). Jedyny wyjątek to usunięcie drużyny w pucharze, które
 * kasuje drabinkę z tą samą odmową po starcie (`Team::booted()`).
 *
 * Kasowanie kaskadowe w bazie guarda nie uruchamia — dlatego `tournaments.user_id`
 * jest `RESTRICT`, żeby usunięcie konta nie obeszło go od góry (ADR-0005).
 */
trait GuardsStartedMatches
{
    public static function bootGuardsStartedMatches(): void
    {
        static::deleting(function (self $model) {
            if ($model->hasStartedMatches()) {
                throw StartedMatchGuardException::for($model->guardLabel());
            }
        });
    }

    /** Czy z tym bytem wiąże się choć jeden mecz `live` albo `finished`. */
    abstract public function hasStartedMatches(): bool;

    /** Nazwa bytu w komunikacie błędu. */
    abstract protected function guardLabel(): string;
}
