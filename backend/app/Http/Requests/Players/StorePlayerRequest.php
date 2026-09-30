<?php

namespace App\Http\Requests\Players;

use App\Models\Team;
use Illuminate\Validation\Validator;

class StorePlayerRequest extends PlayerRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', ...$this->nameRules()],
            'number' => $this->numberRules(),
            'position' => $this->positionRules(),
        ];
    }

    /**
     * Limit to stan drużyny, nie pole z ciała, więc błąd idzie pod `players`
     * (tak stanowi kontrakt). `players()` pomija zawodników usuniętych
     * miękko. Wyścig między sprawdzeniem a zapisem jest akceptowalny z tego
     * samego powodu co przy limicie drużyn (`StoreTeamRequest`).
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->team()->players()->count() >= Team::MAX_PLAYERS) {
                    $validator->errors()->add(
                        'players',
                        'Drużyna ma już '.Team::MAX_PLAYERS.' zawodników, to górny limit.',
                    );
                }
            },
        ];
    }

    protected function team(): Team
    {
        return $this->route('team');
    }
}
