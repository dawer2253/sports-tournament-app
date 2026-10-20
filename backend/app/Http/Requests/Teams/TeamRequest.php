<?php

namespace App\Http\Requests\Teams;

use App\Models\Team;
use App\Models\Tournament;
use App\Rules\UniqueAmongLiveSiblings;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Wspólne reguły nazwy drużyny dla `POST` i `PATCH` — kontrakt mówi o nich
 * raz, przy `POST /tournaments/{tournament}/teams`, a `PATCH` odsyła tam.
 */
abstract class TeamRequest extends FormRequest
{
    public const NAME_TAKEN_MESSAGE = 'W tym turnieju jest już drużyna o tej nazwie.';

    /** Turniej, wśród którego drużyn nazwa ma być unikalna. */
    abstract protected function tournament(): Tournament;

    /** Drużyna, której własna nazwa nie koliduje sama ze sobą. */
    protected function ignoredTeam(): ?Team
    {
        return null;
    }

    /**
     * @return list<mixed>
     */
    protected function nameRules(): array
    {
        return self::nameRulesFor($this->tournament(), $this->ignoredTeam());
    }

    /**
     * Unikalność tylko wśród żywych drużyn turnieju, bo drużyna usunięta nie
     * blokuje nazwy. Wielkość liter pomija collation kolumny
     * (`utf8mb4_unicode_ci`), a spacje na brzegach obcina globalny
     * `TrimStrings` — żadne z nich nie wymaga tu własnego kodu.
     *
     * Statycznie, bo tę samą nazwę sprawdza też zgłoszenie drużyny (#300),
     * które nie jest drużyną i ma pole `teamName`.
     *
     * @return list<mixed>
     */
    public static function nameRulesFor(Tournament $tournament, ?Team $ignored = null): array
    {
        return [
            'string',
            'max:120',
            UniqueAmongLiveSiblings::rule('teams', 'name', 'tournament_id', $tournament, $ignored),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => self::NAME_TAKEN_MESSAGE,
        ];
    }
}
