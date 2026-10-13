<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Faza istnieje zawsze, także w zwykłej lidze (ADR-0002). Organizer prowadzący
 * ligę nigdy nie zobaczy słowa „faza" w interfejsie.
 */
#[Fillable(['tournament_id', 'type', 'name', 'order'])]
class Stage extends Model
{
    use HasFactory;

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class);
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(Round::class);
    }

    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }

    /**
     * Czy faza ma mecz rozpoczęty (`live` albo `finished`). Wtedy jej
     * terminarza ani drabinki nie wolno już wygenerować ponownie (#157, #215),
     * a drużyny z drabinki nie wolno usunąć.
     */
    public function hasStartedMatches(): bool
    {
        return $this->matches()->whereIn('status', GameMatch::STARTED_STATUSES)->exists();
    }
}
