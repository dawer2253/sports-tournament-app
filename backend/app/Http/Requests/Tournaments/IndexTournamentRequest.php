<?php

namespace App\Http\Requests\Tournaments;

use App\Http\Requests\Concerns\FiltersByStatusList;
use App\Models\Tournament;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Waliduje wyłącznie `status`. `page` i `perPage` zostają poza tym Form
 * Requestem: kontrakt nie przewiduje dla nich `422`, więc kontroler dociąga je
 * do granic, zamiast odrzucać żądanie.
 */
class IndexTournamentRequest extends FormRequest
{
    use FiltersByStatusList;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => $this->statusRules(Tournament::STATUSES, 'stan turnieju', 'draft,active'),
        ];
    }
}
