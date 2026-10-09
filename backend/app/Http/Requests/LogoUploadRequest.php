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
 * Podklasy dają tylko odmianę rzeczownika w komunikatach („logo", „herbem",
 * „herbu").
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
     * Teksty z #111, pkt 5. Liczby idą ze stałych, żeby zmiana limitu była
     * jedną edycją; odmianę rzeczownika dają podklasy.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        ['subject' => $subject, 'instrumental' => $instrumental, 'genitive' => $genitive] = $this->nounForms();
        $megabytes = self::MAX_KILOBYTES / 1024;
        $min = self::MIN_DIMENSION.'×'.self::MIN_DIMENSION;
        $max = self::MAX_DIMENSION.'×'.self::MAX_DIMENSION;
        $format = "{$subject} musi być plikiem PNG, JPG albo WebP.";

        return [
            'logo.required' => "Wybierz plik z {$instrumental}.",
            'logo.file' => $format,
            'logo.mimes' => $format,
            'logo.max' => "{$subject} może mieć najwyżej {$megabytes} MB.",
            'logo.dimensions' => "{$subject} musi mieć od {$min} do {$max} pikseli.",
            'logo.uploaded' => "Nie udało się wgrać {$genitive}. Sprawdź, czy plik ma najwyżej {$megabytes} MB.",
        ];
    }

    /**
     * Rzeczownik w trzech przypadkach: „Logo musi…", „plik z logo",
     * „wgrać logo".
     *
     * @return array{subject: string, instrumental: string, genitive: string}
     */
    abstract protected function nounForms(): array;
}
