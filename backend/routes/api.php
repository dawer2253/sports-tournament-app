<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\PlayerController;
use App\Http\Controllers\Api\SportController;
use App\Http\Controllers\Api\StageController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\TeamLogoController;
use App\Http\Controllers\Api\TournamentController;
use App\Http\Controllers\Api\TournamentLogoController;
use App\Http\Controllers\Api\VenueController;
use Illuminate\Support\Facades\Route;

// Prefiks `api/v1` dokłada `withRouting(apiPrefix: ...)` w bootstrap/app.php,
// więc ścieżki są tu takie jak klucze w kontrakcie.

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/sports', [SportController::class, 'index']);
    Route::get('/tournaments', [TournamentController::class, 'index']);
    Route::post('/tournaments', [TournamentController::class, 'store']);

    // Trasy poddrzewa turnieju autoryzuje middleware `can`, nie kontroler —
    // patrz „Autoryzacja poddrzewa turnieju" w `backend/AGENTS.md`.
    Route::get('/tournaments/{tournament}', [TournamentController::class, 'show'])
        ->can('manage', 'tournament');
    Route::patch('/tournaments/{tournament}', [TournamentController::class, 'update'])
        ->can('manage', 'tournament');
    Route::delete('/tournaments/{tournament}', [TournamentController::class, 'destroy'])
        ->can('manage', 'tournament');
    Route::post('/tournaments/{tournament}/logo', [TournamentLogoController::class, 'store'])
        ->can('manage', 'tournament');
    Route::delete('/tournaments/{tournament}/logo', [TournamentLogoController::class, 'destroy'])
        ->can('manage', 'tournament');
    Route::get('/tournaments/{tournament}/stages', [StageController::class, 'index'])
        ->can('manage', 'tournament');

    Route::get('/tournaments/{tournament}/teams', [TeamController::class, 'index'])
        ->can('manage', 'tournament');
    Route::post('/tournaments/{tournament}/teams', [TeamController::class, 'store'])
        ->can('manage', 'tournament');
    Route::get('/teams/{team}', [TeamController::class, 'show'])
        ->can('manage', 'team');
    Route::patch('/teams/{team}', [TeamController::class, 'update'])
        ->can('manage', 'team');
    Route::delete('/teams/{team}', [TeamController::class, 'destroy'])
        ->can('manage', 'team');

    Route::post('/teams/{team}/logo', [TeamLogoController::class, 'store'])
        ->can('manage', 'team');
    Route::delete('/teams/{team}/logo', [TeamLogoController::class, 'destroy'])
        ->can('manage', 'team');

    Route::get('/teams/{team}/players', [PlayerController::class, 'index'])
        ->can('manage', 'team');
    Route::post('/teams/{team}/players', [PlayerController::class, 'store'])
        ->can('manage', 'team');
    Route::patch('/players/{player}', [PlayerController::class, 'update'])
        ->can('manage', 'player');
    Route::delete('/players/{player}', [PlayerController::class, 'destroy'])
        ->can('manage', 'player');

    Route::get('/tournaments/{tournament}/venues', [VenueController::class, 'index'])
        ->can('manage', 'tournament');
    Route::post('/tournaments/{tournament}/venues', [VenueController::class, 'store'])
        ->can('manage', 'tournament');
    Route::patch('/venues/{venue}', [VenueController::class, 'update'])
        ->can('manage', 'venue');
    Route::delete('/venues/{venue}', [VenueController::class, 'destroy'])
        ->can('manage', 'venue');
});
