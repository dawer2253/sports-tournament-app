<?php

namespace App\Rules;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

/**
 * Unikalność wartości wśród żywego rodzeństwa — bytów tego samego rodzica
 * (nazwa drużyny w turnieju, numer zawodnika w drużynie, nazwa obiektu
 * w turnieju). Byt usunięty miękko nie blokuje wartości.
 *
 * Fabryka, a nie własne `ValidationRule`: zwraca zwykłe `Rule::unique`, więc
 * błąd idzie pod `<pole>.unique` i komunikat z `messages()` requestu działa
 * bez zmian. Unikalności nie pilnuje indeks, więc obowiązuje to samo
 * zastrzeżenie o wyścigu co przy limicie dzieci (`ChildLimit`).
 */
final class UniqueAmongLiveSiblings
{
    /**
     * @param  Model|null  $ignored  model, którego własna wartość nie koliduje
     *                               sama ze sobą: `null` przy `POST`, edytowany
     *                               byt przy `PATCH`
     */
    public static function rule(string $table, string $column, string $parentColumn, Model $parent, ?Model $ignored = null): Unique
    {
        return Rule::unique($table, $column)
            ->where($parentColumn, $parent->getKey())
            ->whereNull('deleted_at')
            ->ignore($ignored);
    }
}
