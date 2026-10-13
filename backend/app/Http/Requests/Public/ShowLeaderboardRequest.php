<?php

namespace App\Http\Requests\Public;

use App\Models\Tournament;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Opcjonalny parametr `stat` klasyfikacji: kod z `availableStats` sportu
 * turnieju, inaczej `422` pod `stat` (#190, reguła 2). Turniej wczytuje się
 * tu, przed walidacją, więc szkic i nieznany slug dają `404`, zanim padnie
 * `422` — tak jak na pozostałych trasach publicznych.
 *
 * Pusty parametr (`?stat=`) dociera jako `null` przez globalny
 * `ConvertEmptyStringsToNull` i liczy się jak jego brak.
 */
class ShowLeaderboardRequest extends FormRequest
{
    private const UNKNOWN_STAT = 'Tej statystyki nie ma w sporcie tego turnieju.';

    private ?Tournament $tournament = null;

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
        return $this->tournament ??= Tournament::findPublishedBySlug($this->route('slug'))->load('sport');
    }

    /** Wybrana statystyka albo, bez parametru, pierwsza statystyka sportu. */
    public function stat(): string
    {
        return $this->validated('stat') ?? $this->tournament()->sport->availableStats()[0];
    }
}
