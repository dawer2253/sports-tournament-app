<?php

namespace App\Http\Requests\Venues;

use App\Models\Tournament;
use App\Rules\ChildLimit;
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
     * Komunikat limitu ma liczebnik odmieniony ręcznie: forma „obiekty"
     * pasuje do 32; zmieniając `MAX_VENUES`, popraw też
     * odmianę. `trans_choice` tu nie pomoże: z tekstem spoza `lang/` bierze
     * reguły języka zapasowego (`en`). Test limitu ma liczbę wpisaną wprost,
     * więc zmiana stałej go zaczerwieni.
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            ChildLimit::check(
                $this->tournament()->venues(),
                Tournament::MAX_VENUES,
                'venues',
                'Turniej ma już '.Tournament::MAX_VENUES.' obiekty, to górny limit.',
            ),
        ];
    }

    protected function tournament(): Tournament
    {
        return $this->route('tournament');
    }
}
