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
 * Miejsce rozegrania meczu. Należy do turnieju.
 */
#[Fillable(['tournament_id', 'name', 'address'])]
class Venue extends Model
{
    use GuardsFinishedMatches;
    use HasFactory;
    use SoftDeletes;

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }

    public function hasFinishedMatches(): bool
    {
        return $this->matches()->where('status', 'finished')->exists();
    }

    protected function guardLabel(): string
    {
        return "obiekt „{$this->name}”";
    }
}
