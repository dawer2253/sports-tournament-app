<?php

namespace App\Http\Requests\Matches;

use App\Models\GameMatch;
use App\Rules\Iso8601WithOffset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Częściowa zmiana meczu (#159, #158): wynik, stan, termin i obiekt.
 *
 * Ciało jest częściowe, więc spójności stanu z wynikiem nie da się wyrazić
 * regułami per pole — zależy od tego, co mecz ma już w bazie. Sprawdzamy ją po
 * scaleniu ciała z zapisanym wierszem, w `after()`, tak jak stan fazy sprawdza
 * dystrybutor rozkładu dat. Wszystkie błędy pary wyników lądują pod klucz
 * `homeScore`: organizator poprawia je liczbami, a nie stanem, a panel pokazuje
 * jeden komunikat pod całym blokiem `__ : __`.
 *
 * Karne nie mają tu reguły i nie wchodzą do `validated()`, więc pole
 * `homePenalties` w ciele niczego nie zmienia — karne należą do S4.
 */
class UpdateMatchRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // `sometimes`: pole nieobecne zostaje bez zmian. `nullable`:
            // obecne `null` czyści wynik, termin albo obiekt.
            'homeScore' => ['sometimes', 'nullable', 'integer:strict', 'min:0', 'max:999'],
            'awayScore' => ['sometimes', 'nullable', 'integer:strict', 'min:0', 'max:999'],
            'status' => ['sometimes', 'string', Rule::in(GameMatch::STATUSES)],
            'kickoffAt' => ['sometimes', 'nullable', 'string', new Iso8601WithOffset],
            'venueId' => ['sometimes', 'nullable', 'integer:strict'],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            $this->checkVenueOwnership(...),
            $this->checkScoreAgainstStatus(...),
        ];
    }

    /**
     * Obiekt musi należeć do turnieju meczu i być żywy. Obcy turniejowi albo
     * usunięty to `422` przy `venueId`, jak przy `venueIds` w rozkładzie dat.
     * Sprawdzamy tylko wtedy, gdy samo id przeszło walidację, żeby literówka
     * nie dawała dwóch komunikatów.
     */
    private function checkVenueOwnership(Validator $validator): void
    {
        $venueId = $this->input('venueId');

        if ($venueId === null || $validator->errors()->has('venueId')) {
            return;
        }

        $alive = $this->match()->stage->tournament->venues()->whereKey($venueId)->exists();

        if (! $alive) {
            $validator->errors()->add('venueId', 'Wybierz obiekt tego turnieju.');
        }
    }

    /**
     * Spójność wyniku ze stanem po scaleniu ciała z zapisanym meczem (#159):
     * `scheduled` ⇔ oba wyniki `null`, a `live` i `finished` wymagają obu
     * liczb; remis przy `allowsDraw: false` jest błędem tylko na `finished`.
     *
     * Gdy samo `status` albo wyniki pojedynczo nie przeszły walidacji, odpuszczamy
     * — komunikat o typie pola jest wtedy trafniejszy niż o niespójności.
     */
    private function checkScoreAgainstStatus(Validator $validator): void
    {
        if ($validator->errors()->hasAny(['status', 'homeScore', 'awayScore'])) {
            return;
        }

        $data = $this->validated();
        $match = $this->match();

        $status = $data['status'] ?? $match->status;
        $home = array_key_exists('homeScore', $data) ? $data['homeScore'] : $match->home_score;
        $away = array_key_exists('awayScore', $data) ? $data['awayScore'] : $match->away_score;

        if ($status === 'scheduled') {
            if ($home !== null || $away !== null) {
                $validator->errors()->add('homeScore', 'Mecz zaplanowany nie ma wyniku. Wyczyść oba pola: homeScore i awayScore.');
            }

            return;
        }

        if ($home === null || $away === null) {
            $validator->errors()->add('homeScore', 'Mecz trwający albo zakończony potrzebuje obu wyników.');

            return;
        }

        if ($status === 'finished' && ! $this->allowsDraw() && $home === $away) {
            $validator->errors()->add('homeScore', 'Ten sport nie zna remisu, więc mecz zakończony musi mieć zwycięzcę.');
        }
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'homeScore.integer' => 'Wynik podaj liczbą całkowitą.',
            'homeScore.min' => 'Wynik nie może być ujemny.',
            'homeScore.max' => 'Wynik może mieć najwyżej 999.',
            'awayScore.integer' => 'Wynik podaj liczbą całkowitą.',
            'awayScore.min' => 'Wynik nie może być ujemny.',
            'awayScore.max' => 'Wynik może mieć najwyżej 999.',
            'status.in' => 'Nieznany stan meczu. Dozwolone: scheduled, live, finished.',
            'venueId.integer' => 'Wybierz obiekt z listy.',
        ];
    }

    public function match(): GameMatch
    {
        /** @var GameMatch $match */
        $match = $this->route('match');

        return $match;
    }

    private function allowsDraw(): bool
    {
        return $this->match()->stage->tournament->sport->allowsDraw();
    }
}
