<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Players\StorePlayerRequest;
use App\Http\Requests\Players\UpdatePlayerRequest;
use App\Http\Resources\PlayerResource;
use App\Models\Player;
use App\Models\Team;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PlayerController extends Controller
{
    /**
     * Przez relację drużyny, jak każda lista poddrzewa (`backend/AGENTS.md`).
     * Kolejność stanowi kontrakt: po `number`, zawodnicy bez numeru na końcu
     * (MySQL stawia `NULL` na początku rosnącego porządku, stąd osobny klucz),
     * potem po `name` i po `id`.
     */
    public function index(Team $team): AnonymousResourceCollection
    {
        return PlayerResource::collection(
            $team->players()
                ->orderByRaw('`number` IS NULL')
                ->orderBy('number')
                ->orderBy('name')
                ->orderBy('id')
                ->get()
        );
    }

    public function store(StorePlayerRequest $request, Team $team): JsonResponse
    {
        $player = $team->players()->create($request->validated());

        return (new PlayerResource($player))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function update(UpdatePlayerRequest $request, Player $player): PlayerResource
    {
        $player->update($request->validated());

        return new PlayerResource($player);
    }

    /** Guard z rozegranym meczem daje 422 (`FinishedMatchGuardException`). */
    public function destroy(Player $player): Response
    {
        $player->delete();

        return response()->noContent();
    }
}
