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
    /**
     * Te same reguły jeszcze raz, już pod blokadą turnieju
     * (`TeamRegistrationController::decide()`). Pierwsza walidacja idzie przed
     * transakcją, więc dwie równoległe decyzje — przyjęcie i odrzucenie tego
     * samego zgłoszenia albo przyjęcia dwóch zgłoszeń o tej samej nazwie —
     * przeszłyby ją obie. Walidator jest zapamiętany po pierwszym razie, więc
     * trzeba go zbudować od nowa na świeżym stanie bazy.
     */
    public function validateAgain(): void
    {
        $this->validator = null;
        $this->validateResolved();
    }

    private function checkPending(Validator $validator): void
    {
        /** @var TeamRegistration $registration */
        $registration = $this->route('registration');

        if (! $registration->isPending()) {
            $validator->errors()->add('registration', TeamRegistration::ALREADY_DECIDED_MESSAGE);
        }
    }
}
