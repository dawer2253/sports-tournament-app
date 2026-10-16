<?php

namespace App\Http\Requests\Groups;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Waliduje samo ciało. Reguły zależne od stanu turnieju (playoff gra, drużyny
 * grupy, suma w fazie) sprawdza `GroupQualifiers` w transakcji.
 */
class UpdateGroupQualifiersRequest extends FormRequest
{
    /**
     * `integer:strict`, bo zwykłe `integer` przepuściłoby `"2"` i `true`
     * (`backend/AGENTS.md`, „Kontrakt API”).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'qualifiers' => ['required', 'integer:strict', 'min:1'],
        ];
    }

    public function qualifiers(): int
    {
        return $this->validated('qualifiers');
    }
}
