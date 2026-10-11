<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tournaments\ShowStandingsRequest;
use App\Http\Resources\StandingTableResource;
use App\Models\Stage;
use App\Models\Tournament;
use App\Standings\StandingsCalculator;
use Illuminate\Http\JsonResponse;

class StandingController extends Controller
{
    /**
     * Tabele liczone przy odczycie, po jednej na fazę `league`, w kolejności
     * faz. Faza `knockout` nie ma tabeli, a tabele grup dołoży faza grupowa
     * (S5), wołając kalkulator osobno dla każdej grupy.
     *
     * Parametr `tiebreakers` podmienia listę kryteriów tylko na czas tego
     * odczytu, więc turniej zostaje nietknięty. W fazie `league` grają
     * wszystkie żywe drużyny turnieju; usuniętych miękko relacja nie zwraca.
     */
    public function index(ShowStandingsRequest $request, Tournament $tournament): JsonResponse
    {
        $calculator = new StandingsCalculator(
            $tournament->points,
            $request->tiebreakers() ?? $tournament->tiebreakers,
        );
        $scoreLabel = $tournament->sport->scoreLabel();
        $teams = $tournament->teams()->get();

        $tables = $tournament->stages()
            ->where('type', 'league')
            ->with('matches')
            ->orderBy('order')
            ->get()
            ->map(fn (Stage $stage): StandingTableResource => new StandingTableResource(
                $stage,
                $scoreLabel,
                $calculator->calculate($teams, $stage->matches),
            ));

        return response()->json(['data' => $tables]);
    }
}
