<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teams\StoreTeamRequest;
use App\Http\Requests\Teams\UpdateTeamRequest;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class TeamController extends Controller
{
    /**
     * Przez relację turnieju, jak każda lista poddrzewa (`backend/AGENTS.md`).
     * Kolejność po `name` stanowi kontrakt, a bez względu na wielkość liter
     * porównuje collation kolumny. Remis rozstrzyga `id`.
     */
    public function index(Tournament $tournament): AnonymousResourceCollection
    {
        return TeamResource::collection(
            $tournament->teams()
                ->withCount('players')
                ->orderBy('name')
                ->orderBy('id')
                ->get()
        );
    }

    public function store(StoreTeamRequest $request, Tournament $tournament): JsonResponse
    {
        $team = $tournament->teams()->create(['name' => $request->validated('name')]);

        return (new TeamResource($team->loadCount('players')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Team $team): TeamResource
    {
        return new TeamResource($team->loadCount('players'));
    }

    public function update(UpdateTeamRequest $request, Team $team): TeamResource
    {
        $team->update($request->validated());

        return new TeamResource($team->loadCount('players'));
    }

    /**
     * Guard z rozegranym meczem daje 422 (`FinishedMatchGuardException`),
     * a kaskadę na zawodników robi model.
     */
    public function destroy(Team $team): Response
    {
        $team->delete();

        return response()->noContent();
    }
}
