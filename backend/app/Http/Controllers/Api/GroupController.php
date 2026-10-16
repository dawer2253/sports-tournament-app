<?php

namespace App\Http\Controllers\Api;

use App\Groups\GroupComposition;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stages\SetGroupsRequest;
use App\Http\Resources\StageResource;
use App\Models\Stage;

class GroupController extends Controller
{
    /**
     * Cały skład grup fazy w jednym zapisie (#258). Odmowy ze stanu fazy, stanu
     * drużyn i reguł składu (`422`) rzuca `GroupComposition` w transakcji.
     * Odpowiedź niesie fazę z nowymi grupami, w kolejności `order`.
     */
    public function update(SetGroupsRequest $request, Stage $stage, GroupComposition $composition): StageResource
    {
        return new StageResource($composition->save($stage, $request->groups()));
    }
}
