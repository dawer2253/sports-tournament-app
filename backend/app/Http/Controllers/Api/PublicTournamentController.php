<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchResource;
use App\Http\Resources\StageResource;
use App\Http\Resources\StandingTableResource;
use App\Models\GameMatch;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Http\JsonResponse;

/**
 * Strona publiczna turnieju, bez autoryzacji. Turniej idzie po slugu przez
 * `Tournament::findPublishedBySlug()`, więc szkic i nieznany slug dają to
 * samo `404` na każdej trasie. Walidator HTTP dokłada grupa tras
 * (`AddHttpValidators`), nie kontroler.
 */
class PublicTournamentController extends Controller
{
    public function show(string $slug): JsonResponse
    {
        $tournament = Tournament::findPublishedBySlug($slug)->load(['sport', 'stages.groups']);

        return response()->json([
            'data' => [
                'name' => $tournament->name,
                'slug' => $tournament->slug,
                'status' => $tournament->status,
                'sport' => [
                    'id' => $tournament->sport->id,
                    'code' => $tournament->sport->code,
                    'name' => $tournament->sport->name,
                ],
                'branding' => [
                    'logoUrl' => $tournament->logoUrl(),
                    'primaryColor' => $tournament->primary_color,
                ],
                'stages' => StageResource::collection($tournament->stages->sortBy('order')->values()),
            ],
        ]);
    }

    public function standings(string $slug): JsonResponse
    {
        return response()->json([
            'data' => StandingTableResource::forTournament(Tournament::findPublishedBySlug($slug)),
        ]);
    }

    /**
     * Mecze `scheduled` i `live`, rosnąco po terminie; mecz bez terminu na
     * końcu. Remis terminu rozstrzyga kolejność fazy, kolejki i numeru meczu —
     * tak opisuje to kontrakt.
     */
    public function fixtures(string $slug): JsonResponse
    {
        $matches = $this->matches(Tournament::findPublishedBySlug($slug))
            ->whereIn('matches.status', ['scheduled', 'live'])
            ->orderByRaw('matches.kickoff_at IS NULL')
            ->orderBy('matches.kickoff_at')
            ->orderBy('stages.order')
            ->orderBy('rounds.order')
            ->orderBy('matches.match_number')
            ->orderBy('matches.id')
            ->get();

        return $this->matchList($matches->all());
    }

    /**
     * Mecze `finished`, malejąco po terminie; mecz bez terminu na końcu.
     * Remis terminu rozstrzyga kolejność fazy, kolejki i numeru meczu,
     * malejąco jak termin.
     */
    public function results(string $slug): JsonResponse
    {
        $matches = $this->matches(Tournament::findPublishedBySlug($slug))
            ->where('matches.status', 'finished')
            ->orderByRaw('matches.kickoff_at IS NULL')
            ->orderByDesc('matches.kickoff_at')
            ->orderByDesc('stages.order')
            ->orderByDesc('rounds.order')
            ->orderByDesc('matches.match_number')
            ->orderByDesc('matches.id')
            ->get();

        return $this->matchList($matches->all());
    }

    /**
     * Mecze turnieju przez jego relację (przez fazy), więc mecz innego turnieju
     * nie ma jak tu trafić. `rounds` dochodzi złączeniem tylko do sortowania.
     */
    private function matches(Tournament $tournament): HasManyThrough
    {
        return $tournament->matches()
            ->join('rounds', 'rounds.id', '=', 'matches.round_id')
            ->with(['round', 'homeTeam', 'awayTeam', 'venue']);
    }

    /**
     * @param  list<GameMatch>  $matches
     */
    private function matchList(array $matches): JsonResponse
    {
        return response()->json([
            'data' => array_map(fn (GameMatch $match): array => (new MatchResource($match))->resolve(), $matches),
        ]);
    }
}
