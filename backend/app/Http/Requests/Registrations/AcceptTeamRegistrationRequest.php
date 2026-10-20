<?php

namespace App\Http\Requests\Registrations;

use App\Http\Requests\Teams\StoreTeamRequest;
use App\Http\Requests\Teams\TeamRequest;
use App\Models\TeamRegistration;
use App\Models\Tournament;
use Illuminate\Validation\Validator;

/**
 * Przyjęcie zgłoszenia (#300) to dodanie drużyny przez organizatora, tylko
 * z nazwą ze zgłoszenia zamiast z ciała: te same reguły nazwy
 * (`TeamRequest`) i stanu turnieju (`StoreTeamRequest::admissionChecks()`),
 * te same klucze błędów. Nie dotyczą go zapisy — organizer przyjmuje także
 * po ich zamknięciu.
 */
class AcceptTeamRegistrationRequest extends TeamRequest
{
    use DecidesPendingRegistration;

    /**
     * Ciało żądania jest puste; walidujemy nazwę ze zgłoszenia.
     *
     * @return array<string, mixed>
     */
    public function validationData(): array
    {
        return ['name' => $this->registration()->team_name];
    }

    /**
     * Zgłoszenie rozpatrzone ma jeden błąd, pod `registration`, a nie do
     * tego jeszcze nazwę zajętą przez drużynę, która z niego powstała.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        if (! $this->registration()->isPending()) {
            return [];
        }

        return [
            'name' => ['required', ...$this->nameRules()],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        if (! $this->registration()->isPending()) {
            return [$this->checkPending(...)];
        }

        return StoreTeamRequest::admissionChecks($this->tournament());
    }

    /**
     * Te same reguły jeszcze raz, już pod blokadą turnieju
     * (`TeamRegistrationController::accept()`). Pierwsza walidacja idzie przed
     * transakcją, więc dwa równoległe przyjęcia — to samo zgłoszenie z dwóch
     * kart albo dwa zgłoszenia o tej samej nazwie — przeszłyby ją oba.
     * Walidator jest zapamiętany po pierwszym razie, więc trzeba go zbudować
     * od nowa na świeżym stanie bazy.
     */
    public function validateAgain(): void
    {
        $this->validator = null;
        $this->validateResolved();
    }

    protected function tournament(): Tournament
    {
        return $this->registration()->tournament;
    }

    private function registration(): TeamRegistration
    {
        return $this->route('registration');
    }
}
