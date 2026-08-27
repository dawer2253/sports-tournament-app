<?php

use Illuminate\Support\Facades\Route;

// Backend oddaje wyłącznie JSON — front to apps/admin i apps/public, poza
// Dockerem. Szkielet Laravela stawiał tu widok Blade z `@vite`, który bez
// zbudowanego manifestu Vite wywala 500; warstwa Vite została usunięta.
// Zostaje health check: dowód, że kontener wstał i aplikacja się bootuje.
Route::get('/', function () {
    return response()->json(['status' => 'ok']);
});
