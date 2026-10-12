<?php

namespace App\Http\Requests\MatchEvents;

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Wspólne reguły zdarzenia meczu dla `POST` i `PATCH` (#188, reguły 6–8).
 *
 * Typ, drużyna i zawodnik zależą od siebie nawzajem i od meczu, a `PATCH` jest
 * częściowy, więc ich zgodność sprawdzamy w `after()` **po scaleniu** ciała
 * z zapisanym zdarzeniem — jak `UpdateMatchRequest`. Dzięki temu zmiana samego
 * `teamId` na przeciwnika przy zostawionym zawodniku daje `422` pod
 * `playerId`, zamiast po cichu przepiąć zawodnika do drugiej drużyny.
 *
 * Baza niezmiennika drużyna–zawodnik nie wiąże (klucze obce wskazują osobno
 * drużynę i zawodnika), więc pilnuje go wyłącznie ten Form Request.
 */
abstract class MatchEventRequest extends FormRequest
{
    abstract protected function match(): GameMatch;

    /** Zapisane zdarzenie, z którym scalamy ciało; `null` przy dodawaniu. */
    protected function current(): ?MatchEvent
    {
        return null;
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            $this->checkMatchStarted(...),
            $this->checkAgainstSportAndMatch(...),
        ];
    }

    /**
     * Zdarzenia ma tylko mecz rozpoczęty (#188, reguła 8). Klucz `match`, bo
     * organizator nie poprawia tego żadnym polem ciała, tylko stanem meczu.
     */
    private function checkMatchStarted(Validator $validator): void
    {
        if ($this->match()->status === 'scheduled') {
            $validator->errors()->add('match', MatchEvent::NOT_STARTED_MESSAGE);
        }
    }

    /**
     * Typ ze sportu turnieju, drużyna z meczu, zawodnik z drużyny — po scaleniu.
     * Pole, które nie przeszło reguł typu, pomijamy, żeby literówka nie dawała
     * dwóch komunikatów; przy meczu zaplanowanym nie sprawdzamy nic więcej, bo
     * i tak nic nie da się zapisać.
     */
    private function checkAgainstSportAndMatch(Validator $validator): void
    {
        $errors = $validator->errors();

        if ($errors->hasAny(['match', 'type', 'teamId', 'playerId'])) {
            return;
        }

        $data = $this->validated();
        $current = $this->current();
        $match = $this->match();

        $typeCode = $data['type'] ?? $current?->type;
        $teamId = $data['teamId'] ?? $current?->team_id;
        $playerId = array_key_exists('playerId', $data) ? $data['playerId'] : $current?->player_id;

        $type = $match->stage->tournament->sport->eventType($typeCode);

        if ($type === null) {
            $errors->add('type', 'Ten sport nie zna takiego zdarzenia.');
        }

        if (! in_array($teamId, [$match->home_team_id, $match->away_team_id], true)) {
            $errors->add('teamId', 'Ta drużyna nie gra w tym meczu.');
        }

        if ($type !== null && $type['hasPlayer'] && $playerId === null) {
            $errors->add('playerId', 'Wskaż zawodnika.');

            return;
        }

        if ($type !== null && ! $type['hasPlayer'] && $playerId !== null) {
            $errors->add('playerId', 'To zdarzenie nie ma zawodnika.');

            return;
        }

        // Zawodnik usunięty miękko odpada sam: `SoftDeletes` ukrywa go w zapytaniu.
        if ($playerId !== null && ! $errors->has('teamId')
            && ! Player::whereKey($playerId)->where('team_id', $teamId)->exists()) {
            $errors->add('playerId', 'Zawodnik nie gra w wybranej drużynie.');
        }
    }

    /**
     * `integer:strict`, bo kontrakt mówi `integer`, a zwykłe `integer`
     * przepuszcza `"9"` i `true` (`backend/AGENTS.md`).
     *
     * @return array<string, list<mixed>>
     */
    protected function fieldRules(): array
    {
        return [
            'type' => ['string', 'max:32'],
            'teamId' => ['integer:strict'],
            'playerId' => ['nullable', 'integer:strict'],
            'minute' => ['nullable', 'integer:strict', 'between:1,150'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Wybierz typ zdarzenia.',
            'type.string' => 'Ten sport nie zna takiego zdarzenia.',
            'type.max' => 'Ten sport nie zna takiego zdarzenia.',
            'teamId.required' => 'Wybierz drużynę.',
            'teamId.integer' => 'Ta drużyna nie gra w tym meczu.',
            'playerId.present' => 'Wskaż zawodnika albo wyślij null.',
            'playerId.integer' => 'Zawodnik nie gra w wybranej drużynie.',
            'minute.present' => 'Podaj minutę albo wyślij null.',
            'minute.integer' => 'Minuta to liczba od 1 do 150.',
            'minute.between' => 'Minuta to liczba od 1 do 150.',
        ];
    }
}
