<?php

namespace App\Http\Resources;

use App\Models\Sport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Sport zagnieżdżony w turnieju: kontrakt (`SportSummary`) chce tu samego
 * identyfikatora, kodu i nazwy, bez `config`.
 *
 * @mixin Sport
 */
class SportSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
        ];
    }
}
