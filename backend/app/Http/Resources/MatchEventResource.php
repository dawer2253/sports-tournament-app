<?php

namespace App\Http\Resources;

use App\Models\MatchEvent;
use App\Models\Sport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Zdarzenie meczu (`MatchEvent` w kontrakcie): bez `matchId` i bez `meta`
 * (#188, reguła 2). `typeLabel` wyprowadza serwer z konfiguracji sportu, jak
 * `scoreLabel` w tabeli (ADR-0006), więc zasób dostaje sport z zewnątrz —
 * lista nie może pytać o niego co wiersz.
 *
 * Oczekuje wczytanych `team` i `player`.
 *
 * @mixin MatchEvent
 */
class MatchEventResource extends JsonResource
{
    public function __construct(MatchEvent $resource, private Sport $sport)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'team' => $this->team->summary(),
            'player' => $this->player === null ? null : ['id' => $this->player->id, 'name' => $this->player->name],
            'type' => $this->type,
            'typeLabel' => $this->sport->eventType($this->type)['label'] ?? $this->type,
            'minute' => $this->minute,
        ];
    }
}
