<?php

namespace App\Http\Requests\Teams;

use App\Http\Requests\LogoUploadRequest;

class UploadTeamLogoRequest extends LogoUploadRequest
{
    protected function logoMessages(): array
    {
        return [
            'required' => 'Wybierz plik z herbem.',
            'format' => 'Herb musi być plikiem PNG, JPG albo WebP.',
            'max' => 'Herb może mieć najwyżej 2 MB.',
            'dimensions' => 'Herb musi mieć od 64×64 do 4096×4096 pikseli.',
            'uploaded' => 'Nie udało się wgrać herbu. Sprawdź, czy plik ma najwyżej 2 MB.',
        ];
    }
}
