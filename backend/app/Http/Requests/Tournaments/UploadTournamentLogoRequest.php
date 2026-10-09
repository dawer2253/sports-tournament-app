<?php

namespace App\Http\Requests\Tournaments;

use App\Http\Requests\LogoUploadRequest;

class UploadTournamentLogoRequest extends LogoUploadRequest
{
    protected function logoMessages(): array
    {
        return [
            'required' => 'Wybierz plik z logo.',
            'format' => 'Logo musi być plikiem PNG, JPG albo WebP.',
            'max' => 'Logo może mieć najwyżej 2 MB.',
            'dimensions' => 'Logo musi mieć od 64×64 do 4096×4096 pikseli.',
            'uploaded' => 'Nie udało się wgrać logo. Sprawdź, czy plik ma najwyżej 2 MB.',
        ];
    }
}
