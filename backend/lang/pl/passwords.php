<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Komunikaty resetu hasła
    |--------------------------------------------------------------------------
    |
    | Reset hasła nie jest jeszcze zaimplementowany — broker haseł nie ma dziś
    | żadnego konsumenta. Plik zostaje z tego samego powodu, co `password`
    | i `throttle` w `auth.php`; uzasadnienie stoi tam i nie powtarzamy go
    | w trzecim miejscu.
    |
    | Granica tej zasady biegnie po tym, czy tekst może kiedyś wyjść do
    | organizera. Broker haseł oddaje swoje komunikaty w JSON-ie, więc może.
    | Frameworkowego `pagination.php` celowo tu nie ma: jego klucze czytają
    | wyłącznie blade'owe widoki paginacji
    | (`Illuminate/Pagination/resources/views/`), a ten backend nie ma warstwy
    | widoków (`AGENTS.md`, „Backend oddaje wyłącznie JSON").
    |
    | `token` mówi o linku, nie o tokenie, bo tak widzi to organizer. Ten sam
    | komunikat broker zwraca dla tokenu wygasłego i dla podrobionego, stąd
    | „stracił ważność" obok „nieprawidłowy".
    |
    */

    'reset' => 'Hasło zostało zmienione.',
    'sent' => 'Link do zmiany hasła został wysłany na podany adres e-mail.',
    'throttled' => 'Odczekaj chwilę przed kolejną próbą.',
    'token' => 'Ten link do zmiany hasła jest nieprawidłowy lub stracił ważność.',
    'user' => 'Nie znaleziono użytkownika o tym adresie e-mail.',

];
