<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default Spec Source
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default spec source that should be used
    | by the framework.
    |
    */

    'default' => env('SPEC_SOURCE', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Sources
    |--------------------------------------------------------------------------
    |
    | Here you may configure as many sources as you wish, and you
    | may even configure multiple source of the same type. Defaults have
    | been setup for each driver as an example of the required options.
    |
    */

    'sources' => [
        'local' => [
            'source' => 'local',
            // Kontrakt żyje w monorepo, poza katalogiem backendu. Backend go nie
            // definiuje, tylko dowodzi, że go spełnia (patrz ADR 0001).
            'base_path' => env('SPEC_PATH', base_path('../packages/api-contract')),
        ],

        'remote' => [
            'source' => 'remote',
            'base_path' => env('SPEC_PATH'),
            'params' => env('SPEC_URL_PARAMS', ''),
        ],

        'github' => [
            'source' => 'github',
            'base_path' => env('SPEC_GITHUB_PATH'),
            'repo' => env('SPEC_GITHUB_REPO'),
            'token' => env('SPEC_GITHUB_TOKEN'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Paths
    |--------------------------------------------------------------------------
    |
    | Configure path defaults, like prefixes.
    |
    */

    // Ścieżki w kontrakcie są bez prefiksu wersji (`/login`), bo prefiks siedzi
    // w `servers[].url`. Spectator `servers` nie czyta w ogóle: porównuje URI
    // trasy Laravela, czyli już `api/v1/login`, z kluczami `paths` doklejonymi
    // do tego prefiksu. Bez tej wartości każda asercja kończy się
    // `Path [POST /api/v1/login] not found in spec`.
    // Szczegóły: docs/research/sanctum-spectator-prefiks-api.md
    'path_prefix' => env('SPECTATOR_PATH_PREFIX', 'api/v1'),

    /*
    |--------------------------------------------------------------------------
    | Error Format
    |--------------------------------------------------------------------------
    |
    | Controls the format of schema validation error messages in test output.
    | Use 'text' (default) for human-readable coloured terminal output, or
    | 'json' for machine-readable output suited to CI log parsers and LLMs.
    |
    | You can also call Spectator::useJsonErrors() / useTextErrors() per-test.
    |
    */

    'error_format' => env('SPECTATOR_ERROR_FORMAT', 'text'),

    /*
    |--------------------------------------------------------------------------
    |
    | Specify the groups that spectator's middleware should be prepended to.
    |
    */

    'middleware_groups' => ['api'],
];
