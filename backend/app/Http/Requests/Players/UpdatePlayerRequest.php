<?php

namespace App\Http\Requests\Players;

use App\Models\Player;
use App\Models\Team;

class UpdatePlayerRequest extends PlayerRequest
{
    /**
     * Każde pole można pominąć. Wysłane `name` musi być niepuste — stąd
     * `required` za `sometimes` — a `number` i `position` przyjmują `null`,
     * które czyści wartość.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', ...$this->nameRules()],
            'number' => ['sometimes', ...$this->numberRules()],
            'position' => ['sometimes', ...$this->positionRules()],
        ];
    }

    protected function team(): Team
    {
        return $this->player()->team;
    }

    protected function ignoredPlayer(): Player
    {
        return $this->player();
    }

    private function player(): Player
    {
        return $this->route('player');
    }
}
