<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ShowLeaderboardRequest;
use App\Http\Resources\PublicMatchResource;
use App\Http\Resources\PublicTournamentResource;
use App\Http\Resources\StandingTableResource;
use App\Http\Resources\StatLeaderboardResource;
use App\Leaderboards\MatchScorers;
use App\Leaderboards\StatLeaderboard;
use App\Models\GameMatch;
use App\Models\Tournament;
use App\Standings\TournamentStandings;
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

        return response()->json(['data' => new PublicTournamentResource($tournament)]);
    }

    public function standings(string $slug): JsonResponse
    {
        return response()->json([
            'data' => StandingTableResource::collection(TournamentStandings::of(Tournament::findPublishedBySlug($slug))),
        ]);
    }

    /**
     * Mecze `scheduled` i `live`, rosnąco po terminie; mecz bez terminu na
     * końcu — tak opisuje to kontrakt.
     */
    public function fixtures(string $slug): JsonResponse
    {
        return $this->matchList($slug, GameMatch::FIXTURE_STATUSES, 'asc');
    }

    /**
     * Mecze `finished`, malejąco po terminie; mecz bez terminu na końcu.
     */
    public function results(string $slug): JsonResponse
    {
        return $this->matchList($slug, GameMatch::RESULT_STATUSES, 'desc');
    }

    /**
     * Klasyfikacja według `?stat=`, domyślnie pierwszej statystyki sportu.
     * Turniej wczytuje i sprawdza żądanie.
     */
    public function leaderboard(ShowLeaderboardRequest $request): JsonResponse
    {
        return response()->json([
            'data' => new StatLeaderboardResource(StatLeaderboard::of($request->tournament(), $request->stat())),
        ]);
    }

    /**
     * Mecze turnieju w stanach `$statuses`, po terminie w kierunku `$direction`;
     * mecz bez terminu zawsze na końcu. Remis terminu rozstrzyga kolejność
     * fazy, kolejki i numeru meczu, w tym samym kierunku co termin. Strzelców
     * całej listy wczytuje jedno zapytanie o zdarzenia (#208).
     *
     * @param  list<string>  $statuses
     * @param  'asc'|'desc'  $direction
     */
    private function matchList(string $slug, array $statuses, string $direction): JsonResponse
    {
        $tournament = Tournament::findPublishedBySlug($slug);
        $sport = $tournament->sport;

        $matches = $this->matches($tournament)
            ->with(MatchScorers::eagerLoad($sport))
            ->whereIn('matches.status', $statuses)
            ->orderByRaw('matches.kickoff_at IS NULL')
            ->orderBy('matches.kickoff_at', $direction)
            ->orderBy('stages.order', $direction)
            ->orderBy('rounds.order', $direction)
            ->orderBy('matches.match_number', $direction)
            ->orderBy('matches.id', $direction)
            ->get();

        return response()->json([
            'data' => $matches->map(fn (GameMatch $match): array => (new PublicMatchResource($match, $sport))->resolve())->all(),
        ]);
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
}
