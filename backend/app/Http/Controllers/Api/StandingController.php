<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tournaments\ShowStandingsRequest;
use App\Http\Resources\StandingTableResource;
use App\Models\Tournament;
use App\Standings\TournamentStandings;
use Illuminate\Http\JsonResponse;

class StandingController extends Controller
{
    /**
     * Tabele panelu. Parametr `tiebreakers` to podgląd: tabele i ich
     * `tiebreakers` idą według podanej listy, a turniej zostaje nietknięty.
     */
    public function index(ShowStandingsRequest $request, Tournament $tournament): JsonResponse
    {
        return response()->json([
            'data' => StandingTableResource::collection(TournamentStandings::of($tournament, $request->tiebreakers())),
        ]);
    }
}
