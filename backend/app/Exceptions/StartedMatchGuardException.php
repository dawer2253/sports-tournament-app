<?php

namespace App\Exceptions;

use Illuminate\Validation\ValidationException;

/**
 * Rzucane, gdy ktoś próbuje usunąć byt powiązany z meczem rozegranym albo
 * trwającym (`finished` albo `live`).
 *
 * Kod odpowiedzi to **422**, bo tak stanowi kontrakt: „Daje `422` z błędem pod
 * `id`, jeżeli drużyna ma mecz rozegrany albo trwający" (`DELETE /teams/{team}`
 * w `openapi.yaml`). Semantycznie bliższe byłoby 409 — organizer ma prawo do
 * turnieju, blokuje go stan danych, a nie brak uprawnień — ale kontrakt jest
 * jedynym źródłem prawdy o API ([ADR-0001](../../../docs/adr/0001-kontrakt-openapi-jako-zrodlo-prawdy.md))
 * i zmiana kodu odpowiedzi idzie przez spec, nie przez backend.
 *
 * Dziedziczenie po `ValidationException` daje też właściwą kopertę
 * `{ message, errors }`, której kontrakt oczekuje dla 422.
 */
class StartedMatchGuardException extends ValidationException
{
    public static function for(string $what): self
    {
        return static::withMessages([
            'id' => ["Nie można usunąć: {$what} ma rozegrane lub trwające mecze."],
        ]);
    }

    /**
     * Drużyna w drabince, która już się rozpoczęła (#215). Drabinki nie da się
     * załatać, więc odmowa obejmuje też drużynę bez rozegranego meczu.
     */
    public static function forBracket(string $teamName): self
    {
        return static::withMessages([
            'id' => ["Nie można usunąć: drużyna „{$teamName}” gra w drabince, która już się rozpoczęła. Wycofanie drużyny wpisz jako walkower."],
        ]);
    }
}
