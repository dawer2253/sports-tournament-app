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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Zgłoszenia drużyn (#300): wysłanie ze strony publicznej, bez tokenu,
 * i rozpatrywanie w panelu. Trasy panelu autoryzuje middleware `can`, jak
 * resztę poddrzewa turnieju.
 */
class TeamRegistrationController extends Controller
{
    /**
     * Pole-pułapka idzie przed walidacją: bot dostaje zwykłe `201`, nic się
     * nie zapisuje, a `422` nie zdradza mu, czego formularz oczekuje. Dlatego
     * request z regułami powstaje dopiero tutaj, a nie z sygnatury metody —
     * Form Request z sygnatury waliduje się, zanim metoda w ogóle ruszy.
     */
    public function store(Request $request, string $slug): JsonResponse
    {
        Tournament::findPublishedBySlug($slug);

        if (filled($request->input('website'))) {
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
