<?php

namespace App\Http\Requests\Venues;

use App\Models\Tournament;
use App\Models\Venue;
use App\Rules\UniqueAmongLiveSiblings;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Wspólne reguły pól obiektu dla `POST` i `PATCH` — kontrakt mówi o nich
 * raz, przy `POST /tournaments/{tournament}/venues`, a `PATCH` odsyła tam.
 */
abstract class VenueRequest extends FormRequest
{
    /** Turniej, wśród którego obiektów nazwa ma być unikalna. */
    abstract protected function tournament(): Tournament;

    /** Obiekt, którego własna nazwa nie koliduje sama ze sobą. */
    protected function ignoredVenue(): ?Venue
    {
        return null;
    }

    /**
     * Unikalność tylko wśród żywych obiektów turnieju, bo obiekt usunięty nie
     * blokuje nazwy. Wielkość liter pomija collation kolumny
     * (`utf8mb4_unicode_ci`), a spacje na brzegach obcina globalny
     * `TrimStrings` — żadne z nich nie wymaga tu własnego kodu.
     *
     * @return list<mixed>
     */
    protected function nameRules(): array
    {
        return [
            'string',
            'max:120',
            UniqueAmongLiveSiblings::rule('venues', 'name', 'tournament_id', $this->tournament(), $this->ignoredVenue()),
        ];
    }

    /**
     * Pusty napis dociera tu już jako `null` (globalny
     * `ConvertEmptyStringsToNull`), więc `nullable` obejmuje oba przypadki.
     *
     * @return list<string>
     */
    protected function addressRules(): array
    {
        return ['nullable', 'string', 'max:255'];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'W tym turnieju jest już obiekt o tej nazwie.',
        ];
    }
}
