<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Komunikaty uwierzytelniania
    |--------------------------------------------------------------------------
    |
    | Tekst spod `auth.failed` trafia wprost na ekran logowania w panelu:
    | `App\Http\Controllers\Api\AuthController::login()` wiesza go na polu
    | `email`, a Laravel kopiuje pierwszy komunikat walidacji do korzenia
    | odpowiedzi (`message`), który panel pokazuje pod formularzem.
    |
    | `password` i `throttle` nie mają dziś konsumenta (nie ma resetu hasła ani
    | limitu prób logowania) i zostają z tego samego powodu, dla którego
    | `validation.php` jest przetłumaczony w całości: plik niepełny znaczy, że
    | pierwsze użycie brakującego klucza po cichu wraca do angielskiego.
    |
    */

    'failed' => 'Nieprawidłowy e-mail lub hasło.',
    'password' => 'Podane hasło jest nieprawidłowe.',
    'throttle' => 'Za dużo prób logowania. Spróbuj ponownie za :seconds s.',

];
