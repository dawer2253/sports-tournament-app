<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tournaments\IndexTournamentRequest;
use App\Http\Requests\Tournaments\StoreTournamentRequest;
use App\Http\Requests\Tournaments\UpdateTournamentRequest;
use App\Http\Resources\TournamentResource;
use App\Models\Sport;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class TournamentController extends Controller
{
    private const DEFAULT_PER_PAGE = 20;

    private const MAX_PER_PAGE = 100;

    /**
     * Kolejność od najnowszego, remisy po `id` — tak stanowi opis endpointu
     * w kontrakcie. Bez drugiego klucza turnieje z tej samej sekundy mogłyby
     * się dublować albo ginąć na granicy stron.
     *
     * `perPage` ponad limit jest dociągane do niego, a nieczytelne (tekst,
     * zero, liczba ujemna) daje rozmiar domyślny — kontrakt nie przewiduje dla
     * niego odpowiedzi 422. `status` jest tu wyjątkiem: zły stan to literówka
     * w adresie, nie prośba o brak filtra, więc kontrakt przewiduje przy nim
     * 422 (ADR 0009).
     */
    public function index(IndexTournamentRequest $request): JsonResponse
    {
        $perPage = $request->integer('perPage');
        $perPage = $perPage < 1 ? self::DEFAULT_PER_PAGE : min($perPage, self::MAX_PER_PAGE);

        $tournaments = Tournament::whereBelongsTo($request->user())
            ->with('sport')
            ->withCount('teams')
            // `whereIn` przed `paginate()` — sedno ADR 0009: filtr zawęża
            // zapytanie, a nie pobraną stronę, więc `meta` mówi o zbiorze
            // już zawężonym.
            ->when(
                $request->statuses(),
                fn (Builder $query, array $statuses): Builder => $query->whereIn('status', $statuses),
            )
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json([
            'data' => TournamentResource::collection($tournaments->items()),
            'meta' => [
                'currentPage' => $tournaments->currentPage(),
                'lastPage' => $tournaments->lastPage(),
                'perPage' => $tournaments->perPage(),
                'total' => $tournaments->total(),
            ],
        ]);
    }

    public function store(StoreTournamentRequest $request): JsonResponse
    {
        $tournament = Tournament::createForOrganizer(
            organizer: $request->user(),
            sport: Sport::findOrFail($request->validated('sportId')),
            name: $request->validated('name'),
            format: $request->validated('format'),
        );

        return (new TournamentResource($tournament->load('sport')->loadCount('teams')))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(Tournament $tournament): TournamentResource
    {
        return new TournamentResource($tournament->load('sport')->loadCount('teams'));
    }

    /**
     * Zmienia tylko pola, które przyszły; puste ciało oddaje turniej bez zmian.
     *
     * Wolność sluga sprawdza walidacja, ale sprawdzenie i zapis to dwa kroki.
     * Równoległe żądanie, które zajmie slug pomiędzy nimi, odbija się od
     * unikalnego indeksu — wtedy oddajemy ten sam `422` pod `slug` co
     * walidacja, a nie `500`.
     */
    public function update(UpdateTournamentRequest $request, Tournament $tournament): TournamentResource
    {
        try {
            $tournament->update($request->tournamentAttributes());
        } catch (UniqueConstraintViolationException $violation) {
            if (! Tournament::isSlugCollision($violation)) {
                throw $violation;
            }

            throw ValidationException::withMessages([
                'slug' => $request->messages()['slug.unique'],
            ]);
        }

        return new TournamentResource($tournament->load('sport')->loadCount('teams'));
    }

    /**
     * Guard z rozegranym meczem daje 422 (`FinishedMatchGuardException`),
     * a poddrzewo kaskaduje baza. Status turnieju nie ma znaczenia (#83).
     */
    public function destroy(Tournament $tournament): Response
    {
        $tournament->delete();

        return response()->noContent();
    }
}
