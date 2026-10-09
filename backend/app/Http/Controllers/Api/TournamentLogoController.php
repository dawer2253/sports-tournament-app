<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tournaments\UploadTournamentLogoRequest;
use App\Http\Resources\TournamentResource;
use App\Models\Tournament;

/** Kolejność kroków i sprzątanie plików żyje w `HasLogo`. */
class TournamentLogoController extends Controller
{
    public function store(UploadTournamentLogoRequest $request, Tournament $tournament): TournamentResource
    {
        $tournament->replaceLogo($request->file('logo'));

        return new TournamentResource($tournament->load('sport')->loadCount('teams'));
    }

    public function destroy(Tournament $tournament): TournamentResource
    {
        $tournament->removeLogo();

        return new TournamentResource($tournament->load('sport')->loadCount('teams'));
    }
}
