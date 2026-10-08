<?php

namespace App\Http\Resources;

use App\Models\Venue;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Venue
 */
class VenueResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tournamentId' => $this->tournament_id,
            'name' => $this->name,
            'address' => $this->address,
        ];
    }
}
