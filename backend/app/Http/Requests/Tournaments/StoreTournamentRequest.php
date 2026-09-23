<?php

namespace App\Http\Requests\Tournaments;

use App\Models\Tournament;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTournamentRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            // Nieistniejący sport to błędna wartość pola, więc 422 na `sportId`,
            // a nie 404 — to zostaje dla zasobu wskazanego w adresie.
            'sportId' => ['required', 'integer', 'exists:sports,id'],
            'format' => ['required', 'string', Rule::in(array_keys(Tournament::STAGES_BY_FORMAT))],
        ];
    }
}
