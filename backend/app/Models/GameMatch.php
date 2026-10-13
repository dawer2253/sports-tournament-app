<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Mecz. W `CONTEXT.md`, w API i w bazie (`matches`) byt nazywa się **Match** —
 * klasa nie może, bo `match` jest słowem kluczowym PHP (ADR-0005).
 *
 * Pola drabinkowe (`winner_to_match_id`, `loser_to_match_id`,
 * `advances_to_slot`) opisuje ADR-0004. Ich niezmienniki — niepuste wyłącznie
 * w fazie `knockout`, `advances_to_slot` niepuste dokładnie wtedy, gdy istnieje
 * choć jedna krawędź — pilnuje `App\Schedule\BracketGenerator` i jego testy
 * (`GenerateBracketTest`). Schemat ich nie wyrazi.
 */
#[Fillable([
    'round_id', 'stage_id', 'group_id', 'match_number',
    'home_team_id', 'away_team_id',
    'home_score', 'away_score', 'home_penalties', 'away_penalties',
    'status', 'kickoff_at', 'venue_id',
    'winner_to_match_id', 'loser_to_match_id', 'advances_to_slot',
])]
#[Table('matches')]
class GameMatch extends Model
{
    use HasFactory;

    /**
     * Mecz rozpoczęty (`CONTEXT.md`): trwający albo zakończony. Wiąże
     * powiązane z nim byty (`GuardsStartedMatches`) i zamyka turniej na nowe
     * drużyny. Pozostaje tylko `scheduled` — mecz, który można jeszcze
     * skasować albo przenieść. „Rozegrany” znaczy w słowniku „zakończony”,
     * stąd `started`, a nie `played`.
     */
    public const STARTED_STATUSES = ['live', 'finished'];

    /**
     * Stany meczu, w kolejności z kontraktu (`MatchStatus`). Lista powtarza
     * enum z migracji `create_matches_table`, bo walidacja filtra listy
     * meczów potrzebuje jej w PHP — oba źródła pilnuje `ListMatchesTest`.
     *
     * @var list<string>
     */
    public const STATUSES = ['scheduled', 'live', 'finished'];

    /**
     * Mecze terminarza strony publicznej (`/fixtures`): jeszcze nierozegrane,
     * także trwający — ten stoi w terminarzu, aż organizator go zakończy.
     *
     * @var list<string>
     */
    public const FIXTURE_STATUSES = ['scheduled', 'live'];

    /**
     * Mecze wyników strony publicznej (`/results`): wyłącznie zakończone.
     *
     * @var list<string>
     */
    public const RESULT_STATUSES = ['finished'];

    protected function casts(): array
    {
        return ['kickoff_at' => 'datetime'];
    }

    public function round(): BelongsTo
    {
        return $this->belongsTo(Round::class);
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function homeTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'home_team_id');
    }

    public function awayTeam(): BelongsTo
    {
        return $this->belongsTo(Team::class, 'away_team_id');
    }

    public function venue(): BelongsTo
    {
        return $this->belongsTo(Venue::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(MatchEvent::class, 'match_id');
    }

    /** Mecz, do którego wchodzi zwycięzca (tylko w drabince). */
    public function winnerTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'winner_to_match_id');
    }

    /** Mecz, do którego wchodzi przegrany (mecz o 3. miejsce). */
    public function loserTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'loser_to_match_id');
    }

    public function isFinished(): bool
    {
        return $this->status === 'finished';
    }

    /**
     * Strona zwycięzcy meczu zakończonego: z wyniku, a przy remisie z karnych
     * (#216). `null`, dopóki mecz nie jest zakończony albo nie ma
     * rozstrzygnięcia. Panel liczy to samo (`bracketWinnerSide` w DS).
     *
     * @return 'home'|'away'|null
     */
    public function winnerSide(): ?string
    {
        if (! $this->isFinished() || $this->home_score === null || $this->away_score === null) {
            return null;
        }

        if ($this->home_score !== $this->away_score) {
            return $this->home_score > $this->away_score ? 'home' : 'away';
        }

        if ($this->home_penalties === null || $this->away_penalties === null || $this->home_penalties === $this->away_penalties) {
            return null;
        }

        return $this->home_penalties > $this->away_penalties ? 'home' : 'away';
    }

    /** Drużyna zwycięzcy albo przegranego meczu zakończonego, jeśli już jest. */
    public function teamIdOf(string $role): ?int
    {
        $winner = $this->winnerSide();

        if ($winner === null) {
            return null;
        }

        $side = $role === 'winner' ? $winner : ($winner === 'home' ? 'away' : 'home');

        return $this->{"{$side}_team_id"};
    }

    /**
     * Etykieta pozycji meczu drabinki, której nie przechowujemy (`CONTEXT.md`,
     * „Match”): „Półfinał 1”, „Finał”, „Mecz o 3. miejsce”. Panel liczy ją tak
     * samo (`matchLabel` w `apps/admin/src/lib/bracket.ts`).
     */
    public function positionLabel(): string
    {
        if (self::query()->where('loser_to_match_id', $this->id)->exists()) {
            return 'Mecz o 3. miejsce';
        }

        $round = $this->round->name;

        return $round === 'Finał' ? $round : "{$round} {$this->match_number}";
    }
}
