<?php

namespace App\Http\Requests\Stages;

use App\Schedule\BracketGenerator;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Waliduje sam kształt ciała. Czy lista to dokładnie drużyny turnieju, jak
 * i reszta warunków zależnych od stanu fazy, sprawdza `BracketGenerator`
 * w transakcji — tam już nic ich nie zmieni między sprawdzeniem a zapisem.
 *
 * `minItems: 2` z kontraktu nie jest tu regułą: turniej z jedną drużyną ma
 * dostać odmowę pod `teams`, a nie pod `teamIds`, więc liczbę drużyn
 * rozstrzyga generator.
 */
class GenerateBracketRequest extends FormRequest
{
    private const THIRD_PLACE_MESSAGE = 'Wybierz, czy dołożyć mecz o 3. miejsce.';

    /**
     * `present`, a nie `required`, bo `required` odrzuca pustą listę, a ta
     * ma trafić do generatora jak każda inna. Elementy sprawdza jedna reguła
     * na całej liście, żeby błąd siadał pod `teamIds`, a nie pod
     * `teamIds.3`. `integer:strict` i `boolean:strict` z tego samego powodu
     * co w `GenerateScheduleRequest`.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'teamIds' => ['present', 'array', 'list', function (string $attribute, mixed $value, Closure $fail): void {
                if (is_array($value) && array_any($value, fn (mixed $id): bool => ! is_int($id))) {
                    $fail(BracketGenerator::TEAM_IDS_MESSAGE);
                }
            }],
            'thirdPlaceMatch' => ['required', 'boolean:strict'],
        ];
    }

    /**
     * Jedno zdanie na każdy błąd pola, jak w `GenerateScheduleRequest`.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'teamIds.present' => BracketGenerator::TEAM_IDS_MESSAGE,
            'teamIds.array' => BracketGenerator::TEAM_IDS_MESSAGE,
            'teamIds.list' => BracketGenerator::TEAM_IDS_MESSAGE,
            'thirdPlaceMatch.required' => self::THIRD_PLACE_MESSAGE,
            'thirdPlaceMatch.boolean' => self::THIRD_PLACE_MESSAGE,
        ];
    }

    /** @return list<int> */
    public function teamIds(): array
    {
        return $this->validated('teamIds');
    }

    public function thirdPlaceMatch(): bool
    {
        return $this->validated('thirdPlaceMatch');
    }
}
