<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ShowLeaderboardRequest;
use App\Http\Requests\Public\ShowStageMatchesRequest;
use App\Http\Resources\MatchResource;
use App\Http\Resources\PublicMatchDetailResource;
use App\Http\Resources\PublicMatchResource;
use App\Http\Resources\PublicTournamentResource;
use App\Http\Resources\StandingTableResource;
use App\Http\Resources\StatLeaderboardResource;
use App\Leaderboards\MatchScorers;
use App\Leaderboards\StatLeaderboard;
use App\Matches\MatchPeriods;
use App\Matches\MatchRelation;
use App\Models\GameMatch;
use App\Models\Team;
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
     * Komplet meczów jednej fazy w każdym stanie, także bez obu drużyn (#234):
     * widok drabinki buduje z niego odwrotny indeks krawędzi (ADR-0004).
     * Kształt `Match`, a nie `PublicMatch`, bo drabinka nie pokazuje
     * strzelców. Mecze idą przez relację turnieju, więc faza innego turnieju
     * daje puste `data`, a nie cudze mecze. Kolejność jak w terminarzu:
     * rosnąco po terminie, mecz bez terminu na końcu.
     */
    public function stageMatches(ShowStageMatchesRequest $request): JsonResponse
    {
        $matches = $this->matchesByKickoff($request->tournament(), 'asc')
            ->where('matches.stage_id', $request->stageId())
            ->get();

        return response()->json([
            'data' => $matches->map(fn (GameMatch $match): array => (new MatchResource($match))->resolve())->all(),
        ]);
    }

    /**
     * Strona meczu (#210). Mecz szuka się przez relację turnieju, więc mecz
     * innego turnieju i nieistniejący dają to samo `404` co szkic i nieznany
     * slug. `$match` jest gołym napisem, nie modelem z wiązania trasy: wiązanie
     * znalazłoby mecz dowolnego turnieju.
     */
    public function match(string $slug, string $match): JsonResponse
    {
        $tournament = Tournament::findPublishedBySlug($slug);

        $game = $tournament->matches()
            ->with(['round', 'homeTeam', 'awayTeam', 'venue', ...MatchRelation::eagerLoad()])
            ->whereKey($match)
            ->firstOrFail();

        return response()->json([
            'data' => (new PublicMatchDetailResource($game, $tournament->sport, MatchPeriods::of($tournament)))->resolve(),
        ]);
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
     * Drużyny turnieju (#296) w kształcie `TeamSummary`, rosnąco po `id`:
     * prezentacja drużyn na Przeglądzie przed terminarzem. Relacja turnieju
     * pomija drużyny usunięte miękko i drużyny innych turniejów, a drużyna
     * bez grupy wchodzi jak każda. `TeamResource` się tu nie nadaje, bo
     * wymaga liczników panelu.
     */
    public function teams(string $slug): JsonResponse
    {
        $teams = Tournament::findPublishedBySlug($slug)->teams()->orderBy('id')->get();

        return response()->json([
            'data' => $teams->map(fn (Team $team): array => ['id' => $team->id, 'name' => $team->name, 'logoUrl' => $team->logoUrl()])->all(),
        ]);
    }

    /**
     * Mecze turnieju w stanach `$statuses`, po terminie w kierunku `$direction`
     * (`matchesByKickoff`). Strzelców całej listy wczytuje jedno zapytanie
     * o zdarzenia (#208).
     *
     * @param  list<string>  $statuses
     * @param  'asc'|'desc'  $direction
     */
    private function matchList(string $slug, array $statuses, string $direction): JsonResponse
    {
        $tournament = Tournament::findPublishedBySlug($slug);
        $sport = $tournament->sport;

        $matches = $this->matchesByKickoff($tournament, $direction)
            ->with(MatchScorers::eagerLoad($sport))
            ->whereIn('matches.status', $statuses)
            ->get();

        return response()->json([
            'data' => $matches->map(fn (GameMatch $match): array => (new PublicMatchResource($match, $sport))->resolve())->all(),
        ]);
    }

    /**
     * Mecze turnieju przez jego relację (przez fazy), więc mecz innego turnieju
     * nie ma jak tu trafić. Kolejność to kolejność list strony publicznej: po
     * terminie w kierunku `$direction`, mecz bez terminu zawsze na końcu,
     * a remis terminu rozstrzyga kolejność fazy, kolejki i numeru meczu,
     * w tym samym kierunku. `rounds` dochodzi złączeniem tylko do sortowania.
     *
     * @param  'asc'|'desc'  $direction
     */
    private function matchesByKickoff(Tournament $tournament, string $direction): HasManyThrough
    {
        return $tournament->matches()
            ->join('rounds', 'rounds.id', '=', 'matches.round_id')
            ->with(['round', 'homeTeam', 'awayTeam', 'venue'])
            ->orderByRaw('matches.kickoff_at IS NULL')
            ->orderBy('matches.kickoff_at', $direction)
            ->orderBy('stages.order', $direction)
            ->orderBy('rounds.order', $direction)
            ->orderBy('matches.match_number', $direction)
            ->orderBy('matches.id', $direction);
    }
}
