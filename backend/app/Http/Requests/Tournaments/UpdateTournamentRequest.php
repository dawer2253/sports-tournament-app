<?php

namespace App\Http\Requests\Tournaments;

use App\Http\Requests\Tournaments\Concerns\ValidatesTiebreakers;
use App\Models\Sport;
use App\Models\Tournament;
use App\Rules\Iso8601WithOffset;
use Closure;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Każde pole jest opcjonalne i zmienia się tylko to, co przyszło, więc puste
 * ciało niczego nie rusza. Wysłane pole nie może być puste — stąd `required`
 * za `sometimes`.
 *
 * Poza powrotem do `draft` żadna reguła nie zależy od statusu turnieju ani od
 * zakończonych meczów: punktację i tiebreaki wolno zmieniać zawsze (#87).
 */
class UpdateTournamentRequest extends TournamentRequest
{
    use ValidatesTiebreakers;

    /** Kolizja sluga — z walidacji i z wyścigu o unikalny indeks w kontrolerze. */
    public const SLUG_TAKEN_MESSAGE = 'Ten adres ma już inny turniej.';

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $allowsDraw = $this->sport()->allowsDraw();

        return [
            'name' => ['sometimes', 'required', ...$this->nameRules()],
            'slug' => [
                'sometimes', 'required', 'string',
                'min:'.Tournament::SLUG_MIN_LENGTH, 'max:'.Tournament::SLUG_MAX_LENGTH,
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                // Slug jest unikalny globalnie, bo z niego powstaje publiczny
                // adres; własny slug turnieju z nim nie koliduje.
                Rule::unique('tournaments', 'slug')->ignore($this->tournament()),
            ],
            'status' => ['sometimes', 'required', 'string', Rule::in(Tournament::STATUSES)],
            // Długość meczu (#158): 10–600 minut razem z przerwą po nim.
            'matchDuration' => ['sometimes', 'required', 'integer:strict', 'between:10,600'],
            // Podział meczu (#210) przychodzi w komplecie albo wcale, jak
            // punktacja. Zgodność minut z liczbą części sprawdza `after()`.
            'periods' => ['sometimes', 'required', 'array'],
            'periods.count' => ['bail', 'required_with:periods', 'integer:strict', 'between:1,10'],
            'periods.minutes' => ['bail', 'nullable', 'integer:strict', 'between:1,150'],
            // `additionalProperties: false` w kontrakcie: `logoUrl` tu nie
            // występuje, bo logo wgrywa osobna trasa. Bez `required`, bo
            // kontrakt nie wymaga `primaryColor`, więc `{}` niczego nie zmienia.
            'branding' => ['sometimes', 'array:primaryColor'],
            'branding.primaryColor' => ['sometimes', 'required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            // Zapisy (#300), zagnieżdżone jak `branding`: zmienia się tylko
            // to, co przyszło, a `pendingCount` liczy serwer. Termin z
            // wymaganym offsetem (ADR-0008); `null` go usuwa.
            'registration' => ['sometimes', 'array:open,deadline'],
            'registration.open' => ['sometimes', 'required', 'boolean:strict'],
            'registration.deadline' => ['sometimes', 'nullable', 'string', new Iso8601WithOffset],
            // Punktacja przychodzi w komplecie albo wcale.
            'points' => ['sometimes', 'required', 'array'],
            'points.win' => $this->pointRules(),
            'points.draw' => [
                ...$this->pointRules(),
                // `bail` z `pointRules()` sprawia, że tu dociera już liczba
                // z zakresu, więc literówka nie daje dwóch komunikatów.
                function (string $attribute, mixed $value, Closure $fail) use ($allowsDraw): void {
                    if (! $allowsDraw && $value !== 0) {
                        $fail('W tym sporcie nie ma remisów, więc remis musi dawać 0 punktów.');
                    }
                },
            ],
            'points.loss' => $this->pointRules(),
            ...$this->tiebreakerRules($this->sport()),
        ];
    }

    /**
     * `integer:strict`, bo zwykłe `integer` przepuszcza `"3"` i `true`, które
     * trafiłyby do JSON-a w kolumnie i wróciły w odpowiedzi wbrew typowi
     * z kontraktu.
     *
     * @return list<mixed>
     */
    private function pointRules(): array
    {
        return ['bail', 'required_with:points', 'integer:strict', 'between:0,10'];
    }

    /**
     * Reguły, które patrzą na kilka pól naraz albo na stan turnieju. Każda
     * rusza dopiero wtedy, gdy pola, na których stoi, przeszły walidację —
     * inaczej jedna literówka dawałaby dwa komunikaty.
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            $this->checkReturnToDraft(...),
            $this->checkPointsOrder(...),
            $this->checkPeriodMinutes(...),
            $this->checkTiebreakersStartWithPoints(...),
        ];
    }

    /**
     * Przejścia między stanami są dowolne. Jedyny zakaz (#82): turniej
     * z meczem rozegranym albo trwającym nie wraca do `draft` (#171 dołożył
     * mecz trwający, bo pilnuje tego ta sama metoda co guard usuwania).
     * `draft` → `draft` nie jest przejściem, więc zakaz go nie dotyczy.
     */
    private function checkReturnToDraft(Validator $validator): void
    {
        $tournament = $this->tournament();

        if ($validator->errors()->has('status')
            || $this->input('status') !== 'draft'
            || $tournament->status === 'draft'
            || ! $tournament->hasStartedMatches()) {
            return;
        }

        $validator->errors()->add('status', 'Turniej ma rozegrane lub trwające mecze, więc nie może wrócić do szkicu.');
    }

    /**
     * `loss < win`, a w sporcie z remisami także `loss ≤ draw ≤ win`. Bez
     * remisów `draw` nie wchodzi do porządku, bo np. koszykówka ma `draw: 0`
     * i `loss: 1`.
     */
    private function checkPointsOrder(Validator $validator): void
    {
        if (! $this->has('points')
            || $validator->errors()->hasAny(['points', 'points.win', 'points.draw', 'points.loss'])) {
            return;
        }

        ['win' => $win, 'draw' => $draw, 'loss' => $loss] = $this->input('points');

        if (! $this->sport()->allowsDraw()) {
            if ($loss >= $win) {
                $validator->errors()->add('points', 'Porażka musi dawać mniej punktów niż wygrana.');
            }

            return;
        }

        if ($loss >= $win || $draw < $loss || $draw > $win) {
            $validator->errors()->add('points', 'Porażka musi dawać mniej punktów niż wygrana, a remis tyle co porażka, wygrana albo wartość pomiędzy nimi.');
        }
    }

    /**
     * Minuty części idą za liczbą części: przy jednej („bez podziału”) ich
     * nie ma, przy kilku są wymagane. Brak klucza `minutes` znaczy to samo
     * co `null`. Błąd siada pod `periods.minutes`, bo to minuty poprawia
     * organizer, gdy wybrał już liczbę części.
     */
    private function checkPeriodMinutes(Validator $validator): void
    {
        if (! $this->has('periods')
            || $validator->errors()->hasAny(['periods', 'periods.count', 'periods.minutes'])) {
            return;
        }

        $count = $this->input('periods.count');
        $minutes = $this->input('periods.minutes');

        if ($count === 1 && $minutes !== null) {
            $validator->errors()->add('periods.minutes', 'Mecz bez podziału nie ma długości części.');
        } elseif ($count > 1 && $minutes === null) {
            $validator->errors()->add('periods.minutes', 'Podaj długość części w minutach.');
        }
    }

    /**
     * Kolumny do zapisu, wyłącznie z pól, które przyszły. Punktacja jest
     * składana od nowa: kontrakt dopuszcza w niej dodatkowe klucze, a te nie
     * mogą trafić do kolumny, i klucze mają stać w stałej kolejności.
     *
     * @return array<string, mixed>
     */
    public function tournamentAttributes(): array
    {
        $validated = $this->validated();

        $attributes = Arr::only($validated, ['name', 'slug', 'status', 'tiebreakers']);

        if (Arr::has($validated, 'matchDuration')) {
            $attributes['match_duration'] = $validated['matchDuration'];
        }

        if (Arr::has($validated, 'periods')) {
            $attributes['period_count'] = $validated['periods']['count'];
            $attributes['period_minutes'] = $validated['periods']['minutes'] ?? null;
        }

        if (Arr::has($validated, 'branding.primaryColor')) {
            $attributes['primary_color'] = $validated['branding']['primaryColor'];
        }

        if (Arr::has($validated, 'registration.open')) {
            $attributes['registration_open'] = $validated['registration']['open'];
        }

        if (Arr::has($validated, 'registration.deadline')) {
            $deadline = $validated['registration']['deadline'];
            $attributes['registration_deadline'] = $deadline === null ? null : Iso8601WithOffset::toUtc($deadline);
        }

        if (Arr::has($validated, 'points')) {
            ['win' => $win, 'draw' => $draw, 'loss' => $loss] = $validated['points'];
            $attributes['points'] = ['win' => $win, 'draw' => $draw, 'loss' => $loss];
        }

        return $attributes;
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'slug' => 'adres',
            'branding' => 'branding',
            'branding.primaryColor' => 'kolor',
            'registration' => 'zapisy',
            'registration.open' => 'zapisy otwarte',
            'registration.deadline' => 'termin zapisów',
            'matchDuration' => 'długość meczu',
            'periods' => 'podział meczu',
            'periods.count' => 'liczba części',
            'periods.minutes' => 'minuty na część',
            'points' => 'punktacja',
            'points.win' => 'punkty za wygraną',
            'points.draw' => 'punkty za remis',
            'points.loss' => 'punkty za porażkę',
            ...$this->tiebreakerAttributes(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'slug.regex' => 'Adres może zawierać tylko małe litery bez polskich znaków, cyfry i pojedyncze myślniki między nimi.',
            'slug.unique' => self::SLUG_TAKEN_MESSAGE,
            'branding.primaryColor.regex' => 'Kolor podaj w formacie #RRGGBB.',
            'periods.count.required_with' => 'Podaj liczbę części.',
            'periods.count.integer' => 'Liczba części musi wynosić od 1 do 10.',
            'periods.count.between' => 'Liczba części musi wynosić od 1 do 10.',
            'periods.minutes.integer' => 'Część trwa od 1 do 150 minut.',
            'periods.minutes.between' => 'Część trwa od 1 do 150 minut.',
            ...$this->tiebreakerMessages(),
        ];
    }

    private function tournament(): Tournament
    {
        return $this->route('tournament');
    }

    private function sport(): Sport
    {
        return $this->tournament()->sport;
    }
}
