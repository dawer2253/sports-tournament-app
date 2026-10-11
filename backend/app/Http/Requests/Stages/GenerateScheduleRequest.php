<?php

namespace App\Http\Requests\Stages;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Waliduje samo ciało. Warunki, które zależą od stanu fazy (typ, mecze
 * rozpoczęte, liczba drużyn), sprawdza `ScheduleGenerator` w transakcji,
 * bo tam już nic ich nie zmieni między sprawdzeniem a zapisem.
 */
class GenerateScheduleRequest extends FormRequest
{
    private const MEETINGS_MESSAGE = 'Wybierz, ile razy grają ze sobą drużyny: raz albo dwa razy.';

    /**
     * `integer:strict`, bo zwykłe `integer` przepuściłoby `"2"` i `true`
     * (`backend/AGENTS.md`, „Kontrakt API”). Wartości domyślnej nie ma:
     * organizer wybiera świadomie (#157).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'meetings' => ['required', 'integer:strict', 'in:1,2'],
        ];
    }

    /**
     * Jedno zdanie na każdy błąd pola: dla organizera brak wyboru, zły typ
     * i trzy spotkania to ta sama pomyłka.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'meetings.required' => self::MEETINGS_MESSAGE,
            'meetings.integer' => self::MEETINGS_MESSAGE,
            'meetings.in' => self::MEETINGS_MESSAGE,
        ];
    }

    public function meetings(): int
    {
        return $this->validated('meetings');
    }
}
