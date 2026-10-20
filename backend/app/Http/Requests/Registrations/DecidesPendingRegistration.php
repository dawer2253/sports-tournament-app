<?php

namespace App\Http\Requests\Registrations;

use App\Models\TeamRegistration;
use Illuminate\Validation\Validator;

/**
 * O zgłoszeniu rozstrzyga się raz: przyjęcie i odrzucenie działają tylko na
 * oczekującym, a na rozpatrzonym dają `422` pod `registration` (kontrakt).
 */
trait DecidesPendingRegistration
{
    private function checkPending(Validator $validator): void
    {
        /** @var TeamRegistration $registration */
        $registration = $this->route('registration');

        if (! $registration->isPending()) {
            $validator->errors()->add('registration', TeamRegistration::ALREADY_DECIDED_MESSAGE);
        }
    }
}
