<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Matches\IndexMatchesRequest;
use App\Http\Requests\Matches\UpdateMatchRequest;
use App\Http\Resources\AdminMatchResource;
use App\Matches\Advancement;
use App\Matches\LiveClock;
use App\Models\GameMatch;
use App\Models\Tournament;
use App\Rules\Iso8601WithOffset;
use App\Schedule\CollisionCalculator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class MatchController extends Controller
{
    private const DEFAULT_PER_PAGE = 50;

    private const MAX_PER_PAGE = 200;

    /**
     * Lista idzie przez relację turnieju (przez jego fazy), więc faza albo
     * kolejka innego turnieju w filtrze daje pustą listę, a nie cudze mecze.
     *
     * Kolejność stanowi kontrakt: faza, kolejka, `match_number`. `id` na końcu
     * trzyma ją stabilną między stronami. Numery mogą mieć dziury (#161),
     * więc sortujemy po nich, a nie liczymy z nich pozycji.
     *
     * Filtry idą przed `paginate()`, żeby `meta` opisywała zbiór zawężony.
     * Warunek to `!== null`, a nie prawdziwość: `?stageId=0` ma zawęzić listę
     * do niczego, a nie zdjąć filtr.
     *
     * Kolizje (#158) liczy jeden przebieg po całym turnieju — także poza
     * zwróconą stroną, bo kolizja łączy mecze z różnych faz.
     */
    public function index(IndexMatchesRequest $request, Tournament $tournament, CollisionCalculator $collisions): JsonResponse
    {
        $perPage = $request->integer('perPage');
        $perPage = $perPage < 1 ? self::DEFAULT_PER_PAGE : min($perPage, self::MAX_PER_PAGE);

        $matches = $tournament->matches()
            ->join('rounds', 'rounds.id', '=', 'matches.round_id')
            ->with(['round', 'homeTeam', 'awayTeam', 'venue'])
            ->when($request->stageId() !== null, fn (Builder $query): Builder => $query->where('matches.stage_id', $request->stageId()))
            ->when($request->roundId() !== null, fn (Builder $query): Builder => $query->where('matches.round_id', $request->roundId()))
            ->when($request->status() !== null, fn (Builder $query): Builder => $query->where('matches.status', $request->status()))
            ->orderBy('stages.order')
            ->orderBy('rounds.order')
            ->orderBy('matches.match_number')
            ->orderBy('matches.id')
            ->paginate($perPage);

        $collisions = $collisions->forTournament($tournament);

        return response()->json([
            'data' => array_map(
                fn (GameMatch $match): array => (new AdminMatchResource($match, $collisions))->resolve(),
                $matches->items(),
            ),
            'meta' => [
                'currentPage' => $matches->currentPage(),
                'lastPage' => $matches->lastPage(),
                'perPage' => $matches->perPage(),
                'total' => $matches->total(),
            ],
        ]);
    }

    /**
     * Zapis meczu (#159, #158, #216, #297): wynik, karne, stan i część meczu idą przez
     * `UpdateMatchRequest`, który po scaleniu ciała z zapisanym wierszem pilnuje
     * ich spójności, a termin i obiekt przyjmuje przy każdym stanie. Zmiana
     * wyniku nie dotyka tabeli jawnie — jest liczona przy odczycie. W drabince
     * zapis idzie razem z awansem i jego blokadą (`Advancement`).
     *
     * Odpowiedź to `AdminMatch`, jak na liście, więc kolizje po zmianie terminu
     * albo obiektu liczymy na świeżo dla całego turnieju. Mecze zależne panel
     * odświeża listą meczów fazy.
     */
    public function update(UpdateMatchRequest $request, GameMatch $match, Advancement $advancement, CollisionCalculator $collisions): JsonResponse
    {
        $data = $request->validated();
        $changes = [];
        $columns = [
            'homeScore' => 'home_score',
            'awayScore' => 'away_score',
            'homePenalties' => 'home_penalties',
            'awayPenalties' => 'away_penalties',
        ];

        foreach ($columns as $field => $column) {
            if (array_key_exists($field, $data)) {
                $changes[$column] = $data[$field];
            }
        }

        // W sporcie z setami wynik to sety wygrane, liczone z setów (#301).
        $changes = [...$changes, ...$request->scoreChanges()];

        if (array_key_exists('status', $data)) {
            $changes['status'] = $data['status'];
        }

        if (array_key_exists('kickoffAt', $data)) {
            $changes['kickoff_at'] = $data['kickoffAt'] === null
                ? null
                : Iso8601WithOffset::toUtc($data['kickoffAt']);
        }

        if (array_key_exists('venueId', $data)) {
            $changes['venue_id'] = $data['venueId'];
        }

        // Zegar meczu (#297) idzie w tej samej transakcji co wynik i awans.
        $changes = [...$changes, ...LiveClock::changes($match, $data, now())];

        $match = $advancement->save($match, $changes, $request->advancementErrorKey());
        $match->load(['round', 'homeTeam', 'awayTeam', 'venue']);

        $collisions = $collisions->forTournament($match->stage->tournament);

        return response()->json([
            'data' => (new AdminMatchResource($match, $collisions))->resolve(),
        ]);
    }
}
