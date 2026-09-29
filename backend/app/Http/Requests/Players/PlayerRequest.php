<?php

namespace App\Http\Requests\Players;

use App\Models\Player;
use App\Models\Team;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Wspólne reguły pól zawodnika dla `POST` i `PATCH` — kontrakt mówi o nich
 * raz, przy `POST /teams/{team}/players`, a `PATCH` odsyła tam.
 */
abstract class PlayerRequest extends FormRequest
{
    /** Drużyna, wśród której zawodników numer ma być unikalny. */
    abstract protected function team(): Team;

    /** Zawodnik, którego własny numer nie koliduje sam ze sobą. */
    protected function ignoredPlayer(): ?Player
    {
        return null;
    }

    /**
     * Imię i nazwisko bez unikalności: dwóch Kowalskich w jednej drużynie to
     * normalny stan (decyzja #80).
     *
     * @return list<mixed>
     */
    protected function nameRules(): array
    {
        return ['string', 'max:120'];
    }

    /**
     * Numer jest unikalny tylko wśród żywych zawodników drużyny, a `null`
     * z niczym nie koliduje — `nullable` pomija dla niego resztę reguł.
     *
     * @return list<mixed>
     */
    protected function numberRules(): array
    {
        return [
            'nullable',
            'integer',
            'between:0,999',
            Rule::unique('players', 'number')
                ->where('team_id', $this->team()->id)
                ->whereNull('deleted_at')
                ->ignore($this->ignoredPlayer()),
        ];
    }

    /**
     * Wolny tekst, bez słownika pozycji per sport (future work w #80).
     *
     * @return list<mixed>
     */
    protected function positionRules(): array
    {
        return ['nullable', 'string', 'max:60'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'number.unique' => 'Ten numer ma już inny zawodnik tej drużyny.',
        ];
    }
}
