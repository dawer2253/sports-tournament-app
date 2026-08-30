<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Uporządkowany zbiór meczów rozgrywanych jako jedna całość. W UI „kolejka"
 * w fazie `league` i `group`, „runda" w fazie `knockout` — w kodzie i w API
 * jeden byt.
 */
#[Fillable(['stage_id', 'name', 'order'])]
class Round extends Model
{
    use HasFactory;

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }
}
