<?php

namespace App\Models;

use App\Models\Concerns\GuardsFinishedMatches;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

/**
 * Jedyny korzeń własności w systemie (decyzja #5): każdy inny byt należy do
 * organizera pośrednio, przez turniej.
 *
 * Bez soft-delete: turniej albo nie ma rozegranych meczów i kasuje się na twardo
 * razem z poddrzewem, albo je ma i guard nie pozwala go usunąć wcale.
 */
#[Fillable([
    'user_id', 'sport_id', 'slug', 'name',
    'logo_url', 'primary_color', 'points', 'tiebreakers', 'status',
])]
class Tournament extends Model
{
    use GuardsFinishedMatches;
    use HasFactory;

    protected function casts(): array
    {
        return [
            'points' => 'array',
            'tiebreakers' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sport(): BelongsTo
    {
        return $this->belongsTo(Sport::class);
    }

    public function stages(): HasMany
    {
        return $this->hasMany(Stage::class);
    }

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class);
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    public function venues(): HasMany
    {
        return $this->hasMany(Venue::class);
    }

    public function matches(): HasManyThrough
    {
        return $this->hasManyThrough(GameMatch::class, Stage::class);
    }

    public function hasFinishedMatches(): bool
    {
        return $this->matches()->where('matches.status', 'finished')->exists();
    }

    protected function guardLabel(): string
    {
        return "turniej „{$this->name}”";
    }
}
