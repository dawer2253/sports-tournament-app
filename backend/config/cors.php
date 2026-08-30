<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    // `sanctum/csrf-cookie` nie dotyczy tego projektu: Sanctum pracuje w trybie
    // tokenowym (Bearer), a nie na ciasteczkach SPA.
    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    // Panel i strona publiczna chodzą natywnie na node, poza Dockerem, więc dla
    // przeglądarki to inny origin niż `localhost:8000`. Porty za AGENTS.md.
    'allowed_origins' => [
        'http://localhost:5173',
        'http://localhost:5174',
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
