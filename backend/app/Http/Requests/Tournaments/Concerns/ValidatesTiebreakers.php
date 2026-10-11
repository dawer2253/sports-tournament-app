<?php

namespace App\Http\Requests\Tournaments\Concerns;

use App\Models\Sport;
use App\Models\Tournament;
use Closure;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

/**
 * Walidacja listy kryteriów kolejności, wspólna dla zapisu
 * (`PATCH /tournaments/{tournament}`) i podglądu tabeli
 * (`GET /tournaments/{tournament}/standings?tiebreakers=…`). Kontrakt obiecuje
 * w obu miejscach te same reguły, komunikaty i klucze błędów, więc reguły
 * żyją tylko tutaj.
 *
 * Klasa używająca dokłada `tiebreakerRules()` do `rules()`,
 * `checkTiebreakersStartWithPoints` do `after()` oraz `tiebreakerMessages()`
 * i `tiebreakerAttributes()` do swoich komunikatów i nazw pól.
 */
trait ValidatesTiebreakers
{
    /**
     * @param  list<mixed>  $listRules  reguły całej listy przed sprawdzeniem typu,
     *                                  np. kształt parametru query
     * @return array<string, mixed>
     */
    protected function tiebreakerRules(Sport $sport, array $listRules = []): array
    {
        return [
            'tiebreakers' => ['sometimes', ...$listRules, 'array', 'list', 'min:1'],
            'tiebreakers.*' => [$this->tiebreakerRule($sport)],
        ];
    }

    /**
     * Jeden element listy: kod z kontraktu, dostępny w sporcie turnieju
     * i niepowtórzony. Duplikat oznacza tylko drugie i dalsze wystąpienie, żeby
     * błąd stał przy elemencie, który trzeba usunąć. Backend niczego nie
     * poprawia, tylko odrzuca.
     */
    private function tiebreakerRule(Sport $sport): Closure
    {
        $available = $sport->availableTiebreakers();

        return function (string $attribute, mixed $value, Closure $fail) use ($available): void {
            if (! in_array($value, Tournament::TIEBREAKER_CODES, true)) {
                $fail('Nieznane kryterium kolejności.');

                return;
            }

            if (! in_array($value, $available, true)) {
                $fail('To kryterium nie jest dostępne w sporcie tego turnieju.');

                return;
            }

            $index = (int) Str::afterLast($attribute, '.');

            if (in_array($value, array_slice($this->input('tiebreakers'), 0, $index), true)) {
                $fail('To kryterium jest już na liście.');
            }
        };
    }

    /** `points` stoi zawsze na początku listy. */
    protected function checkTiebreakersStartWithPoints(Validator $validator): void
    {
        if (! $this->has('tiebreakers')
            || $validator->errors()->hasAny(['tiebreakers', 'tiebreakers.0'])
            || $this->input('tiebreakers.0') === 'points') {
            return;
        }

        $validator->errors()->add('tiebreakers.0', 'Pierwszym kryterium jest zawsze liczba punktów.');
    }

    /**
     * @return array<string, string>
     */
    protected function tiebreakerMessages(): array
    {
        return ['tiebreakers.min' => 'Lista kryteriów musi mieć co najmniej jedną pozycję.'];
    }

    /**
     * @return array<string, string>
     */
    protected function tiebreakerAttributes(): array
    {
        return ['tiebreakers' => 'kolejność kryteriów'];
    }
}
