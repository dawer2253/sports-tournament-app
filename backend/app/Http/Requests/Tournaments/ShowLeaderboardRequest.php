<?php

namespace App\Http\Requests\Tournaments;

use App\Http\Requests\Public\ShowLeaderboardRequest as PublicShowLeaderboardRequest;
use App\Models\Tournament;

/**
 * Parametr `stat` klasyfikacji panelu (#333): reguła, komunikat i statystyka
 * domyślna są te same co na stronie publicznej, tylko turniej przychodzi
 * z wiązania trasy, już po `can('manage')`, więc cudzy turniej dostaje `403`
 * przed `422`, a szkic jest dozwolony.
 */
class ShowLeaderboardRequest extends PublicShowLeaderboardRequest
{
    public function tournament(): Tournament
    {
        return $this->route('tournament')->loadMissing('sport');
    }
}
