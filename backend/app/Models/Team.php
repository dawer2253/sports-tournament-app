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
