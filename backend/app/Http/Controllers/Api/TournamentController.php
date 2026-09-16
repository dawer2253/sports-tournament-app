<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tournaments\IndexTournamentRequest;
use App\Http\Resources\TournamentResource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class TournamentController extends Controller
{
    /** Turnieje zalogowanego organizera, stronicowane. */
    public function index(IndexTournamentRequest $request): JsonResponse
    {
        $tournaments = $request->user()->tournaments()
            ->with('sport')
            ->withCount('teams')
            // `whereIn` przed `paginate()` — sedno ADR 0008.
            ->when(
                $request->validated('status'),
                fn (Builder $query, array $statuses): Builder => $query->whereIn('status', $statuses),
            )
            // Kolejność obiecana w kontrakcie. `id` łamie remis, bo turnieje
            // założone w tej samej sekundzie mają równe `created_at`, a bez
            // deterministycznego porządku strony mogłyby się powtarzać.
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($request->validated('perPage', 20));

        // Koperta jawnie, bo stronicowany `ResourceCollection` dokłada `links`
        // i `meta` w snake_case (patrz `backend/AGENTS.md`).
        return response()->json([
            'data' => TournamentResource::collection($tournaments->items())->resolve($request),
            'meta' => [
                'currentPage' => $tournaments->currentPage(),
                'lastPage' => $tournaments->lastPage(),
                'perPage' => $tournaments->perPage(),
                'total' => $tournaments->total(),
            ],
        ]);
    }
}
