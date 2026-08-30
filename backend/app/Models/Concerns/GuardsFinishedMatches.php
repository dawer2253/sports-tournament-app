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
 * Kasowanie kaskadowe w bazie guarda nie uruchamia — i tak ma być: kaskada
 * odpala się wyłącznie przy usuwaniu turnieju, które sam guard sprawdza wyżej.
 */
trait GuardsFinishedMatches
{
    public static function bootGuardsFinishedMatches(): void
    {
        static::deleting(function (self $model) {
            if ($model->hasFinishedMatches()) {
                throw new FinishedMatchGuardException($model->guardLabel());
            }
        });
    }

    /** Czy z tym bytem wiąże się choć jeden mecz `finished`. */
    abstract public function hasFinishedMatches(): bool;

    /** Nazwa bytu w komunikacie błędu. */
    abstract protected function guardLabel(): string;
}
