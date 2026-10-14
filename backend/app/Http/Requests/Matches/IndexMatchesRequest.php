<?php

namespace App\Http\Requests\Matches;

use App\Models\GameMatch;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Waliduje filtry listy meczów. `page` i `perPage` zostają poza tym Form
 * Requestem, tak jak na liście turniejów: kontrakt nie przewiduje dla nich
 * `422`, więc kontroler dociąga je do granic.
 *
 * Filtr o złym typie albo nieznany stan to `422`, a nie lista bez filtra:
 * cicha lista wyglądałaby jak filtr działający (powód z ADR 0009).
 * `status` jest tu jedną wartością, a nie listą po przecinku — panel nie pyta
 * o dwa stany naraz, więc `scheduled,live` to po prostu nieznany stan.
 */
class IndexMatchesRequest extends FormRequest
{
    /** Brak id fazy; tak samo mówi lista meczów fazy na stronie publicznej (`ShowStageMatchesRequest`). */
    public const STAGE_ID_REQUIRED = 'Podaj id fazy.';

    public const STAGE_ID_INTEGER = 'Id fazy musi być liczbą całkowitą.';

    /**
     * `required` przy `sometimes` łapie pusty parametr (`?status=`), który
     * globalny `ConvertEmptyStringsToNull` zamienia wcześniej na `null`.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'stageId' => ['sometimes', 'required', 'integer'],
            'roundId' => ['sometimes', 'required', 'integer'],
            'status' => ['sometimes', 'required', $this->statusRule()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'stageId.required' => self::STAGE_ID_REQUIRED,
            'stageId.integer' => self::STAGE_ID_INTEGER,
            'roundId.required' => 'Podaj id kolejki.',
            'roundId.integer' => 'Id kolejki musi być liczbą całkowitą.',
            'status.required' => 'Podaj stan meczu. Dozwolone: '.implode(', ', GameMatch::STATUSES).'.',
        ];
    }

    private function statusRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! in_array($value, GameMatch::STATUSES, strict: true)) {
                $fail(sprintf(
                    'Nieznany stan meczu: %s. Dozwolone: %s.',
                    is_string($value) ? $value : get_debug_type($value),
                    implode(', ', GameMatch::STATUSES),
                ));
            }
        };
    }

    public function stageId(): ?int
    {
        return $this->has('stageId') ? (int) $this->validated('stageId') : null;
    }

    public function roundId(): ?int
    {
        return $this->has('roundId') ? (int) $this->validated('roundId') : null;
    }

    public function status(): ?string
    {
        return $this->validated('status');
    }
}
