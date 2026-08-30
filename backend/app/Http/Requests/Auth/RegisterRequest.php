<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            // Reguła `confirmed` szuka pola `password_confirmation`, a kontrakt
            // ma pola w camelCase, stąd `same` na jawnie nazwanym polu.
            'password' => ['required', 'string', Password::min(8), 'same:passwordConfirmation'],
            'passwordConfirmation' => ['required', 'string'],
        ];
    }
}
