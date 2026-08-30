<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pojedynczy fakt odnotowany w meczu: bramka, kartka, faul. Źródło statystyk
 * indywidualnych, nie źródło wyniku meczu — wynik wpisuje się osobno.
 *
 * Dopuszczalne `type` to kody z `Sport.config.eventTypes` turnieju. Kolumna jest
 * tekstowa właśnie po to, żeby dodanie sportu pozostało seedem (decyzja #10).
 */
#[Fillable(['match_id', 'team_id', 'player_id', 'type', 'minute', 'meta'])]
class MatchEvent extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return ['meta' => 'array'];
    }

    public function match(): BelongsTo
    {
        return $this->belongsTo(GameMatch::class, 'match_id');
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }
}
