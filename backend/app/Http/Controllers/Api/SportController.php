<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SportResource;
use App\Models\Sport;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SportController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return SportResource::collection(Sport::orderBy('id')->get());
    }
}
