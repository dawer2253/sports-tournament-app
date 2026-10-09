<?php

namespace App\Http\Requests\Tournaments;

use App\Models\Sport;
use App\Models\Tournament;
use Closure;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
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
            // `additionalProperties: false` w kontrakcie: `logoUrl` tu nie
            // występuje, bo logo wgrywa osobna trasa. Bez `required`, bo
            // kontrakt nie wymaga `primaryColor`, więc `{}` niczego nie zmienia.
            'branding' => ['sometimes', 'array:primaryColor'],
            'branding.primaryColor' => ['sometimes', 'required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
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
            'tiebreakers' => ['sometimes', 'array', 'list', 'min:1'],
            'tiebreakers.*' => [$this->tiebreakerRule()],
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
     * Jeden element listy: kod z kontraktu, dostępny w sporcie turnieju
     * i niepowtórzony. Duplikat oznacza tylko drugie i dalsze wystąpienie, żeby
     * błąd stał przy elemencie, który trzeba usunąć. Backend niczego nie
     * poprawia, tylko odrzuca.
     */
    private function tiebreakerRule(): Closure
    {
        $available = $this->sport()->availableTiebreakers();

        return function (string $attribute, mixed $value, Closure $fail) use ($available): void {
            if (! in_array($value, Tournament::TIEBREAKER_CODES, true)) {
                $fail('Nieznane kryterium kolejności.');

                return;
            }

            if (! in_array($value, $available, true)) {
                $fail('To kryterium nie jest dostępne w sporcie tego turnieju.');

                return;
            }

            $index = (int) Str::afterLast($attribute, '.');

            if (in_array($value, array_slice($this->input('tiebreakers'), 0, $index), true)) {
                $fail('To kryterium jest już na liście.');
            }
        };
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
            $this->checkPointsFirst(...),
        ];
    }

    /**
     * Przejścia między stanami są dowolne. Jedyny zakaz (#82): turniej
     * z zakończonym meczem nie wraca do `draft`. `draft` → `draft` nie jest
     * przejściem, więc zakaz go nie dotyczy.
     */
    private function checkReturnToDraft(Validator $validator): void
    {
        $tournament = $this->tournament();

        if ($validator->errors()->has('status')
            || $this->input('status') !== 'draft'
            || $tournament->status === 'draft'
            || ! $tournament->hasFinishedMatches()) {
            return;
        }

        $validator->errors()->add('status', 'Turniej ma zakończony mecz, więc nie może wrócić do szkicu.');
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

    /** `points` stoi zawsze na początku listy. */
    private function checkPointsFirst(Validator $validator): void
    {
        if (! $this->has('tiebreakers')
            || $validator->errors()->hasAny(['tiebreakers', 'tiebreakers.0'])
            || $this->input('tiebreakers.0') === 'points') {
            return;
        }

        $validator->errors()->add('tiebreakers.0', 'Pierwszym kryterium jest zawsze liczba punktów.');
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

        if (Arr::has($validated, 'branding.primaryColor')) {
            $attributes['primary_color'] = $validated['branding']['primaryColor'];
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
            'points' => 'punktacja',
            'points.win' => 'punkty za wygraną',
            'points.draw' => 'punkty za remis',
            'points.loss' => 'punkty za porażkę',
            'tiebreakers' => 'kolejność kryteriów',
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
            'tiebreakers.min' => 'Lista kryteriów musi mieć co najmniej jedną pozycję.',
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
