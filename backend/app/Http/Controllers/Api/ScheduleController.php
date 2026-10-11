<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stages\GenerateScheduleRequest;
use App\Models\Stage;
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
}
