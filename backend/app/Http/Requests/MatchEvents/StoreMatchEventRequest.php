<?php

namespace App\Http\Requests\MatchEvents;

use App\Models\GameMatch;

class StoreMatchEventRequest extends MatchEventRequest
{
    /**
     * Kontrakt wymaga wszystkich czterech pól; `playerId` i `minute` mogą być
     * `null`, ale muszą paść jawnie (`present`).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = $this->fieldRules();

        return [
            'type' => ['required', ...$rules['type']],
            'teamId' => ['required', ...$rules['teamId']],
            'playerId' => ['present', ...$rules['playerId']],
            'minute' => ['present', ...$rules['minute']],
        ];
    }

    protected function match(): GameMatch
    {
        return $this->route('match');
    }
}
