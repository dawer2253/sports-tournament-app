<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdatePasswordRequest extends FormRequest
{
    /**
     * `current_password:sanctum` porównuje z hasłem zalogowanego organizera.
     * Bez nazwy strażnika reguła sięgnęłaby po domyślny `web`, który przy
     * tokenie Bearer nikogo nie zna. Powtórzone hasło sprawdza `same`, nie
     * `confirmed` — powód przy `RegisterRequest`.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'currentPassword' => ['required', 'string', 'current_password:sanctum'],
            'password' => ['required', 'string', Password::min(8), 'same:passwordConfirmation'],
            'passwordConfirmation' => ['required', 'string'],
        ];
    }
}
