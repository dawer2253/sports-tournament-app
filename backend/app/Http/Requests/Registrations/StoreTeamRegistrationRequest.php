<?php

namespace App\Http\Requests\Registrations;

use App\Http\Requests\Players\PlayerRequest;
use App\Http\Requests\Teams\TeamRequest;
use App\Models\Team;
use App\Models\Tournament;
use App\Rules\ChildLimit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Zgłoszenie drużyny ze strony publicznej (#300). Nazwa i skład idą przez
 * te same reguły co dodanie drużyny i zawodnika w panelu, żeby przyjęcie
 * wywracało się najwyżej na tym, co zmieniło się po wysłaniu (nazwa zajęta
 * w międzyczasie, komplet drużyn, mecz rozpoczęty).
 *
 * Pole-pułapkę sprawdza kontroler przed tym requestem: zgłoszenie bota nie
 * ma dostać `422`, które zdradziłoby, czego formularz oczekuje.
 */
class StoreTeamRegistrationRequest extends FormRequest
{
    public const CLOSED_MESSAGE = 'Zapisy do tego turnieju są zamknięte.';

    private ?Tournament $tournament = null;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'teamName' => ['required', ...TeamRequest::nameRulesFor($this->tournament())],
            'contactName' => ['required', 'string', 'max:120'],
            'contactEmail' => ['required', 'string', 'email', 'max:254'],
            'contactPhone' => ['nullable', 'string', 'max:40'],
            'players' => ['sometimes', 'list', 'max:'.Team::MAX_PLAYERS],
            'players.*' => ['array:name,number'],
            'players.*.name' => ['required', ...PlayerRequest::NAME_RULES],
            // Numer nie powtarza się w składzie; `null` z niczym nie koliduje,
            // bo `nullable` pomija dla niego `distinct`. Klucz jest wymagany
            // jak w kontrakcie (`TeamRegistrationPlayer`), wartość może być `null`.
            'players.*.number' => ['present', ...PlayerRequest::NUMBER_RULES, 'distinct'],
            'consent' => ['required', 'boolean:strict', 'accepted'],
        ];
    }

    /**
     * Stan turnieju, nie pole z ciała, więc pod klucz `registration`.
     * Zamknięte zapisy obejmują termin i mecz rozpoczęty
     * (`Tournament::acceptsRegistrations()`); komplet drużyn sprawdza ta sama
     * reguła co dodanie drużyny, tylko pod kluczem formularza.
     *
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->tournament()->acceptsRegistrations()) {
                    $validator->errors()->add('registration', self::CLOSED_MESSAGE);
                }
            },
            ChildLimit::check(
                $this->tournament()->teams(),
                Tournament::MAX_TEAMS,
                'registration',
                'Turniej ma już komplet drużyn.',
            ),
        ];
    }

    /**
     * Turniej po slugu z trasy; szkic i nieznany slug dają `404`, jak każda
     * trasa `/public/t/{slug}*`.
     */
    public function tournament(): Tournament
    {
        return $this->tournament ??= Tournament::findPublishedBySlug($this->route('slug'));
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'teamName' => 'nazwa drużyny',
            'contactName' => 'imię i nazwisko',
            'contactEmail' => 'e-mail',
            'contactPhone' => 'telefon',
            'players' => 'skład',
            'players.*.name' => 'imię i nazwisko zawodnika',
            'players.*.number' => 'numer',
            'consent' => 'zgoda',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'teamName.unique' => TeamRequest::NAME_TAKEN_MESSAGE,
            'players.max' => 'Skład mieści najwyżej '.Team::MAX_PLAYERS.' zawodników.',
            'players.*.number.distinct' => 'Ten numer ma już inny zawodnik ze składu.',
            'consent.required' => 'Zaznacz zgodę na przetwarzanie danych.',
            'consent.accepted' => 'Zaznacz zgodę na przetwarzanie danych.',
            'consent.boolean' => 'Zaznacz zgodę na przetwarzanie danych.',
        ];
    }
}
