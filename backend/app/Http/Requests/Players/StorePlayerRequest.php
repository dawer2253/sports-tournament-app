<?php

namespace App\Http\Requests\Players;

use App\Models\Team;
use App\Rules\ChildLimit;
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
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            ChildLimit::check(
                $this->team()->players(),
                Team::MAX_PLAYERS,
                'players',
                'Drużyna ma już '.Team::MAX_PLAYERS.' zawodników, to górny limit.',
            ),
        ];
    }

    protected function team(): Team
    {
        return $this->route('team');
    }
}
