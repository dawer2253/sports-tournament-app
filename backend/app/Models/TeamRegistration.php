<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

/**
 * Zgłoszenie drużyny do turnieju (#300, `TeamRegistration` w `CONTEXT.md`).
 * Nie jest drużyną: nie stoi w tabeli, w grupie ani w terminarzu. Drużyna
 * powstaje dopiero z przyjęcia, według reguł dodania drużyny przez
 * organizatora — te sprawdza `AcceptTeamRegistrationRequest`, zanim
 * kontroler zawoła `accept()`.
 *
 * Dane zgłaszającego i skład to dane osobowe. Zna je tylko organizer,
 * odrzucenie je usuwa, a przyjęte zgłoszenie znika razem ze swoją drużyną
 * (`Team::booted()`).
 */
#[Fillable([
    'tournament_id', 'team_id', 'team_name', 'status',
    'contact_name', 'contact_email', 'contact_phone', 'players', 'decided_at',
])]
class TeamRegistration extends Model
{
    use HasFactory;

    /**
     * Stany zgłoszenia, w kolejności z kontraktu (`TeamRegistrationStatus`).
     * Lista powtarza enum z migracji, bo walidacja filtra potrzebuje jej w PHP.
     *
     * @var list<string>
     */
    public const STATUSES = ['pending', 'accepted', 'rejected'];

    /** O zgłoszeniu rozstrzyga się raz: przyjęcie i odrzucenie rozpatrzonego dają `422` pod `registration`. */
    public const ALREADY_DECIDED_MESSAGE = 'To zgłoszenie zostało już rozpatrzone.';

    protected function casts(): array
    {
        return [
            'players' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Tworzy drużynę i zawodników ze składu, w jednej transakcji ze zmianą
     * stanu zgłoszenia: albo powstaje wszystko, albo nic. Dane zgłaszającego
     * do drużyny nie przechodzą. Reguły przyjęcia sprawdza wywołujący, pod
     * blokadą turnieju (`TeamRegistrationController::decide()`).
     */
    public function accept(): Team
    {
        return DB::transaction(function (): Team {
            $team = $this->tournament->teams()->create(['name' => $this->team_name]);

            foreach ($this->players ?? [] as $player) {
                $team->players()->create(['name' => $player['name'], 'number' => $player['number']]);
            }

            $this->update(['status' => 'accepted', 'team_id' => $team->id, 'decided_at' => now()]);

            return $team;
        });
    }

    /**
     * Odrzucenie od razu usuwa dane osobowe (decyzja z triage'u #300):
     * zostaje nazwa drużyny i chwila decyzji.
     */
    public function reject(): void
    {
        $this->update([
            'status' => 'rejected',
            'decided_at' => now(),
            'contact_name' => null,
            'contact_email' => null,
            'contact_phone' => null,
            'players' => null,
        ]);
    }
}
