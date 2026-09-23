<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tournaments\StoreTournamentRequest;
use App\Http\Resources\TournamentResource;
use App\Models\Sport;
use App\Models\Tournament;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TournamentController extends Controller
{
    private const DEFAULT_PER_PAGE = 20;

    private const MAX_PER_PAGE = 100;

    /**
     * Kolejność od najnowszego, remisy po `id` — tak stanowi opis endpointu
     * w kontrakcie. Bez drugiego klucza turnieje z tej samej sekundy mogłyby
     * się dublować albo ginąć na granicy stron.
     *
     * `perPage` ponad limit jest dociągane do niego, a nieczytelne (tekst,
     * zero, liczba ujemna) daje rozmiar domyślny — kontrakt nie przewiduje tu
     * odpowiedzi 422.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->integer('perPage');
        $perPage = $perPage < 1 ? self::DEFAULT_PER_PAGE : min($perPage, self::MAX_PER_PAGE);

        $tournaments = Tournament::whereBelongsTo($request->user())
            ->with('sport')
            ->withCount('teams')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => TournamentResource::collection($tournaments->items()),
            'meta' => [
                'currentPage' => $tournaments->currentPage(),
                'lastPage' => $tournaments->lastPage(),
                'perPage' => $tournaments->perPage(),
                'total' => $tournaments->total(),
            ],
        ]);
    }

    public function store(StoreTournamentRequest $request): JsonResponse
    {
        $tournament = Tournament::createForOrganizer(
            owner: $request->user(),
            sport: Sport::findOrFail($request->validated('sportId')),
            name: $request->validated('name'),
            format: $request->validated('format'),
        );

        return (new TournamentResource($tournament->load('sport')->loadCount('teams')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
