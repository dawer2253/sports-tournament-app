<?php

namespace App\Http\Requests\Stages;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Waliduje samo ciało składu grup. Reguły zależne od stanu fazy (typ, mecze
 * rozpoczęte) i od drużyn turnieju (każda dokładnie raz, liczba wychodzących,
 * suma wychodzących) sprawdza `GroupComposition` w transakcji, bo tam już nic
 * ich nie zmieni między sprawdzeniem a zapisem.
 */
class SetGroupsRequest extends FormRequest
{
    private const EMPTY_GROUPS_MESSAGE = 'Faza grupowa potrzebuje co najmniej jednej grupy.';

    private const SMALL_GROUP_MESSAGE = 'Grupa potrzebuje co najmniej dwóch drużyn.';

    /**
     * `integer:strict` na drużynach i wychodzących, bo zwykłe `integer`
     * przepuściłoby `"2"` i `true` (`backend/AGENTS.md`, „Kontrakt API”).
     * Kolejność grup nadaje `order` z ich kolejności w ciele, więc ciało nie
     * niesie `order`.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'groups' => ['required', 'array', 'min:1'],
            'groups.*.name' => ['required', 'string', 'max:40'],
            'groups.*.teamIds' => ['required', 'array', 'min:2'],
            'groups.*.teamIds.*' => ['integer:strict'],
            'groups.*.qualifiers' => ['required', 'integer:strict', 'min:1'],
        ];
    }

    /**
     * Dwie reguły mają własne zdanie organizera, resztę zostawiamy standardowym
     * komunikatom (`lang/pl/validation.php`). Gwiazdka w kluczu podstawia
     * indeks grupy.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'groups.required' => self::EMPTY_GROUPS_MESSAGE,
            'groups.array' => self::EMPTY_GROUPS_MESSAGE,
            'groups.min' => self::EMPTY_GROUPS_MESSAGE,
            'groups.*.teamIds.required' => self::SMALL_GROUP_MESSAGE,
            'groups.*.teamIds.array' => self::SMALL_GROUP_MESSAGE,
            'groups.*.teamIds.min' => self::SMALL_GROUP_MESSAGE,
        ];
    }

    /**
     * @return list<array{name: string, teamIds: list<int>, qualifiers: int}>
     */
    public function groups(): array
    {
        return $this->validated('groups');
    }
}
