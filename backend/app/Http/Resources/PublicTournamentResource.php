<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsDates;
use App\Matches\MatchPeriods;
use App\Models\Tournament;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Turniej strony publicznej (`PublicTournament`): bez `id`, punktacji
 * i kryteriów, za to z fazami i statystykami klasyfikacji. Te ostatnie
 * w bazie nie istnieją, składa je `availableStats` i `statLabels` sportu.
 * Do zegara meczu na żywo (#297) idą też podział meczu, jego długość
 * i `runningClock` sportu. Wymaga wczytanych `sport` i `stages.groups`.
 *
 * @mixin Tournament
 */
class PublicTournamentResource extends JsonResource
{
    use FormatsDates;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'name' => $this->name,
            'slug' => $this->slug,
            'status' => $this->status,
            'sport' => [
                'id' => $this->sport->id,
                'code' => $this->sport->code,
                'name' => $this->sport->name,
                'allowsDraw' => $this->sport->allowsDraw(),
            ],
            'branding' => [
                'logoUrl' => $this->logoUrl(),
                'primaryColor' => $this->primary_color,
            ],
            'stages' => StageResource::collection($this->stages->sortBy('order')->values()),
            'stats' => array_map(fn (string $stat): array => [
                'code' => $stat,
                'label' => $this->sport->statLabel($stat),
            ], $this->sport->availableStats()),
            // Zegar meczu na żywo (#297) liczy przeglądarka, więc dostaje
            // podział meczu i flagę sportu, której w bazie turnieju nie ma.
            'periods' => MatchPeriods::of($this->resource)->toArray(),
            'matchDuration' => $this->match_duration,
            'runningClock' => $this->sport->runningClock(),
            // Stan liczony, nie samo ustawienie organizera (#300).
            'registration' => [
                'open' => $this->acceptsRegistrations(),
                'deadline' => $this->formatDate($this->registration_deadline),
            ],
        ];
    }
}
