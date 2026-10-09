<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Wspólne reguły logo turnieju i herbu drużyny — limity zapadły raz, w #88,
 * i zmieniają się razem z opisem obu ścieżek `/logo` w kontrakcie.
 *
 * Samo `mimes`, bez reguły `image`: `image` przepuszcza też avif, heic i heif
 * (research `docs/research/upload-obrazow-laravel.md` §3.1). `mimes` patrzy
 * na treść pliku, nie na nazwę. `bail` zostawia pod `logo` jeden komunikat,
 * bo plik, który nie jest obrazem, nie ma też wymiarów.
 *
 * Komunikaty dają podklasy, bo różnią się odmianą rzeczownika („logo",
 * „herbem", „herbu").
 */
abstract class LogoUploadRequest extends FormRequest
{
    public const MIMES = ['png', 'jpg', 'jpeg', 'webp'];

    public const MAX_KILOBYTES = 2048;

    public const MIN_DIMENSION = 64;

    public const MAX_DIMENSION = 4096;

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'logo' => [
                'bail',
                'required',
                'file',
                'mimes:'.implode(',', self::MIMES),
                'max:'.self::MAX_KILOBYTES,
                'dimensions:'.implode(',', [
                    'min_width='.self::MIN_DIMENSION,
                    'min_height='.self::MIN_DIMENSION,
                    'max_width='.self::MAX_DIMENSION,
                    'max_height='.self::MAX_DIMENSION,
                ]),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        $messages = $this->logoMessages();

        return [
            'logo.required' => $messages['required'],
            'logo.file' => $messages['format'],
            'logo.mimes' => $messages['format'],
            'logo.max' => $messages['max'],
            'logo.dimensions' => $messages['dimensions'],
            'logo.uploaded' => $messages['uploaded'],
        ];
    }

    /**
     * @return array{required: string, format: string, max: string, dimensions: string, uploaded: string}
     */
    abstract protected function logoMessages(): array;
}
