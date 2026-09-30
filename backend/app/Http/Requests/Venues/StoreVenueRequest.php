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
     *
     * Sprawdzenie i zapis to dwa kroki, więc równoległe żądania mogą razem
     * przekroczyć limit. Dla panelu jednego organizera to akceptowalne;
     * blokada wiersza turnieju byłaby tu na wyrost. To samo dotyczy
     * unikalności nazwy, której nie pilnuje indeks (migracja `venues`).
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
