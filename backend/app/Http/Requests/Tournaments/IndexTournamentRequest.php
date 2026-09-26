<?php

namespace App\Http\Requests\Tournaments;

use App\Models\Tournament;
use App\Rules\SingleCommaSeparatedQueryParam;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Waliduje wyłącznie `status`. `page` i `perPage` zostają poza tym Form
 * Requestem: kontrakt nie przewiduje dla nich `422`, więc kontroler dociąga je
 * do granic, zamiast odrzucać żądanie.
 */
class IndexTournamentRequest extends FormRequest
{
    /**
     * Kontrakt opisuje `status` jako tablicę w `style: form`, `explode: false`,
     * czyli jeden parametr z wartościami po przecinku (ADR 0009). Rozbijamy go
     * tutaj, żeby reguły dostały już tablicę.
     *
     * `?status=` sprowadza się do `['']`, a nie do braku parametru. Pustą
     * wartość trzeba złapać jawnie, bo globalny `ConvertEmptyStringsToNull`
     * zamienia ją wcześniej na `null` — bez tego reguła `array` oddałaby
     * komunikat o złym typie zamiast powiedzieć, czego brakuje.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->query->has('status')) {
            return;
        }

        $status = $this->query('status');

        if ($status === null || is_string($status)) {
            $this->merge(['status' => explode(',', (string) $status)]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Błędy raportujemy pod kluczem `status`, a nie `status.*`, bo panel
            // wysłał jeden parametr o tej nazwie — i pod taką nazwą spodziewa
            // się komunikatu.
            'status' => [
                'sometimes',
                'bail',
                new SingleCommaSeparatedQueryParam($this),
                'array',
                $this->statusListRule(),
            ],
        ];
    }

    private function statusListRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $allowed = implode(', ', Tournament::STATUSES);

            if (in_array('', $value, strict: true)) {
                $fail("Podaj co najmniej jeden stan turnieju. Dozwolone: {$allowed}.");

                return;
            }

            $unknown = array_diff($value, Tournament::STATUSES);

            if ($unknown !== []) {
                $fail(sprintf(
                    'Nieznany stan turnieju: %s. Dozwolone: %s.',
                    implode(', ', $unknown),
                    $allowed,
                ));

                return;
            }

            if (count($value) !== count(array_unique($value))) {
                $fail('Każdy stan turnieju podaj najwyżej raz.');
            }
        };
    }

    /** Stany, do których zawęzić listę; pusta tablica znaczy „bez filtra". */
    public function statuses(): array
    {
        return $this->validated('status') ?? [];
    }
}
