<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Registrations\AcceptTeamRegistrationRequest;
use App\Http\Requests\Registrations\IndexTeamRegistrationsRequest;
use App\Http\Requests\Registrations\RejectTeamRegistrationRequest;
use App\Http\Requests\Registrations\StoreTeamRegistrationRequest;
use App\Http\Resources\TeamRegistrationResource;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use App\Models\TeamRegistration;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Zgłoszenia drużyn (#300): wysłanie ze strony publicznej, bez tokenu,
 * i rozpatrywanie w panelu. Trasy panelu autoryzuje middleware `can`, jak
 * resztę poddrzewa turnieju.
 */
class TeamRegistrationController extends Controller
{
    /**
     * Najwięcej zgłoszeń z jednego IP na godzinę, do wszystkich turniejów
     * łącznie (#300, opis `POST /public/t/{slug}/registrations` w kontrakcie).
     * Zmienia się razem z kontraktem.
     */
    public const SUBMISSIONS_PER_HOUR = 5;

    /**
     * Pole-pułapka idzie przed walidacją: bot dostaje zwykłe `201`, nic się
     * nie zapisuje, a `422` nie zdradza mu, czego formularz oczekuje. Dlatego
     * request z regułami powstaje dopiero tutaj, a nie z sygnatury metody —
     * Form Request z sygnatury waliduje się, zanim metoda w ogóle ruszy.
     *
     * Limit liczy zgłoszenia, a nie żądania, więc nie stoi na trasie jako
     * `throttle`, który liczyłby każde trafienie: zgłaszający poprawiający
     * błędy w formularzu nie może się zablokować własnymi `422`. Liczy się
     * każde `201`, także udawane dla bota. Klucz po samym IP, nie po
     * turnieju, bo spam idzie zwykle po wielu turniejach naraz.
     */
    public function store(Request $request, string $slug): JsonResponse
    {
        Tournament::findPublishedBySlug($slug);

        $limiterKey = 'team-registrations:'.$request->ip();
        if (RateLimiter::tooManyAttempts($limiterKey, self::SUBMISSIONS_PER_HOUR)) {
            // Tekst `429` ustawia mapa w `bootstrap/app.php`; `Retry-After` zostaje.
            throw new ThrottleRequestsException(headers: ['Retry-After' => RateLimiter::availableIn($limiterKey)]);
        }

        if (filled($request->input('website'))) {
            RateLimiter::hit($limiterKey, 3600);
            $teamName = $request->input('teamName');

            return $this->receipt(is_string($teamName) ? $teamName : '');
        }

        /** @var StoreTeamRegistrationRequest $form */
        $form = app(StoreTeamRegistrationRequest::class);
        $data = $form->validated();

        $registration = $form->tournament()->registrations()->create([
            'team_name' => $data['teamName'],
            'contact_name' => $data['contactName'],
            'contact_email' => $data['contactEmail'],
            'contact_phone' => $data['contactPhone'] ?? null,
            'players' => array_map(fn (array $player): array => [
                'name' => $player['name'],
                'number' => $player['number'] ?? null,
            ], $data['players'] ?? []),
        ]);
        RateLimiter::hit($limiterKey, 3600);

        return $this->receipt($registration->team_name);
    }

    /**
     * Przez relację turnieju, jak każda lista poddrzewa (`backend/AGENTS.md`).
     * Od najstarszego, remisy po `id` — tak stanowi kontrakt.
     */
    public function index(IndexTeamRegistrationsRequest $request, Tournament $tournament): AnonymousResourceCollection
    {
        return TeamRegistrationResource::collection(
            $tournament->registrations()
                ->when(
                    $request->statuses(),
                    fn (Builder $query, array $statuses): Builder => $query->whereIn('status', $statuses),
                )
                ->orderBy('created_at')
                ->orderBy('id')
                ->get()
        );
    }

    public function accept(AcceptTeamRegistrationRequest $request, TeamRegistration $registration): JsonResponse
    {
        $team = $registration->accept();

        return (new TeamResource($team->loadCount(Team::resourceCounts())))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function reject(RejectTeamRegistrationRequest $request, TeamRegistration $registration): TeamRegistrationResource
    {
        $registration->reject();

        return new TeamRegistrationResource($registration);
    }

    private function receipt(string $teamName): JsonResponse
    {
        return response()->json(['data' => ['teamName' => $teamName]], Response::HTTP_CREATED);
    }
}
