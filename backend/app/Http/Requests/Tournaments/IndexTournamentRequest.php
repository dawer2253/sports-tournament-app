<?php

namespace App\Http\Requests\Tournaments;

use App\Models\Tournament;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class IndexTournamentRequest extends FormRequest
{
    /**
     * Kontrakt opisuje `status` jako tablicę w `style: form`, `explode: false`,
     * czyli jeden parametr z wartościami po przecinku (ADR 0008). Rozbijamy go
     * tutaj, żeby reguły walidacji dostały już tablicę.
     */
    protected function prepareForValidation(): void
    {
        $status = $this->query('status');

        if (is_string($status)) {
            $this->merge(['status' => explode(',', $status)]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Błędy raportujemy pod kluczem `status`, a nie `status.0`, bo panel
            // wysłał jeden parametr o tej nazwie — i pod taką nazwą spodziewa
            // się komunikatu.
            'status' => ['sometimes', 'bail', $this->singleStatusKeyRule(), 'array', $this->statusListRule()],
            'page' => ['sometimes', 'integer', 'min:1'],
            'perPage' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * Odrzuca kształty, w których PHP gubi część wartości: powtórzony klucz
     * (`?status=draft&status=active` — w `$_GET` zostaje sama ostatnia wartość)
     * oraz notację nawiasową (`?status[]=draft`), której kontrakt nie umie
     * opisać żadnym `style`.
     *
     * Bez tej reguły oba kształty przechodziłyby z `200` i po cichu zawężonym
     * filtrem — a ADR 0008 odrzucił `explode: true` właśnie po to, żeby cichego
     * zawężenia nie było. Sprawdzamy surowy query string, bo w `$_GET` ślad po
     * powtórzeniu już nie istnieje.
     */
    private function singleStatusKeyRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $keys = [];

            foreach (explode('&', (string) $this->server('QUERY_STRING')) as $pair) {
                if ($pair === '') {
                    continue;
                }

                $keys[] = urldecode(explode('=', $pair, 2)[0]);
            }

            $statusKeys = array_values(array_filter(
                $keys,
                fn (string $key): bool => $key === 'status' || str_starts_with($key, 'status['),
            ));

            $bracketed = array_filter($statusKeys, fn (string $key): bool => $key !== 'status');

            if (count($statusKeys) > 1 || $bracketed !== []) {
                $fail('Parametr status podaj raz, z wartościami po przecinku, np. status=draft,active.');
            }
        };
    }

    private function statusListRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $allowed = implode(', ', Tournament::STATUSES);

            // `?status=` daje po rozbiciu `['']`, więc pustą wartość nazywamy
            // wprost — komunikat „Nieznany stan turnieju: ." nic by nie mówił.
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
}
