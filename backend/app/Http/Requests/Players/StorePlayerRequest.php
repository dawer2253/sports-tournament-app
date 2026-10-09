<?php

namespace App\Http\Requests\Players;

use App\Http\Requests\Concerns\LimitsChildren;
use App\Models\Team;
use Illuminate\Validation\Validator;

class StorePlayerRequest extends PlayerRequest
{
    use LimitsChildren;

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
            $this->childLimit(
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
