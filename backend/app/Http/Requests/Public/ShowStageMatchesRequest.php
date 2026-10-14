<?php

namespace App\Http\Requests\Public;

use App\Models\Tournament;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Wymagany parametr `stageId` meczów fazy (#234): bez niego lista byłaby
 * kompletem meczów turnieju, czyli rozmiarem, którego trasa bez stronicowania
 * nie oddaje, więc brak i zły typ dają `422`. Turniej wczytuje się tu, przed
 * walidacją, jak w `ShowLeaderboardRequest`, więc szkic i nieznany slug dają
 * `404`, zanim padnie `422`.
 *
 * Pusty parametr (`?stageId=`) dociera jako `null` przez globalny
 * `ConvertEmptyStringsToNull` i łapie go `required`.
 */
class ShowStageMatchesRequest extends FormRequest
{
    private ?Tournament $tournament = null;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // Wołane przed regułami, żeby 404 wyprzedzało 422.
        $this->tournament();

        return [
            'stageId' => ['required', 'integer'],
        ];
    }

    /**
     * Te same treści co przy filtrze listy meczów panelu (`IndexMatchesRequest`).
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'stageId.required' => 'Podaj id fazy.',
            'stageId.integer' => 'Id fazy musi być liczbą całkowitą.',
        ];
    }

    public function tournament(): Tournament
    {
        return $this->tournament ??= Tournament::findPublishedBySlug($this->route('slug'));
    }

    public function stageId(): int
    {
        return (int) $this->validated('stageId');
    }
}
