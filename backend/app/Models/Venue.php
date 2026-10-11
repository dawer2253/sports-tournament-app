<?php

namespace App\Models;

use App\Models\Concerns\GuardsPlayedMatches;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * Miejsce rozegrania meczu. Należy do turnieju.
 */
#[Fillable(['tournament_id', 'name', 'address'])]
class Venue extends Model
{
    use GuardsPlayedMatches;
    use HasFactory;
    use SoftDeletes;

    /**
     * Miękkie usunięcie obiektu odpina go od meczów `scheduled` (#171): mecz
     * zostaje w terminarzu z tym samym terminem, tylko bez obiektu — tak jak
     * przy usunięciu twardym, które załatwia `nullOnDelete` w bazie. Mecze
     * `live` i `finished` nie wchodzą w grę, bo przy nich guard odmawia
     * wcześniej. Siedzi w modelu z tego samego powodu co kaskada w `Team`.
     */
    protected static function booted(): void
    {
        static::deleted(function (self $venue): void {
            if (! $venue->isForceDeleting()) {
                $venue->matches()->where('status', 'scheduled')->update(['venue_id' => null]);
            }
        });
    }

    /** Obiekt i odpięcie go od meczów idą razem albo wcale. */
    public function delete(): ?bool
    {
        return DB::transaction(fn (): ?bool => parent::delete());
    }

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function matches(): HasMany
    {
        return $this->hasMany(GameMatch::class);
    }

    /**
     * Liczniki, których wymaga `VenueResource` — jedna lista dla wszystkich
     * odpowiedzi z obiektem, jak `Team::resourceCounts()`.
     *
     * @return array<int|string, mixed>
     */
    public static function resourceCounts(): array
    {
        return [
            'matches as scheduled_matches_count' => fn (Builder $query) => $query->where('status', 'scheduled'),
        ];
    }

    public function hasPlayedMatches(): bool
    {
        return $this->matches()->whereIn('status', GameMatch::PLAYED_STATUSES)->exists();
    }

    protected function guardLabel(): string
    {
        return "obiekt „{$this->name}”";
    }
}
