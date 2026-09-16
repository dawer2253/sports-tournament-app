<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Komunikaty uwierzytelniania
    |--------------------------------------------------------------------------
    |
    | Tekst spod `auth.failed` trafia wprost na ekran logowania w panelu:
    | `AuthController::login()` wiesza go na polu `email`, a Laravel kopiuje
    | pierwszy komunikat walidacji do korzenia odpowiedzi (`message`), który
    | panel pokazuje pod formularzem.
    |
    */

    'failed' => 'Nieprawidłowy e-mail lub hasło.',
    'password' => 'Podane hasło jest nieprawidłowe.',
    'throttle' => 'Za dużo prób logowania. Spróbuj ponownie za :seconds s.',

];
