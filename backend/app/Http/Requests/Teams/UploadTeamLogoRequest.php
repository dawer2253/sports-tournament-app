<?php

namespace App\Http\Requests\Teams;

use App\Http\Requests\LogoUploadRequest;

class UploadTeamLogoRequest extends LogoUploadRequest
{
    protected function nounForms(): array
    {
        return ['subject' => 'Herb', 'instrumental' => 'herbem', 'genitive' => 'herbu'];
    }
}
