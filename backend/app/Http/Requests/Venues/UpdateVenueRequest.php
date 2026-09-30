<?php

namespace App\Http\Requests\Venues;

use App\Models\Tournament;
use App\Models\Venue;

class UpdateVenueRequest extends VenueRequest
{
    /**
     * Oba pola można pominąć. Wysłane `name` musi być niepuste — stąd
     * `required` za `sometimes` — a `address` przyjmuje `null`, które czyści
     * adres.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', ...$this->nameRules()],
            'address' => ['sometimes', ...$this->addressRules()],
        ];
    }

    protected function tournament(): Tournament
    {
        return $this->venue()->tournament;
    }

    protected function ignoredVenue(): Venue
    {
        return $this->venue();
    }

    private function venue(): Venue
    {
        return $this->route('venue');
    }
}
