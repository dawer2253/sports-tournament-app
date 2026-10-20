<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsDates;
use App\Models\TeamRegistration;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Zgłoszenie w panelu (`TeamRegistration`), z danymi osobowymi — tylko dla
 * organizatora turnieju. Strona publiczna dostaje samo potwierdzenie
 * (`TeamRegistrationReceipt`), nie ten zasób.
 *
 * @mixin TeamRegistration
 */
class TeamRegistrationResource extends JsonResource
{
    use FormatsDates;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'tournamentId' => $this->tournament_id,
            'teamName' => $this->team_name,
            'status' => $this->status,
            // Odrzucenie usuwa dane osobowe, więc brak imienia znaczy brak kontaktu.
            'contact' => $this->contact_name === null ? null : [
                'name' => $this->contact_name,
                'email' => $this->contact_email,
                'phone' => $this->contact_phone,
            ],
            'players' => $this->players ?? [],
            'teamId' => $this->team_id,
            'createdAt' => $this->formatDate($this->created_at),
            'decidedAt' => $this->formatDate($this->decided_at),
        ];
    }
}
