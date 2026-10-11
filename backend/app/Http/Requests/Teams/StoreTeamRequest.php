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
     * Oba warunki mówią o stanie turnieju, a nie o polu z ciała, więc idą pod
     * klucz `teams` (tak stanowi kontrakt).
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            $this->checkPlayNotStarted(...),
            ChildLimit::check(
                $this->tournament()->teams(),
                Tournament::MAX_TEAMS,
                'teams',
                'Turniej ma już '.Tournament::MAX_TEAMS.' drużyn, to górny limit.',
            ),
        ];
    }

    /**
     * Po rozpoczęciu gry (mecz `live` albo `finished`) nowa drużyna nie
     * miałaby już miejsca w terminarzu, bo meczów do istniejących kolejek nikt
     * nie dopisuje (#171). Wcześniej dodanie przechodzi, a terminarz obejmie
     * nową drużynę dopiero po ponownym wygenerowaniu.
     */
    private function checkPlayNotStarted(Validator $validator): void
    {
        if ($this->tournament()->hasStartedMatches()) {
            $validator->errors()->add('teams', 'Turniej ma rozegrane lub trwające mecze, więc nie można dodać drużyny.');
        }
    }

    protected function tournament(): Tournament
    {
        return $this->route('tournament');
    }
}
