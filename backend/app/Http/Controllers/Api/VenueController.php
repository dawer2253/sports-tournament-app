<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Venues\StoreVenueRequest;
use App\Http\Requests\Venues\UpdateVenueRequest;
use App\Http\Resources\VenueResource;
use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class VenueController extends Controller
{
    /**
     * Przez relację turnieju, jak każda lista poddrzewa (`backend/AGENTS.md`).
     * Kolejność po `name` stanowi kontrakt, a bez względu na wielkość liter
     * porównuje collation kolumny. Remis rozstrzyga `id`.
     */
    public function index(Tournament $tournament): AnonymousResourceCollection
    {
        return VenueResource::collection(
            $tournament->venues()->orderBy('name')->orderBy('id')->get()
        );
    }

    public function store(StoreVenueRequest $request, Tournament $tournament): JsonResponse
    {
        $venue = $tournament->venues()->create($request->validated());

        return (new VenueResource($venue))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(UpdateVenueRequest $request, Venue $venue): VenueResource
    {
        $venue->update($request->validated());

        return new VenueResource($venue);
    }

    /** Guard z rozegranym meczem daje 422 (`FinishedMatchGuardException`). */
    public function destroy(Venue $venue): Response
    {
        $venue->delete();

        return response()->noContent();
    }
}
