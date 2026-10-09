<?php

namespace App\Http\Requests\Tournaments;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Wspólne reguły pól turnieju dla `POST` i `PATCH`. Dziś to sama nazwa —
 * reszta pól powstaje przy zakładaniu z wartości domyślnych, a zmienia się
 * wyłącznie przez `PATCH`.
 */
abstract class TournamentRequest extends FormRequest
{
    /**
     * @return list<mixed>
     */
    protected function nameRules(): array
    {
        return ['string', 'max:160'];
    }
}
