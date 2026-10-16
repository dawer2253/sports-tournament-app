<?php

namespace App\Groups;

use App\Models\Group;
use App\Models\Stage;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Zmiana liczby wychodzących z jednej grupy (#259, `PATCH /groups/{group}`).
 *
 * Działa także po zamrożeniu składu, bo tabela grupy klaruje się dopiero
 * w trakcie fazy — granicą jest pierwszy mecz rozpoczęty fazy `knockout`
 * (#250). Sprawdzenia i zapis idą w transakcji z blokadą wiersza fazy grupy,
 * tej samej co w `GroupComposition`, więc zapis składu i zmiana wychodzących
 * tej fazy ustawiają się w kolejce, a odmowa niczego nie zmienia.
 */
class GroupQualifiers
{
    /**
     * @throws ValidationException playoff gra, z grupy wychodzi więcej drużyn,
     *                             niż w niej gra, albo suma w fazie spada poniżej dwóch
     */
    public function change(Group $group, int $qualifiers): Group
    {
        return DB::transaction(function () use ($group, $qualifiers): Group {
            $stage = Stage::query()->lockForUpdate()->findOrFail($group->stage_id);
            // Równoległy zapis składu mógł grupę skasować — wtedy 404.
            $group = $stage->groups()->findOrFail($group->id);

            if ($this->playoffHasStarted($stage)) {
                throw ValidationException::withMessages([
                    'stage' => 'Faza pucharowa ma rozegrane mecze, więc liczby wychodzących z grup nie można zmienić.',
                ]);
            }

            // Relacja pomija drużyny usunięte miękko: te w grupie już nie grają.
            if ($qualifiers > $group->teams()->count()) {
                throw ValidationException::withMessages(['qualifiers' => 'Z grupy nie może wyjść więcej drużyn, niż w niej gra.']);
            }

            $others = (int) $stage->groups()->whereKeyNot($group->id)->sum('qualifiers');

            if ($others + $qualifiers < 2) {
                throw ValidationException::withMessages(['qualifiers' => 'Z grup muszą wyjść co najmniej dwie drużyny.']);
            }

            $group->update(['qualifiers' => $qualifiers]);

            return $group;
        });
    }

    private function playoffHasStarted(Stage $stage): bool
    {
        return $stage->tournament->stages()
            ->where('type', 'knockout')
            ->get()
            ->contains(fn (Stage $knockout): bool => $knockout->hasStartedMatches());
    }
}
