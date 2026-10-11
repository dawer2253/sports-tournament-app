<?php

namespace App\Http\Requests\Tournaments;

use App\Http\Requests\Tournaments\Concerns\ValidatesTiebreakers;
use App\Models\Tournament;
use App\Rules\SingleCommaSeparatedQueryParam;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Opcjonalny parametr podglądu `tiebreakers`: tabela liczona według podanej
 * listy zamiast zapisanej, bez zapisu. Reguły, komunikaty i klucze błędów są
 * te same co w `PATCH` (`ValidatesTiebreakers`), a do tego kształt parametru
 * z ADR 0009.
 */
class ShowStandingsRequest extends FormRequest
{
    use ValidatesTiebreakers;

    /**
     * Rozbija listę po przecinku, jak `IndexTournamentRequest`. Pusta wartość
     * (`?tiebreakers=`) dociera jako `null` przez globalny
     * `ConvertEmptyStringsToNull` i staje się pustą listą, więc dostaje ten sam
     * komunikat co `[]` w `PATCH`. Tablica z notacji nawiasowej zostaje, jak
     * przyszła, i odrzuca ją `SingleCommaSeparatedQueryParam`.
     *
     * Pusty element (`points,` albo `points,,score_diff`) staje się `null`, tak
     * jak `""` w ciele `PATCH`. Pusty napis zostałby przez walidator pominięty
     * (reguła nie jest „implicit”) i dotarłby do kalkulatora.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->query->has('tiebreakers')) {
            return;
        }

        $tiebreakers = $this->query('tiebreakers');

        if ($tiebreakers === null) {
            $this->merge(['tiebreakers' => []]);
        } elseif (is_string($tiebreakers)) {
            $this->merge(['tiebreakers' => array_map(
                fn (string $code): ?string => $code === '' ? null : $code,
                explode(',', $tiebreakers),
            )]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return $this->tiebreakerRules($this->tournament()->sport, [
            'bail',
            new SingleCommaSeparatedQueryParam($this, example: 'points,score_diff,head_to_head'),
        ]);
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [$this->checkTiebreakersStartWithPoints(...)];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return $this->tiebreakerAttributes();
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return $this->tiebreakerMessages();
    }

    /**
     * Lista z parametru podglądu albo `null`, gdy go nie było.
     *
     * @return list<string>|null
     */
    public function tiebreakers(): ?array
    {
        return $this->validated('tiebreakers');
    }

    private function tournament(): Tournament
    {
        return $this->route('tournament');
    }
}
