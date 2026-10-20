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
        return self::admissionChecks($this->tournament());
    }

    /**
     * Czy turniej przyjmie nową drużynę: przy meczu rozpoczętym (`live`
     * albo `finished`) nowa drużyna nie miałaby już miejsca w terminarzu, bo
     * meczów do istniejących kolejek nikt nie dopisuje (#171), a turniej ma
     * górny limit drużyn. Wcześniej dodanie przechodzi, a terminarz obejmie
     * nową drużynę dopiero po ponownym wygenerowaniu.
     *
     * Oba warunki mówią o stanie turnieju, a nie o polu z ciała, więc idą pod
     * klucz `teams` (tak stanowi kontrakt). Statycznie, bo te same reguły
     * obowiązują przyjęcie zgłoszenia (#300, `AcceptTeamRegistrationRequest`).
     *
     * @return list<callable(Validator): void>
     */
    public static function admissionChecks(Tournament $tournament): array
    {
        return [
            function (Validator $validator) use ($tournament): void {
                if ($tournament->hasStartedMatches()) {
                    $validator->errors()->add('teams', 'Turniej ma rozegrane lub trwające mecze, więc nie można dodać drużyny.');
                }
            },
            ChildLimit::check(
                $tournament->teams(),
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
