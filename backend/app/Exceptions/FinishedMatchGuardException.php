<?php

namespace App\Exceptions;

use Illuminate\Validation\ValidationException;

/**
 * Rzucane, gdy ktoś próbuje usunąć byt powiązany z meczem o statusie `finished`.
 *
 * Kod odpowiedzi to **422**, bo tak stanowi kontrakt: „Odrzucane z kodem `422`,
 * jeżeli drużyna wystąpiła w rozegranym meczu" (`DELETE /teams/{team}`
 * w `openapi.yaml`). Semantycznie bliższe byłoby 409 — organizer ma prawo do
 * turnieju, blokuje go stan danych, a nie brak uprawnień — ale kontrakt jest
 * jedynym źródłem prawdy o API ([ADR-0001](../../../docs/adr/0001-kontrakt-openapi-jako-zrodlo-prawdy.md))
 * i zmiana kodu odpowiedzi idzie przez spec, nie przez backend.
 *
 * Dziedziczenie po `ValidationException` daje też właściwą kopertę
 * `{ message, errors }`, której kontrakt oczekuje dla 422.
 */
class FinishedMatchGuardException extends ValidationException
{
    public static function for(string $what): self
    {
        return static::withMessages([
            'id' => ["Nie można usunąć: {$what} ma powiązane rozegrane mecze."],
        ]);
    }
}
