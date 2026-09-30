<?php

namespace App\Http\Requests\Teams;

use App\Models\Tournament;
use Illuminate\Validation\Validator;

class StoreTeamRequest extends TeamRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', ...$this->nameRules()],
        ];
    }

    /**
     * Limit to stan turnieju, nie pole z ciała, więc błąd idzie pod `teams`
     * (tak stanowi kontrakt). `teams()` pomija drużyny usunięte miękko.
     *
     * Sprawdzenie i zapis to dwa kroki, więc równoległe żądania mogą razem
     * przekroczyć limit. Dla panelu jednego organizera to akceptowalne;
     * blokada wiersza turnieju byłaby tu na wyrost. To samo dotyczy
     * unikalności nazwy, której nie pilnuje indeks (migracja `teams`).
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->tournament()->teams()->count() >= Tournament::MAX_TEAMS) {
                    $validator->errors()->add(
                        'teams',
                        'Turniej ma już '.Tournament::MAX_TEAMS.' drużyn, to górny limit.',
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
