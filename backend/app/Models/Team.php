<?php

namespace App\Models;

use App\Models\Concerns\GuardsFinishedMatches;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * Uczestnik turnieju. Dwie drużyny o tej samej nazwie w dwóch turniejach to
 * dwa niepowiązane byty (decyzja #8).
 */
#[Fillable(['tournament_id', 'group_id', 'name', 'logo_url'])]
class Team extends Model
{
    use GuardsFinishedMatches;
    use HasFactory;
    use SoftDeletes;

    /**
     * Najwięcej żywych zawodników w drużynie (decyzja #80, opis `POST
     * /teams/{team}/players` w kontrakcie). Zmienia się razem z kontraktem.
     */
    public const MAX_PLAYERS = 50;

    /**
     * Kaskada: zawodnik nie istnieje bez drużyny (`CONTEXT.md`), więc
     * miękkie usunięcie drużyny usuwa miękko jej zawodników. Siedzi w modelu
     * z tego samego powodu co guard — nie ominie jej ani seeder, ani przyszły
     * kod (`GuardsFinishedMatches`).
     *
     * Zdarzenie `deleted`, nie `deleting`: guard odpala w `deleting`, więc
     * odrzucone usunięcie nie dochodzi tu wcale i zawodnicy zostają
     * nietknięci, bez zależności od kolejności rejestrowania nasłuchów.
     *
     * Każdy zawodnik idzie przez własny `delete()`, więc i przez swój guard.
     * Guard drużyny go nie zastępuje: baza nie wiąże zawodnika zdarzenia
     * z drużyną meczu, więc zawodnik może mieć rozegrany mecz, którego jego
     * drużyna nie ma. Usunięcie twarde załatwia `cascadeOnDelete` w bazie.
     */
    protected static function booted(): void
    {
        static::deleted(function (self $team): void {
            if (! $team->isForceDeleting()) {
                $team->players()->get()->each->delete();
            }
        });
    }

    /**
     * Drużyna i jej zawodnicy znikają razem albo wcale: odmowa guarda
     * zawodnika w kaskadzie cofa też usunięcie drużyny.
     */
    public function delete(): ?bool
    {
        return DB::transaction(fn (): ?bool => parent::delete());
    }

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function players(): HasMany
    {
        return $this->hasMany(Player::class);
    }

    public function homeMatches(): HasMany
    {
        return $this->hasMany(GameMatch::class, 'home_team_id');
    }

    public function awayMatches(): HasMany
    {
        return $this->hasMany(GameMatch::class, 'away_team_id');
    }

    /**
     * Mecze drużyny po obu stronach — gospodarz i gość to ta sama drużyna
     * widziana z dwóch stron terminarza. Świadomie **nie** jest relacją:
     * Eloquent nie umie zrobić `HasMany` po dwóch kluczach naraz, a metoda
     * nazwana `matches()` i zwracająca Buildera wywalałaby się w `with()`
     * i `withCount()`. Do eager loadingu są `homeMatches` i `awayMatches`.
     */
    public function matchesQuery(): Builder
    {
        return GameMatch::query()
            ->where(fn ($query) => $query
                ->where('home_team_id', $this->getKey())
                ->orWhere('away_team_id', $this->getKey()));
    }

    /**
     * Czy grupa, do której przypisujemy drużynę, należy do tego samego turnieju.
     *
     * Bazy o to nie prosimy — dlaczego, tłumaczy migracja `teams`. Wywołaj to
     * z Form Requesta przed zapisem `group_id`.
     */
    public function groupBelongsToSameTournament(?Group $group): bool
    {
        return $group === null || $group->tournament_id === $this->tournament_id;
    }

    public function hasFinishedMatches(): bool
    {
        return $this->matchesQuery()->where('status', 'finished')->exists();
    }

    protected function guardLabel(): string
    {
        return "drużyna „{$this->name}”";
    }
}
