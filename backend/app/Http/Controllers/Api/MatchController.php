<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Matches\IndexMatchesRequest;
use App\Http\Resources\MatchResource;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class MatchController extends Controller
{
    private const DEFAULT_PER_PAGE = 50;

    private const MAX_PER_PAGE = 200;

    /**
     * Lista idzie przez relację turnieju (przez jego fazy), więc faza albo
     * kolejka innego turnieju w filtrze daje pustą listę, a nie cudze mecze.
     *
     * Kolejność stanowi kontrakt: faza, kolejka, `match_number`. `id` na końcu
     * trzyma ją stabilną między stronami. Numery mogą mieć dziury (#161),
     * więc sortujemy po nich, a nie liczymy z nich pozycji.
     *
     * Filtry idą przed `paginate()`, żeby `meta` opisywała zbiór zawężony.
     * Warunek to `!== null`, a nie prawdziwość: `?stageId=0` ma zawęzić listę
     * do niczego, a nie zdjąć filtr.
     */
    public function index(IndexMatchesRequest $request, Tournament $tournament): JsonResponse
    {
        $perPage = $request->integer('perPage');
        $perPage = $perPage < 1 ? self::DEFAULT_PER_PAGE : min($perPage, self::MAX_PER_PAGE);

        $matches = $tournament->matches()
            ->join('rounds', 'rounds.id', '=', 'matches.round_id')
            ->with(['round', 'homeTeam', 'awayTeam', 'venue'])
            ->when($request->stageId() !== null, fn (Builder $query): Builder => $query->where('matches.stage_id', $request->stageId()))
            ->when($request->roundId() !== null, fn (Builder $query): Builder => $query->where('matches.round_id', $request->roundId()))
            ->when($request->status() !== null, fn (Builder $query): Builder => $query->where('matches.status', $request->status()))
            ->orderBy('stages.order')
            ->orderBy('rounds.order')
            ->orderBy('matches.match_number')
            ->orderBy('matches.id')
            ->paginate($perPage);

        return response()->json([
            'data' => MatchResource::collection($matches->items()),
            'meta' => [
                'currentPage' => $matches->currentPage(),
                'lastPage' => $matches->lastPage(),
                'perPage' => $matches->perPage(),
                'total' => $matches->total(),
            ],
        ]);
    }
}
