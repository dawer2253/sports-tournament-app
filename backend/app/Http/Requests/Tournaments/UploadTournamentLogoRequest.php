<?php

namespace App\Http\Requests\Tournaments;

use App\Http\Requests\LogoUploadRequest;

class UploadTournamentLogoRequest extends LogoUploadRequest
{
    protected function nounForms(): array
    {
        return ['subject' => 'Logo', 'instrumental' => 'logo', 'genitive' => 'logo'];
    }
}
