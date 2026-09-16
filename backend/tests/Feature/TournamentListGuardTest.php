<?php

use App\Models\User;
use Illuminate\Validation\ValidationException;

/*
 * Ten jeden przypadek mieszka poza `TournamentListTest`, bo tamten plik włącza
 * w `beforeEach` walidator kontraktu (Spectator), a `?status[]=draft` to
 * kształt, którego kontrakt nie umie opisać żadnym `style`. Spectator przewraca
 * się na nim własnym `TypeError` („explode(): Argument #2 must be of type
 * string, array given") jeszcze przed Form Requestem, więc przez HTTP nie da
 * się tu zobaczyć naszej walidacji.
 *
 * Guard jest mimo to potrzebny: bez niego notacja nawiasowa przechodziłaby
 * z `200` i po cichu zawężonym filtrem, czyli dokładnie tym, czemu ADR 0008
 * zapobiega (docs/adr/0008-filtr-status-jedzie-lista-po-przecinku.md).
 */
it('odrzuca notację nawiasową w parametrze status', function () {
    $this->withoutExceptionHandling();

    actingAsOrganizer(User::factory()->create())
        ->getJson('/api/v1/tournaments?status[]=draft&status[]=active');
})->throws(ValidationException::class, 'Parametr status podaj raz');
