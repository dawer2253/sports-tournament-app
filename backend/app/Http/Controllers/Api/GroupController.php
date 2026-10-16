<?php

namespace App\Http\Controllers\Api;

use App\Groups\GroupComposition;
use App\Groups\GroupQualifiers;
use App\Http\Controllers\Controller;
use App\Http\Requests\Groups\UpdateGroupQualifiersRequest;
use App\Http\Requests\Stages\SetGroupsRequest;
use App\Http\Resources\GroupResource;
use App\Http\Resources\StageResource;
use App\Models\Group;
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

    /**
     * Liczba wychodzących z jednej grupy, także po zamrożeniu składu (#259).
     * Odmowy (`422`) rzuca `GroupQualifiers` w transakcji.
     */
    public function updateQualifiers(UpdateGroupQualifiersRequest $request, Group $group, GroupQualifiers $qualifiers): GroupResource
    {
        return new GroupResource($qualifiers->change($group, $request->qualifiers()));
    }
}
