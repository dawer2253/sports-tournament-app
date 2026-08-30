<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Podzbiór drużyn w fazie `group`, grających wyłącznie ze sobą i mających
 * własną tabelę. Mecz należy do dokładnie jednej grupy albo do żadnej —
 * mecz międzygrupowy nie istnieje.
 *
 * Tabela nazywa się `groups`, co koliduje ze słowem zarezerwowanym MySQL 8.
 * Eloquent cytuje identyfikatory sam; uważaj w surowym SQL-u.
 */
#[Fillable(['stage_id', 'tournament_id', 'name'])]
class Group extends Model
{
    use HasFactory;

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }
}
