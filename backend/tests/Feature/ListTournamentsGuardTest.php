<?php

use App\Models\User;

/*
 * Ten jeden przypadek mieszka poza `ListTournamentsTest`, bo tamten plik włącza
 * w `beforeEach` walidator kontraktu, a `?status[]=draft` to kształt, którego
 * kontrakt nie umie opisać żadnym `style`. Spectator przewraca się na nim
 * własnym `TypeError` („explode(): Argument #2 must be of type string, array
 * given") jeszcze przed Form Requestem.
 *
 * Tutaj `Spectator::using()` nie jest wołane, więc `Spectator\Middleware`
 * wychodzi od razu (`if (! $this->spectator->getSpec())`) i widać prawdziwą
 * odpowiedź aplikacji — czyli to, co dostanie `curl`.
 */
it('odrzuca notację nawiasową w parametrze status', function () {
    actingAsOrganizer(User::factory()->create())
        ->getJson('/api/v1/tournaments?status[]=draft&status[]=active')
        ->assertStatus(422)
        ->assertJsonValidationErrors('status');
});
