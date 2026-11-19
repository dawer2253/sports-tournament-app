<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAccountRequest extends FormRequest
{
    /**
     * Oba pola można pominąć, ale wysłane muszą być niepuste — stąd
     * `required` za `sometimes`. Reguły jak w `RegisterRequest`, a unikalność
     * adresu pomija własne konto, więc niezmieniony e-mail przechodzi.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'email' => [
                'sometimes', 'required', 'string', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($this->user()),
            ],
        ];
    }
}
