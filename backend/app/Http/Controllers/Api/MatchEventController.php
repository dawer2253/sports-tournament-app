<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MatchEvents\StoreMatchEventRequest;
use App\Http\Requests\MatchEvents\UpdateMatchEventRequest;
use App\Http\Resources\MatchEventResource;
use App\Leaderboards\MatchScorers;
use App\Models\GameMatch;
use App\Models\MatchEvent;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Zdarzenia meczu (#188): osobny zasób, płaski jak zawodnicy. W meczu
 * trwającym zdarzenie-zdobycz zmienia zapisany wynik meczu o swoją wartość,
 * w jednej transakcji z zapisem zdarzenia (#317, ADR-0013); samobój liczy się
 * przeciwnikowi, kartka i faul wyniku nie ruszają. W meczu zakończonym
 * zdarzenie wyniku nie zmienia, a API nie sprawdza zgodności liczby bramek
 * z wynikiem (reguła 11 z #188). Wynik poprawia się też ręcznie.
 */
class MatchEventController extends Controller
{
    /**
     * Przez relację meczu, jak każda lista poddrzewa. Kolejność stanowi
     * kontrakt (`MatchEvent::inTimelineOrder()`).
     */
    public function index(GameMatch $match): JsonResponse
    {
        $events = $match->events()
            ->with(self::relations())
            ->inTimelineOrder()
            ->get();

        $sport = $match->stage->tournament->sport;

        return response()->json([
            'data' => $events->map(fn (MatchEvent $event): array => (new MatchEventResource($event, $sport))->resolve())->all(),
        ]);
    }

    public function store(StoreMatchEventRequest $request, GameMatch $match): JsonResponse
    {
        $data = $request->validated();

        $event = DB::transaction(function () use ($match, $data): MatchEvent {
            $event = $match->events()->create([
                'type' => $data['type'],
                'team_id' => $data['teamId'],
                'player_id' => $data['playerId'],
                'minute' => $data['minute'],
                'added_time' => $data['addedTime'] ?? null,
            ]);

            $this->shiftScore($match, $this->gainOf($event), [0, 0]);

            return $event;
        });

        return $this->respond($event, Response::HTTP_CREATED);
    }

    public function update(UpdateMatchEventRequest $request, MatchEvent $event): JsonResponse
    {
        $changes = [];

        foreach (['type' => 'type', 'teamId' => 'team_id', 'playerId' => 'player_id', 'minute' => 'minute', 'addedTime' => 'added_time'] as $field => $column) {
            if (array_key_exists($field, $request->validated())) {
                $changes[$column] = $request->validated()[$field];
            }
        }

        DB::transaction(function () use ($event, $changes): void {
            $before = $this->gainOf($event);
            $event->update($changes);

            $this->shiftScore($event->match, $this->gainOf($event), $before);
        });

        return $this->respond($event);
    }

    /**
     * Mecz zaplanowany zdarzeń nie ma, więc i usuwać nie ma czego — reguła 8
     * mówi o tym wprost, tak samo jak przy zapisie.
     */
    public function destroy(MatchEvent $event): Response
    {
        if ($event->match->status === 'scheduled') {
            throw ValidationException::withMessages(['match' => MatchEvent::NOT_STARTED_MESSAGE]);
        }

        DB::transaction(function () use ($event): void {
            $gain = $this->gainOf($event);
            $event->delete();

            $this->shiftScore($event->match, [0, 0], $gain);
        });

        return response()->noContent();
    }

    /**
     * Zdobycz zdarzenia jako `[gospodarz, gość]` według sportu turnieju;
     * `[0, 0]` dla kartki, faulu i typu spoza zdobyczy sportu.
     *
     * @return array{int, int}
     */
    private function gainOf(MatchEvent $event): array
    {
        $match = $event->match;
        $sport = $match->stage->tournament->sport;

        // Wynik siatkówki to sety liczone przez serwer, a zdarzenia to wybrane akcje (ADR-0012).
        if ($sport->hasSets()) {
            return [0, 0];
        }

        $values = MatchScorers::scoringValues($sport);

        return MatchScorers::gain($event->type, $event->team_id, $match, $values);
    }

    /**
     * Przesuwa zapisany wynik o różnicę zdobyczy, ale tylko w meczu trwającym
     * (#317). Status i wynik czytamy z zablokowanego wiersza, żeby dwie
     * bramki zapisane naraz nie nadpisały się nawzajem; wynik nie schodzi
     * poniżej 0 (obcięcie, nie 422).
     *
     * @param  array{int, int}  $after
     * @param  array{int, int}  $before
     */
    private function shiftScore(GameMatch $match, array $after, array $before): void
    {
        $delta = [$after[0] - $before[0], $after[1] - $before[1]];

        if ($delta === [0, 0]) {
            return;
        }

        $locked = GameMatch::whereKey($match->id)->lockForUpdate()->firstOrFail();

        if ($locked->status !== 'live') {
            return;
        }

        $locked->update([
            'home_score' => max(0, ($locked->home_score ?? 0) + $delta[0]),
            'away_score' => max(0, ($locked->away_score ?? 0) + $delta[1]),
        ]);
    }

    private function respond(MatchEvent $event, int $status = Response::HTTP_OK): JsonResponse
    {
        $event->load(self::relations());

        return response()->json([
            'data' => (new MatchEventResource($event, $event->match->stage->tournament->sport))->resolve(),
        ], $status);
    }

    /**
     * Drużyna i zawodnik także usunięci miękko: zdarzenie ich nie traci, a bez
     * `withTrashed()` relacja dałaby `null` i zasób wywróciłby się na 500.
     *
     * @return array<string, callable(BelongsTo): mixed>
     */
    private static function relations(): array
    {
        return [
            'team' => fn (BelongsTo $query) => $query->withTrashed(),
            'player' => fn (BelongsTo $query) => $query->withTrashed(),
        ];
    }
}
