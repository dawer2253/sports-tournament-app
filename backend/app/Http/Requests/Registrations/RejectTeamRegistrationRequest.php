<?php

namespace App\Http\Requests\Registrations;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RejectTeamRegistrationRequest extends FormRequest
{
    use DecidesPendingRegistration;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [$this->checkPending(...)];
    }
}
