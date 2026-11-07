<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tournaments\ShowLeaderboardRequest;
use App\Http\Resources\StatLeaderboardResource;
use App\Leaderboards\StatLeaderboard;
use App\Models\Tournament;
use Illuminate\Http\JsonResponse;

class LeaderboardController extends Controller
{
    /**
     * Klasyfikacja panelu (#333): ta sama co na stronie publicznej, ale po id
     * i we wszystkich statusach turnieju, także `draft`, bez walidatora HTTP.
     *
     * `$tournament` stoi w sygnaturze nie dla ciała, tylko dla wiązania
     * modelu: bez niego parametr trasy zostaje napisem, a `can('manage')`
     * odmawia każdemu.
     */
    public function show(ShowLeaderboardRequest $request, Tournament $tournament): JsonResponse
    {
        return response()->json([
            'data' => new StatLeaderboardResource(StatLeaderboard::of($request->tournament(), $request->stat())),
        ]);
    }
}
