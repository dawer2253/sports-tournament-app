<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stages\GenerateScheduleRequest;
use App\Http\Requests\Stages\ScheduleDatesRequest;
use App\Models\Stage;
use App\Schedule\DateDistributor;
use App\Schedule\ScheduleGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class ScheduleController extends Controller
{
    /**
     * Odmowy ze stanu fazy (`422`) rzuca generator. Odpowiedź niesie same
     * liczniki, a mecze panel dociąga listą meczów turnieju (#157).
     */
    public function store(GenerateScheduleRequest $request, Stage $stage, ScheduleGenerator $generator): JsonResponse
    {
        $result = $generator->generate($stage, $request->meetings());

        return response()->json(['data' => $result], Response::HTTP_CREATED);
    }

    /**
     * Rozkład dat (#158) to osobny krok po generowaniu par. Odmowę ze stanu
     * fazy (brak terminarza) rzuca `DateDistributor` w transakcji. Odpowiedź
     * niesie liczbę rozłożonych meczów i liczbę meczów fazy z kolizją.
     */
    public function dates(ScheduleDatesRequest $request, Stage $stage, DateDistributor $distributor): JsonResponse
    {
        $result = $distributor->distribute($stage, $request->plan());

        return response()->json(['data' => $result], Response::HTTP_OK);
    }
}
