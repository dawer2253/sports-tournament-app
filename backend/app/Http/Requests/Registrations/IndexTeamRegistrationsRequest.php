<?php

namespace App\Http\Requests\Registrations;

use App\Http\Requests\Concerns\FiltersByStatusList;
use App\Models\TeamRegistration;
use Illuminate\Foundation\Http\FormRequest;

class IndexTeamRegistrationsRequest extends FormRequest
{
    use FiltersByStatusList;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => $this->statusRules(TeamRegistration::STATUSES, 'stan zgłoszenia', 'pending,accepted'),
        ];
    }
}
