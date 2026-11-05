<?php

namespace App\Http\Requests\Tournaments;

use App\Models\Tournament;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Opcjonalny parametr `stat` klasyfikacji panelu (#333): kod z
 * `availableStats` sportu turnieju, inaczej `422` pod `stat`. Reguła
 * i komunikat są te same co na stronie publicznej
 * (`Public\ShowLeaderboardRequest`), tylko turniej przychodzi z wiązania
 * trasy, już po `can('manage')`, więc cudzy turniej dostaje `403` przed `422`.
 *
 * Pusty parametr (`?stat=`) dociera jako `null` przez globalny
 * `ConvertEmptyStringsToNull` i liczy się jak jego brak.
 */
class ShowLeaderboardRequest extends FormRequest
{
    private const UNKNOWN_STAT = 'Tej statystyki nie ma w sporcie tego turnieju.';

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'stat' => ['nullable', 'string', Rule::in($this->tournament()->sport->availableStats())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'stat.string' => self::UNKNOWN_STAT,
            'stat.in' => self::UNKNOWN_STAT,
        ];
    }

    public function tournament(): Tournament
    {
        return $this->route('tournament')->loadMissing('sport');
    }

    /** Wybrana statystyka albo, bez parametru, pierwsza statystyka sportu. */
    public function stat(): string
    {
        return $this->validated('stat') ?? $this->tournament()->sport->availableStats()[0];
    }
}
