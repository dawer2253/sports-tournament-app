<?php

namespace App\Models;

use App\Models\Concerns\GuardsFinishedMatches;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Osoba przypisana do drużyny. Istnieje po to, żeby przypisywać jej zdarzenia
 * meczowe i budować z nich statystyki indywidualne.
 */
#[Fillable(['team_id', 'name', 'number', 'position'])]
class Player extends Model
{
    use GuardsFinishedMatches;
    use HasFactory;
    use SoftDeletes;

    /**
     * Zawodnik z trasy musi mieć żywą drużynę, inaczej to 404 (#79, pkt 5).
     * Bez tego `PlayerPolicy` dostałaby `null` z `$player->team`, bo
     * `SoftDeletes` ukrywa usuniętą drużynę także w relacji, i oddała 500.
     * `whereHas` stosuje zakres `SoftDeletes` drużyny.
     *
     * @param  mixed  $value
     * @param  string|null  $field
     */
    public function resolveRouteBinding($value, $field = null): ?self
    {
        return $this->resolveRouteBindingQuery($this, $value, $field)
            ->whereHas('team')
            ->first();
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(MatchEvent::class);
    }

    /**
     * Zawodnik jest powiązany z rozegranym meczem przez swoje zdarzenia:
     * usunięcie go wyczyściłoby wiersz z klasyfikacji strzelców.
     */
    public function hasFinishedMatches(): bool
    {
        return $this->events()
            ->whereHas('match', fn ($query) => $query->where('status', 'finished'))
            ->exists();
    }

    protected function guardLabel(): string
    {
        return "zawodnik „{$this->name}”";
    }
}
