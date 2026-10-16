<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StageResource;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StageController extends Controller
{
    /**
     * Własność turnieju rozstrzyga `can` na trasie, więc lista idzie przez
     * jego relację, a nie przez zapytanie z id z żądania. Kolejność faz po
     * `order` stanowi kontrakt; drugi klucz jest zbędny, bo `order` jest unikalny
     * w turnieju. Grupy idą po swoim `order`, bo to on stanowi kolejność fazy
     * (#258).
     */
    public function index(Tournament $tournament): AnonymousResourceCollection
    {
        return StageResource::collection(
            $tournament->stages()
                ->with(['groups' => fn (HasMany $groups): HasMany => $groups->orderBy('order')])
                ->orderBy('order')
                ->get()
        );
    }
}
