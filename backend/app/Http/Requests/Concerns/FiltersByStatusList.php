<?php

namespace App\Http\Requests\Concerns;

use App\Rules\SingleCommaSeparatedQueryParam;
use Closure;

/**
 * Filtr `?status=` listy jako tablica po przecinku (ADR 0009): lista
 * turniejów i lista zgłoszeń drużyn (#300) mają ten sam kształt i te same
 * błędy, różnią się tylko dozwolonymi stanami i nazwą w komunikacie.
 */
trait FiltersByStatusList
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
     * Błędy raportujemy pod kluczem `status`, a nie `status.*`, bo panel
     * wysłał jeden parametr o tej nazwie — i pod taką nazwą spodziewa się
     * komunikatu.
     *
     * @param  list<string>  $allowed  stany z kontraktu, w jego kolejności
     * @param  string  $noun  np. „stan turnieju”, do komunikatów
     * @return list<mixed>
     */
    protected function statusRules(array $allowed, string $noun, string $example): array
    {
        return [
            'sometimes',
            'bail',
            new SingleCommaSeparatedQueryParam($this, example: $example),
            'array',
            $this->statusListRule($allowed, $noun),
        ];
    }

    /**
     * @param  list<string>  $allowed
     */
    private function statusListRule(array $allowed, string $noun): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($allowed, $noun): void {
            $allowedList = implode(', ', $allowed);

            if (in_array('', $value, strict: true)) {
                $fail("Podaj co najmniej jeden {$noun}. Dozwolone: {$allowedList}.");

                return;
            }

            $unknown = array_diff($value, $allowed);

            if ($unknown !== []) {
                $fail(sprintf(
                    'Nieznany %s: %s. Dozwolone: %s.',
                    $noun,
                    implode(', ', $unknown),
                    $allowedList,
                ));

                return;
            }

            if (count($value) !== count(array_unique($value))) {
                $fail("Każdy {$noun} podaj najwyżej raz.");
            }
        };
    }

    /** Stany, do których zawęzić listę; pusta tablica znaczy „bez filtra". */
    public function statuses(): array
    {
        return $this->validated('status') ?? [];
    }
}
