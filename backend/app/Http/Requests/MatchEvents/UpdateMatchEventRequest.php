<?php

namespace App\Http\Requests\MatchEvents;

use App\Models\GameMatch;
use App\Models\MatchEvent;

class UpdateMatchEventRequest extends MatchEventRequest
{
    /**
     * Każde pole można pominąć; reguły zgodności i tak idą po scaleniu
     * z zapisanym zdarzeniem (`MatchEventRequest::after()`).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = $this->fieldRules();

        return [
            'type' => ['sometimes', 'required', ...$rules['type']],
            'teamId' => ['sometimes', 'required', ...$rules['teamId']],
            'playerId' => ['sometimes', ...$rules['playerId']],
            'minute' => ['sometimes', ...$rules['minute']],
            'addedTime' => ['sometimes', ...$rules['addedTime']],
        ];
    }

    protected function match(): GameMatch
    {
        return $this->current()->match;
    }

    protected function current(): MatchEvent
    {
        return $this->route('event');
    }
}
