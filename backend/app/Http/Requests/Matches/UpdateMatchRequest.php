<?php

namespace App\Http\Requests\Matches;

use App\Matches\LiveClock;
use App\Matches\SetScores;
use App\Models\GameMatch;
use App\Rules\Iso8601WithOffset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Częściowa zmiana meczu (#159, #158, #216): wynik, karne, stan, termin i obiekt.
 *
 * Ciało jest częściowe, więc spójności stanu z wynikiem nie da się wyrazić
 * regułami per pole — zależy od tego, co mecz ma już w bazie. Sprawdzamy ją po
 * scaleniu ciała z zapisanym wierszem, w `after()`, tak jak stan fazy sprawdza
 * dystrybutor rozkładu dat. Wszystkie błędy pary wyników lądują pod klucz
 * `homeScore`: organizator poprawia je liczbami, a nie stanem, a panel pokazuje
 * jeden komunikat pod całym blokiem `__ : __`. Karne idą tym samym torem pod
 * klucz `homePenalties`.
 *
 * Blokady awansu tu nie ma: zależy od meczów zależnych, więc sprawdza ją
 * `App\Matches\Advancement` w transakcji zapisu, pod blokadą ich wierszy.
 *
 * W sporcie z setami (#301) wynik niesie `sets`, a `homeScore` i `awayScore`
 * liczy serwer (`scoreChanges()`), więc klient ich nie wysyła. Reguły setów
 * żyją w `App\Matches\SetScores`.
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
            'homePenalties' => ['sometimes', 'nullable', 'integer:strict', 'min:0', 'max:99'],
            'awayPenalties' => ['sometimes', 'nullable', 'integer:strict', 'min:0', 'max:99'],
            // Sety przychodzą w komplecie i zastępują zapisane (#301).
            'sets' => ['sometimes', 'array', 'list', 'max:5'],
            'sets.*' => ['array:home,away'],
            'sets.*.home' => ['required', 'integer:strict', 'min:0', 'max:99'],
            'sets.*.away' => ['required', 'integer:strict', 'min:0', 'max:99'],
            'status' => ['sometimes', 'string', Rule::in(GameMatch::STATUSES)],
            'kickoffAt' => ['sometimes', 'nullable', 'string', new Iso8601WithOffset],
            'venueId' => ['sometimes', 'nullable', 'integer:strict'],
            'livePeriod' => ['sometimes', 'integer:strict', 'min:1'],
            'periodRunning' => ['sometimes', 'boolean:strict'],
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
            $this->checkSets(...),
            $this->checkPenalties(...),
            $this->checkTeamsBeforeStart(...),
            $this->checkEventsBeforeScheduled(...),
            $this->checkLivePeriod(...),
        ];
    }

    /**
     * Mecz bez obu drużyn (pusty slot drabinki, #216) może być tylko
     * `scheduled`: czeka, aż awans wpuści do niego rywali. Termin i obiekt
     * wolno mu ustawić, więc reguła patrzy na stan po scaleniu, nie na ciało.
     */
    private function checkTeamsBeforeStart(Validator $validator): void
    {
        if ($validator->errors()->has('status')) {
            return;
        }

        $match = $this->match();
        $status = $this->input('status', $match->status);

        if ($status !== 'scheduled' && ($match->home_team_id === null || $match->away_team_id === null)) {
            $validator->errors()->add('status', 'Mecz czeka na rywali z poprzedniej rundy.');
        }
    }

    /**
     * Karne po scaleniu ciała z zapisanym meczem (#216): w fazie `knockout`,
     * przy `finished` i remisie oba wymagane i różne, w każdym innym przypadku
     * oba `null`. Nie czyszczą się same, wzorem wyniku przy `scheduled`.
     * Wszystkie błędy idą pod `homePenalties`, wzorem `homeScore`.
     *
     * Gdy wynik albo stan mają już błąd, odpuszczamy: karne zależą od wyniku,
     * a w koszykówce remis przy `finished` to błąd wyniku, nie karnych.
     */
    private function checkPenalties(Validator $validator): void
    {
        if ($validator->errors()->hasAny(['status', 'homeScore', 'awayScore', 'homePenalties', 'awayPenalties'])) {
            return;
        }

        // W sporcie z setami remisu nie ma, więc karne nie mają kiedy wejść.
        if ($this->tournamentSetFormat() !== null) {
            if ($this->input('homePenalties') !== null || $this->input('awayPenalties') !== null) {
                $validator->errors()->add('homePenalties', 'W meczu na sety nie ma karnych.');
            }

            return;
        }

        $data = $this->validated();
        $match = $this->match();
        $merged = fn (string $field, string $column): ?int => array_key_exists($field, $data) ? $data[$field] : $match->{$column};

        $status = $data['status'] ?? $match->status;
        $home = $merged('homeScore', 'home_score');
        $away = $merged('awayScore', 'away_score');
        $homePenalties = $merged('homePenalties', 'home_penalties');
        $awayPenalties = $merged('awayPenalties', 'away_penalties');
        $given = $homePenalties !== null || $awayPenalties !== null;

        if ($match->stage->type !== 'knockout') {
            if ($given) {
                $validator->errors()->add('homePenalties', 'Karne wpisuje się tylko w meczu pucharowym.');
            }

            return;
        }

        if ($status !== 'finished' || $home === null || $home !== $away) {
            if ($given) {
                $validator->errors()->add('homePenalties', 'Karne należą tylko do remisu w meczu zakończonym. Wyczyść oba pola: homePenalties i awayPenalties.');
            }

            return;
        }

        $message = match (true) {
            ! $given => 'Remis w meczu pucharowym rozstrzygają karne. Wpisz je.',
            $homePenalties === null || $awayPenalties === null => 'Wpisz karne obu drużyn.',
            $homePenalties === $awayPenalties => 'Karne muszą wyłonić zwycięzcę.',
            default => null,
        };

        if ($message !== null) {
            $validator->errors()->add('homePenalties', $message);
        }
    }

    /**
     * Pola części meczu (#297): tylko w meczu `live` po scaleniu stanu z ciała,
     * start części razem z jej numerem, a numer w `1…count` ustawień
     * turnieju, w fazie `knockout` także `count + 1` (dogrywka) — poza
     * sportem z setami, w którym dogrywki nie ma (#301). Start
     * przyjmuje wyłącznie następną część (bieżąca + 1), a przerwa wchodzi
     * tylko po części, która trwa i nie jest ostatnią — turniej bez podziału
     * (`count: 1`) przerwy więc nie ma, dogrywka też nie. Bieżąca część to ta
     * po przejściu stanu z tego samego ciała (`LiveClock::changes`). Wszystkie
     * błędy idą pod `livePeriod`, bo organizator klika jeden przycisk części.
     */
    private function checkLivePeriod(Validator $validator): void
    {
        if (! $this->hasAny(['livePeriod', 'periodRunning']) || $validator->errors()->hasAny(['status', 'livePeriod', 'periodRunning'])) {
            return;
        }

        $match = $this->match();
        $running = $this->input('periodRunning');
        $period = $this->input('livePeriod');
        $count = $match->stage->tournament->period_count;
        $overtime = $match->stage->type === 'knockout' && $this->tournamentSetFormat() === null;
        $last = $overtime ? $count + 1 : $count;
        $status = $this->input('status', $match->status);

        // Zegar po samym przejściu stanu, bez pól części z ciała.
        $clock = [
            'live_period' => $match->live_period,
            'period_started_at' => $match->period_started_at,
            ...LiveClock::changes($match, ['status' => $status], now()),
        ];
        $current = $clock['live_period'] ?? 0;
        $next = $current + 1;
        $partRunning = $clock['period_started_at'] !== null;

        $message = match (true) {
            $status !== 'live' => 'Część meczu prowadzi się tylko w meczu trwającym.',
            $period !== null && $running !== true => 'Część meczu startuje razem z periodRunning: true.',
            $period === null && $running === true => 'Podaj część meczu, która startuje.',
            $period !== null && $period > $last => "Ten mecz nie ma {$period}. części.",
            $period !== null && $period !== $next => "Następna część tego meczu to {$next}.",
            $running === false && (! $partRunning || $current >= $count) => 'Przerwa jest tylko po części, która trwa i nie jest ostatnią.',
            default => null,
        };

        if ($message !== null) {
            $validator->errors()->add('livePeriod', $message);
        }
    }

    /**
     * Mecz ze zdarzeniami nie wraca do `scheduled` (#188, reguła 8): zdarzeń
     * nic nie kasuje kaskadowo, a mecz zaplanowany zdarzeń mieć nie może.
     * Domyka to też guard zawodnika, który liczy zdarzenia tylko w meczach
     * rozpoczętych (`Player::hasStartedMatches()`).
     */
    private function checkEventsBeforeScheduled(Validator $validator): void
    {
        if ($this->input('status') === 'scheduled' && $this->match()->events()->exists()) {
            $validator->errors()->add('status', 'Mecz ma zdarzenia. Usuń je, zanim cofniesz mecz do zaplanowanych.');
        }
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

        // W sporcie z setami wynik liczy serwer, a spójność ze stanem
        // sprawdza `checkSets()`.
        if ($this->tournamentSetFormat() !== null) {
            if ($this->hasAny(['homeScore', 'awayScore'])) {
                $validator->errors()->add('homeScore', 'W meczu na sety wynik liczy się z setów.');
            }

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
     * Sety po scaleniu ciała z zapisanym meczem (#301): lista z ciała albo
     * zapisana, a stan z ciała albo zapisany. Reguły i klucze błędów
     * (`sets.{n}` przy secie, `sets` przy meczu) opisuje `MatchUpdate`
     * w kontrakcie. W sporcie bez setów `sets` daje `422`.
     */
    private function checkSets(Validator $validator): void
    {
        $format = $this->tournamentSetFormat();

        if ($format === null) {
            if ($this->has('sets')) {
                $validator->errors()->add('sets', 'Wyniki setów wpisuje się tylko w sporcie z setami.');
            }

            return;
        }

        $setErrors = array_filter(
            array_keys($validator->errors()->messages()),
            fn (string $key): bool => $key === 'sets' || str_starts_with($key, 'sets.'),
        );

        if ($setErrors !== [] || $validator->errors()->has('status')) {
            return;
        }

        foreach (SetScores::errors($this->mergedSets(), $this->mergedStatus(), $format) as $key => $message) {
            $validator->errors()->add($key, $message);
        }
    }

    /**
     * Wynik meczu do zapisu w sporcie z setami: sety wygrane z setów po
     * scaleniu, a przy `scheduled` `null`. W sporcie bez setów pusta tablica,
     * bo wynik przychodzi wtedy wprost z ciała.
     *
     * @return array<string, mixed>
     */
    public function scoreChanges(): array
    {
        $format = $this->tournamentSetFormat();

        if ($format === null) {
            return [];
        }

        $sets = $this->mergedSets();
        [$home, $away] = $this->mergedStatus() === 'scheduled' ? [null, null] : SetScores::won($sets, $format);

        return ['sets' => $sets, 'home_score' => $home, 'away_score' => $away];
    }

    /**
     * @return list<array{home: int, away: int}>
     */
    private function mergedSets(): array
    {
        if ($this->has('sets')) {
            return array_map(
                fn (array $set): array => ['home' => $set['home'], 'away' => $set['away']],
                $this->input('sets'),
            );
        }

        return $this->match()->sets ?? [];
    }

    private function mergedStatus(): string
    {
        return $this->input('status', $this->match()->status);
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
            'homePenalties.integer' => 'Karne podaj liczbą całkowitą.',
            'homePenalties.min' => 'Karne nie mogą być ujemne.',
            'homePenalties.max' => 'Karne mogą mieć najwyżej 99.',
            'awayPenalties.integer' => 'Karne podaj liczbą całkowitą.',
            'awayPenalties.min' => 'Karne nie mogą być ujemne.',
            'awayPenalties.max' => 'Karne mogą mieć najwyżej 99.',
            'status.in' => 'Nieznany stan meczu. Dozwolone: scheduled, live, finished.',
            'venueId.integer' => 'Wybierz obiekt z listy.',
            'livePeriod.integer' => 'Część meczu podaj liczbą całkowitą.',
            'livePeriod.min' => 'Części meczu liczą się od 1.',
            'periodRunning.boolean' => 'periodRunning to true albo false.',
            'sets.array' => 'Sety podaj listą wyników: [{ home, away }, …].',
            'sets.list' => 'Sety podaj listą wyników: [{ home, away }, …].',
            'sets.max' => 'Mecz ma najwyżej 5 setów.',
            'sets.*.array' => 'Wynik seta to { home, away }.',
            'sets.*.home.required' => 'Podaj punkty obu drużyn w secie.',
            'sets.*.away.required' => 'Podaj punkty obu drużyn w secie.',
            'sets.*.home.integer' => 'Punkty w secie podaj liczbą całkowitą.',
            'sets.*.away.integer' => 'Punkty w secie podaj liczbą całkowitą.',
            'sets.*.home.min' => 'Punkty w secie nie mogą być ujemne.',
            'sets.*.away.min' => 'Punkty w secie nie mogą być ujemne.',
            'sets.*.home.max' => 'Set ma najwyżej 99 punktów.',
            'sets.*.away.max' => 'Set ma najwyżej 99 punktów.',
        ];
    }

    /**
     * Klucz błędu blokady awansu (`App\Matches\Advancement`): `homeScore`,
     * wzorem błędów pary wyników, a `status`, gdy ciało nie niesie wyniku ani
     * karnych, tylko stan — organizator zmienił wtedy wyłącznie przełącznik.
     */
    public function advancementErrorKey(): string
    {
        return $this->hasAny(['homeScore', 'awayScore', 'homePenalties', 'awayPenalties', 'sets']) ? 'homeScore' : 'status';
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

    /**
     * Format seta turnieju meczu, `null` w sporcie bez setów (#301).
     *
     * @return array{setsToWin: int, setPoints: int, decidingSetPoints: int, minLead: int}|null
     */
    private function tournamentSetFormat(): ?array
    {
        return $this->match()->stage->tournament->set_format;
    }
}
