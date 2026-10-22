<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
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
#[Fillable(['match_id', 'team_id', 'player_id', 'type', 'minute', 'added_time', 'meta'])]
class MatchEvent extends Model
{
    use HasFactory;

    /**
     * Zdarzenia ma tylko mecz rozpoczęty (#188, reguła 8). Ten sam komunikat
     * daje zapis, poprawka i usunięcie zdarzenia meczu `scheduled`.
     */
    public const NOT_STARTED_MESSAGE = 'Zdarzenia wpisuje się w meczu trwającym albo zakończonym.';

    protected function casts(): array
    {
        return [
            'minute' => 'integer',
            'added_time' => 'integer',
            'meta' => 'array',
        ];
    }

    /**
     * Kolejność osi meczu ze stanu kontraktu (#188, reguła 10): minuta
     * rosnąco, zdarzenia bez minuty na końcu (MySQL stawia `NULL` na
     * początku rosnącego porządku, stąd osobny klucz), potem doliczony czas
     * (zdarzenie bez niego stoi przed „45+1”, bo `NULL` jest pierwszy), potem
     * `id`. Tę samą kolejność mają panel i strona meczu.
     */
    #[Scope]
    protected function inTimelineOrder(Builder $query): void
    {
        $query->orderByRaw('`minute` IS NULL')->orderBy('minute')->orderBy('added_time')->orderBy('id');
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
