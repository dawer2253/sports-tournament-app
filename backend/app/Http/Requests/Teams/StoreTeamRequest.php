<?php

namespace App\Http\Requests\Teams;

use App\Models\Tournament;
use App\Rules\ChildLimit;
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
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            ChildLimit::check(
                $this->tournament()->teams(),
                Tournament::MAX_TEAMS,
                'teams',
                'Turniej ma już '.Tournament::MAX_TEAMS.' drużyn, to górny limit.',
            ),
        ];
    }

    protected function tournament(): Tournament
    {
        return $this->route('tournament');
    }
}
