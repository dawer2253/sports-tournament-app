<?php

namespace App\Http\Requests\Teams;

use App\Models\Team;
use App\Models\Tournament;

class UpdateTeamRequest extends TeamRequest
{
    /**
     * `name` można pominąć, ale wysłane musi być niepuste — stąd `required`
     * za `sometimes`.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', ...$this->nameRules()],
        ];
    }

    protected function tournament(): Tournament
    {
        return $this->team()->tournament;
    }

    protected function ignoredTeam(): Team
    {
        return $this->team();
    }

    private function team(): Team
    {
        return $this->route('team');
    }
}
