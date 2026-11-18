<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Teams\UploadTeamLogoRequest;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Kolejność kroków i sprzątanie plików żyje w `HasLogo`. */
class TeamLogoController extends Controller
{
    /** Plik herbu do grafiki turnieju (#333); `404` bez pliku. */
    public function show(Team $team): StreamedResponse
    {
        return $team->logoResponse();
    }

    public function store(UploadTeamLogoRequest $request, Team $team): TeamResource
    {
        $team->replaceLogo($request->file('logo'));

        return $this->resource($team);
    }

    public function destroy(Team $team): TeamResource
    {
        $team->removeLogo();

        return $this->resource($team);
    }

    /** Resource wymaga dociągniętych relacji i liczników (docblock TeamResource). */
    private function resource(Team $team): TeamResource
    {
        return new TeamResource($team->loadCount(Team::resourceCounts()));
    }
}
