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

        return $this->resource($tournament);
    }

    public function destroy(Tournament $tournament): TournamentResource
    {
        $tournament->removeLogo();

        return $this->resource($tournament);
    }

    /** Resource wymaga dociągniętych relacji i liczników (docblock TournamentResource). */
    private function resource(Tournament $tournament): TournamentResource
    {
        return new TournamentResource($tournament->load('sport')->loadCount('teams'));
    }
}
