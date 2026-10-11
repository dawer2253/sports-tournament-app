<?php

namespace App\Http\Requests\Stages;

use App\Models\Stage;
use App\Models\Tournament;
use App\Rules\IanaTimeZone;
use App\Rules\Iso8601WithOffset;
use App\Schedule\DatePlan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Waliduje ciało rozkładu dat (#158) i składa z niego `DatePlan`. Warunek
 * zależny od stanu fazy (czy ma terminarz) sprawdza `DateDistributor`
 * w transakcji, bo tam już nic go nie zmieni między sprawdzeniem a zapisem.
 *
 * `startAt` jest tu pierwszym `requestBody` z datą, więc niesie reguły
 * wejścia z ADR-0008: wymagany offset i przeliczenie na UTC (`Iso8601WithOffset`).
 */
class ScheduleDatesRequest extends FormRequest
{
    private const MODE_MESSAGE = 'Wybierz tryb rozkładu: „co N dni” albo „ciągiem”.';

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'mode' => ['required', 'string', Rule::in(['interval', 'continuous'])],
            'startAt' => ['required', 'string', new Iso8601WithOffset],
            'timeZone' => ['required', 'string', new IanaTimeZone],
            'intervalDays' => ['nullable', 'integer:strict', 'min:1'],
            'dayEndTime' => ['nullable', 'string', 'date_format:H:i'],
            'venueIds' => ['nullable', 'array', 'max:20'],
            // `distinct` łapie powtórzenie, a `integer:strict` — napis albo `true`.
            'venueIds.*' => ['integer:strict', 'distinct'],
            'fromRound' => ['nullable', 'integer:strict', 'min:1'],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            $this->checkModeFields(...),
            $this->checkVenueOwnership(...),
        ];
    }

    /**
     * `intervalDays` należy do trybu `interval`, a `dayEndTime` do `continuous`.
     * Pole z drugiego trybu to pomyłka organizera, więc dostaje `422`.
     */
    private function checkModeFields(Validator $validator): void
    {
        if ($validator->errors()->has('mode')) {
            return;
        }

        $mode = $this->input('mode');
        $hasIntervalDays = $this->input('intervalDays') !== null;
        $hasDayEndTime = $this->input('dayEndTime') !== null;

        if ($mode === 'interval' && ! $hasIntervalDays && ! $validator->errors()->has('intervalDays')) {
            $validator->errors()->add('intervalDays', 'Podaj odstęp w dniach.');
        }

        if ($mode === 'continuous' && $hasIntervalDays) {
            $validator->errors()->add('intervalDays', 'Odstęp w dniach dotyczy tylko trybu „co N dni”.');
        }

        if ($mode === 'interval' && $hasDayEndTime) {
            $validator->errors()->add('dayEndTime', 'Koniec dnia dotyczy tylko trybu „ciągiem”.');
        }
    }

    /**
     * Obiekty muszą należeć do tego turnieju i być żywe. Inny turniej albo
     * obiekt usunięty to `422` przy `venueIds`, jak przy `PATCH` meczu (#158).
     * Błąd dodajemy tylko wtedy, gdy same id przeszły walidację, żeby literówka
     * nie dawała dwóch komunikatów.
     */
    private function checkVenueOwnership(Validator $validator): void
    {
        $ids = $this->input('venueIds');

        if (! is_array($ids) || $ids === [] || $validator->errors()->hasAny(['venueIds', 'venueIds.*'])) {
            return;
        }

        $alive = $this->tournament()->venues()->whereIn('id', $ids)->count();

        if ($alive !== count($ids)) {
            $validator->errors()->add('venueIds', 'Wybierz obiekty tego turnieju.');
        }
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'mode.required' => self::MODE_MESSAGE,
            'mode.in' => self::MODE_MESSAGE,
            'startAt.required' => 'Podaj datę i godzinę startu.',
            'timeZone.required' => 'Nie udało się ustalić strefy czasowej przeglądarki.',
            'intervalDays.integer' => 'Odstęp podaj w pełnych dniach.',
            'intervalDays.min' => 'Odstęp to co najmniej jeden dzień.',
            'dayEndTime.date_format' => 'Koniec dnia podaj jako godzinę, np. 18:00.',
            'venueIds.max' => 'Wybierz najwyżej 20 obiektów.',
            'venueIds.*.distinct' => 'Ten sam obiekt nie może wystąpić dwa razy.',
            'fromRound.integer' => 'Numer kolejki musi być liczbą całkowitą.',
            'fromRound.min' => 'Kolejki liczą się od jedynki.',
        ];
    }

    public function plan(): DatePlan
    {
        return new DatePlan(
            mode: $this->validated('mode'),
            startAt: Iso8601WithOffset::toUtc($this->validated('startAt')),
            timeZone: $this->validated('timeZone'),
            intervalDays: $this->validated('intervalDays'),
            dayEndTime: $this->validated('dayEndTime'),
            venueIds: array_map(intval(...), $this->validated('venueIds') ?? []),
            fromRound: $this->validated('fromRound'),
        );
    }

    private function tournament(): Tournament
    {
        /** @var Stage $stage */
        $stage = $this->route('stage');

        return $stage->tournament;
    }
}
