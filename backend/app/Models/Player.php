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
