<?php

namespace App\Http\Requests\Venues;

use App\Models\Tournament;
use Illuminate\Validation\Validator;

class StoreVenueRequest extends VenueRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', ...$this->nameRules()],
            'address' => $this->addressRules(),
        ];
    }

    /**
     * Limit to stan turnieju, nie pole z ciała, więc błąd idzie pod `venues`
     * (tak stanowi kontrakt). `venues()` pomija obiekty usunięte miękko.
     * Forma „obiekty" pasuje do 32; zmieniając `MAX_VENUES`, popraw też
     * odmianę. `trans_choice` tu nie pomoże: z tekstem spoza `lang/` bierze
     * reguły języka zapasowego (`en`). Test limitu ma liczbę wpisaną wprost,
     * więc zmiana stałej go zaczerwieni.
     *
     * Wyścig między sprawdzeniem a zapisem, tu i przy unikalności nazwy, jest
     * akceptowalny z tego samego powodu co przy limicie drużyn
     * (`StoreTeamRequest`).
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->tournament()->venues()->count() >= Tournament::MAX_VENUES) {
                    $validator->errors()->add(
                        'venues',
                        'Turniej ma już '.Tournament::MAX_VENUES.' obiekty, to górny limit.',
                    );
                }
            },
        ];
    }

    protected function tournament(): Tournament
    {
        return $this->route('tournament');
    }
}
