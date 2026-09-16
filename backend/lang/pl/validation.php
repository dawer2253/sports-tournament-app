<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Komunikaty walidacji
    |--------------------------------------------------------------------------
    |
    | Pełny zestaw kluczy z `vendor/laravel/framework/.../lang/en/validation.php`,
    | przetłumaczony w całości, a nie tylko dla reguł używanych dziś. Tłumaczenie
    | wybiórcze znaczyłoby, że pierwsza nowa reguła w dowolnym Form Requeście
    | po cichu wraca do angielskiego — a to dokładnie ten błąd, który ten plik
    | naprawia (`fallback_locale` to nadal `en`).
    |
    | Przy aktualizacji Laravela warto porównać listę kluczy z plikiem
    | frameworka: nowe reguły przychodzą tam bez tłumaczenia.
    |
    */

    'accepted' => 'Pole :attribute musi zostać zaakceptowane.',
    'accepted_if' => 'Pole :attribute musi zostać zaakceptowane, gdy :other ma wartość :value.',
    'active_url' => 'Pole :attribute musi być poprawnym adresem URL.',
    'after' => 'Pole :attribute musi być datą późniejszą niż :date.',
    'after_or_equal' => 'Pole :attribute musi być datą nie wcześniejszą niż :date.',
    'alpha' => 'Pole :attribute może zawierać wyłącznie litery.',
    'alpha_dash' => 'Pole :attribute może zawierać wyłącznie litery, cyfry, myślniki i podkreślenia.',
    'alpha_num' => 'Pole :attribute może zawierać wyłącznie litery i cyfry.',
    'any_of' => 'Pole :attribute jest nieprawidłowe.',
    'array' => 'Pole :attribute musi być tablicą.',
    'array_keys' => 'Pole :attribute może zawierać wyłącznie klucze: :values.',
    'ascii' => 'Pole :attribute może zawierać wyłącznie jednobajtowe znaki alfanumeryczne i symbole.',
    'base64' => 'Pole :attribute musi być poprawnym ciągiem Base64.',
    'before' => 'Pole :attribute musi być datą wcześniejszą niż :date.',
    'before_or_equal' => 'Pole :attribute musi być datą nie późniejszą niż :date.',
    'between' => [
        'array' => 'Pole :attribute musi mieć od :min do :max elementów.',
        'file' => 'Pole :attribute musi mieć od :min do :max kilobajtów.',
        'numeric' => 'Pole :attribute musi mieścić się w przedziale od :min do :max.',
        'string' => 'Pole :attribute musi mieć od :min do :max znaków.',
    ],
    'boolean' => 'Pole :attribute musi mieć wartość prawda albo fałsz.',
    'can' => 'Pole :attribute zawiera niedozwoloną wartość.',
    'confirmed' => 'Potwierdzenie pola :attribute nie zgadza się.',
    'contains' => 'W polu :attribute brakuje wymaganej wartości.',
    'current_password' => 'Podane hasło jest nieprawidłowe.',
    'date' => 'Pole :attribute musi być poprawną datą.',
    'date_equals' => 'Pole :attribute musi być datą równą :date.',
    'date_format' => 'Pole :attribute musi być zgodne z formatem :format.',
    'decimal' => 'Pole :attribute musi mieć :decimal miejsc po przecinku.',
    'declined' => 'Pole :attribute musi zostać odrzucone.',
    'declined_if' => 'Pole :attribute musi zostać odrzucone, gdy :other ma wartość :value.',
    'different' => 'Pola :attribute i :other muszą się różnić.',
    'digits' => 'Pole :attribute musi mieć :digits cyfr.',
    'digits_between' => 'Pole :attribute musi mieć od :min do :max cyfr.',
    'dimensions' => 'Pole :attribute ma nieprawidłowe wymiary obrazu.',
    'distinct' => 'Pole :attribute ma powtórzoną wartość.',
    'doesnt_contain' => 'Pole :attribute nie może zawierać żadnej z wartości: :values.',
    'doesnt_end_with' => 'Pole :attribute nie może kończyć się żadną z wartości: :values.',
    'doesnt_start_with' => 'Pole :attribute nie może zaczynać się żadną z wartości: :values.',
    'email' => 'Pole :attribute musi być poprawnym adresem e-mail.',
    'encoding' => 'Pole :attribute musi być zakodowane w :encoding.',
    'ends_with' => 'Pole :attribute musi kończyć się jedną z wartości: :values.',
    'enum' => 'Wybrana wartość pola :attribute jest nieprawidłowa.',
    'exists' => 'Wybrana wartość pola :attribute jest nieprawidłowa.',
    'extensions' => 'Pole :attribute musi mieć jedno z rozszerzeń: :values.',
    'file' => 'Pole :attribute musi być plikiem.',
    'filled' => 'Pole :attribute musi mieć wartość.',
    'gt' => [
        'array' => 'Pole :attribute musi mieć więcej niż :value elementów.',
        'file' => 'Pole :attribute musi być większe niż :value kilobajtów.',
        'numeric' => 'Pole :attribute musi być większe niż :value.',
        'string' => 'Pole :attribute musi mieć więcej niż :value znaków.',
    ],
    'gte' => [
        'array' => 'Pole :attribute musi mieć co najmniej :value elementów.',
        'file' => 'Pole :attribute musi być nie mniejsze niż :value kilobajtów.',
        'numeric' => 'Pole :attribute musi być nie mniejsze niż :value.',
        'string' => 'Pole :attribute musi mieć co najmniej :value znaków.',
    ],
    'hex_color' => 'Pole :attribute musi być poprawnym kolorem szesnastkowym.',
    'image' => 'Pole :attribute musi być obrazem.',
    'in' => 'Wybrana wartość pola :attribute jest nieprawidłowa.',
    'in_array' => 'Pole :attribute musi występować w :other.',
    'in_array_keys' => 'Pole :attribute musi zawierać co najmniej jeden z kluczy: :values.',
    'integer' => 'Pole :attribute musi być liczbą całkowitą.',
    'ip' => 'Pole :attribute musi być poprawnym adresem IP.',
    'ipv4' => 'Pole :attribute musi być poprawnym adresem IPv4.',
    'ipv6' => 'Pole :attribute musi być poprawnym adresem IPv6.',
    'json' => 'Pole :attribute musi być poprawnym ciągiem JSON.',
    'list' => 'Pole :attribute musi być listą.',
    'lowercase' => 'Pole :attribute musi być zapisane małymi literami.',
    'lt' => [
        'array' => 'Pole :attribute musi mieć mniej niż :value elementów.',
        'file' => 'Pole :attribute musi być mniejsze niż :value kilobajtów.',
        'numeric' => 'Pole :attribute musi być mniejsze niż :value.',
        'string' => 'Pole :attribute musi mieć mniej niż :value znaków.',
    ],
    'lte' => [
        'array' => 'Pole :attribute nie może mieć więcej niż :value elementów.',
        'file' => 'Pole :attribute musi być nie większe niż :value kilobajtów.',
        'numeric' => 'Pole :attribute musi być nie większe niż :value.',
        'string' => 'Pole :attribute nie może mieć więcej niż :value znaków.',
    ],
    'mac_address' => 'Pole :attribute musi być poprawnym adresem MAC.',
    'max' => [
        'array' => 'Pole :attribute nie może mieć więcej niż :max elementów.',
        'file' => 'Pole :attribute nie może być większe niż :max kilobajtów.',
        'numeric' => 'Pole :attribute nie może być większe niż :max.',
        'string' => 'Pole :attribute nie może mieć więcej niż :max znaków.',
    ],
    'max_digits' => 'Pole :attribute nie może mieć więcej niż :max cyfr.',
    'mimes' => 'Pole :attribute musi być plikiem typu: :values.',
    'mimetypes' => 'Pole :attribute musi być plikiem typu: :values.',
    'min' => [
        'array' => 'Pole :attribute musi mieć co najmniej :min elementów.',
        'file' => 'Pole :attribute musi mieć co najmniej :min kilobajtów.',
        'numeric' => 'Pole :attribute musi być nie mniejsze niż :min.',
        'string' => 'Pole :attribute musi mieć co najmniej :min znaków.',
    ],
    'min_digits' => 'Pole :attribute musi mieć co najmniej :min cyfr.',
    'missing' => 'Pole :attribute nie może występować.',
    'missing_if' => 'Pole :attribute nie może występować, gdy :other ma wartość :value.',
    'missing_unless' => 'Pole :attribute nie może występować, chyba że :other ma wartość :value.',
    'missing_with' => 'Pole :attribute nie może występować, gdy podano :values.',
    'missing_with_all' => 'Pole :attribute nie może występować, gdy podano :values.',
    'multiple_of' => 'Pole :attribute musi być wielokrotnością :value.',
    'not_in' => 'Wybrana wartość pola :attribute jest nieprawidłowa.',
    'not_regex' => 'Format pola :attribute jest nieprawidłowy.',
    'numeric' => 'Pole :attribute musi być liczbą.',
    'password' => [
        'letters' => 'Pole :attribute musi zawierać co najmniej jedną literę.',
        'mixed' => 'Pole :attribute musi zawierać co najmniej jedną wielką i jedną małą literę.',
        'numbers' => 'Pole :attribute musi zawierać co najmniej jedną cyfrę.',
        'symbols' => 'Pole :attribute musi zawierać co najmniej jeden znak specjalny.',
        'uncompromised' => 'Podane :attribute wystąpiło w wycieku danych. Wybierz inne.',
    ],
    'present' => 'Pole :attribute musi występować.',
    'present_if' => 'Pole :attribute musi występować, gdy :other ma wartość :value.',
    'present_unless' => 'Pole :attribute musi występować, chyba że :other ma wartość :value.',
    'present_with' => 'Pole :attribute musi występować, gdy podano :values.',
    'present_with_all' => 'Pole :attribute musi występować, gdy podano :values.',
    'prohibited' => 'Pole :attribute jest niedozwolone.',
    'prohibited_if' => 'Pole :attribute jest niedozwolone, gdy :other ma wartość :value.',
    'prohibited_if_accepted' => 'Pole :attribute jest niedozwolone, gdy :other zostało zaakceptowane.',
    'prohibited_if_declined' => 'Pole :attribute jest niedozwolone, gdy :other zostało odrzucone.',
    'prohibited_unless' => 'Pole :attribute jest niedozwolone, chyba że :other ma jedną z wartości: :values.',
    'prohibits' => 'Pole :attribute wyklucza obecność pola :other.',
    'regex' => 'Format pola :attribute jest nieprawidłowy.',
    'required' => 'Pole :attribute jest wymagane.',
    'required_array_keys' => 'Pole :attribute musi zawierać wpisy dla: :values.',
    'required_if' => 'Pole :attribute jest wymagane, gdy :other ma wartość :value.',
    'required_if_accepted' => 'Pole :attribute jest wymagane, gdy :other zostało zaakceptowane.',
    'required_if_declined' => 'Pole :attribute jest wymagane, gdy :other zostało odrzucone.',
    'required_unless' => 'Pole :attribute jest wymagane, chyba że :other ma jedną z wartości: :values.',
    'required_with' => 'Pole :attribute jest wymagane, gdy podano :values.',
    'required_with_all' => 'Pole :attribute jest wymagane, gdy podano :values.',
    'required_without' => 'Pole :attribute jest wymagane, gdy nie podano :values.',
    'required_without_all' => 'Pole :attribute jest wymagane, gdy nie podano żadnego z: :values.',
    'same' => 'Pole :attribute musi być takie samo jak :other.',
    'size' => [
        'array' => 'Pole :attribute musi mieć :size elementów.',
        'file' => 'Pole :attribute musi mieć :size kilobajtów.',
        'numeric' => 'Pole :attribute musi być równe :size.',
        'string' => 'Pole :attribute musi mieć :size znaków.',
    ],
    'starts_with' => 'Pole :attribute musi zaczynać się jedną z wartości: :values.',
    'string' => 'Pole :attribute musi być ciągiem znaków.',
    'timezone' => 'Pole :attribute musi być poprawną strefą czasową.',
    'unique' => 'Podane :attribute jest już zajęte.',
    'uploaded' => 'Nie udało się wgrać pola :attribute.',
    'uppercase' => 'Pole :attribute musi być zapisane wielkimi literami.',
    'url' => 'Pole :attribute musi być poprawnym adresem URL.',
    'ulid' => 'Pole :attribute musi być poprawnym identyfikatorem ULID.',
    'uuid' => 'Pole :attribute musi być poprawnym identyfikatorem UUID.',

    /*
    |--------------------------------------------------------------------------
    | Komunikaty dla konkretnych pól
    |--------------------------------------------------------------------------
    */

    'custom' => [
        'attribute-name' => [
            'rule-name' => 'custom-message',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Nazwy pól
    |--------------------------------------------------------------------------
    |
    | Podmieniają `:attribute` na nazwę czytelną dla organizera. Klucze są takie
    | jak pola w kontrakcie, czyli w camelCase — Laravel podmienia na spacje samo
    | podkreślenie, więc `passwordConfirmation` bez wpisu poniżej trafiłby do
    | komunikatu w tej postaci.
    |
    */

    'attributes' => [
        'email' => 'e-mail',
        'name' => 'nazwa',
        'password' => 'hasło',
        'passwordConfirmation' => 'powtórzone hasło',
    ],

];
