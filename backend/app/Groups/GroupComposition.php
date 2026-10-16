<?php

namespace App\Groups;

use App\Models\Stage;
use App\Models\Team;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Zapis całego składu grup fazy `group` (#258, `PUT /stages/{stage}/groups`).
 *
 * Skład zastępuje się w całości: stare grupy fazy znikają razem z przypisaniem
 * drużyn, nowe wchodzą w kolejności ciała (od `order` 1), a `teams.group_id`
 * wskazuje nową grupę. Gdy faza ma terminarz, w tej samej transakcji znikają
 * jej kolejki razem z meczami — faz innych nie ruszamy.
 *
 * Sprawdzenia i zapis idą w jednej transakcji z blokadą wiersza fazy, tak jak
 * w `ScheduleGenerator`: dwa równoległe zapisy tej samej fazy ustawiają się
 * w kolejce, a odmowa niczego nie zmienia (transakcja się cofa).
 */
class GroupComposition
{
    /**
     * @param  list<array{name: string, teamIds: list<int>, qualifiers: int}>  $groups
     *
     * @throws ValidationException faza nie jest `group`, ma mecz rozpoczęty albo
     *                             skład łamie reguły z tabeli kontraktu
     */
    public function save(Stage $stage, array $groups): Stage
    {
        return DB::transaction(function () use ($stage, $groups): Stage {
            $stage = Stage::query()->lockForUpdate()->findOrFail($stage->id);

            if ($stage->type !== 'group') {
                throw ValidationException::withMessages(['stage' => 'Skład grup ustala się tylko w fazie grupowej.']);
            }

            if ($stage->hasStartedMatches()) {
                throw ValidationException::withMessages(['stage' => 'Faza ma rozegrane mecze, więc skład grup jest zamrożony.']);
            }

            $this->ensureComposition($stage, $groups);

            // `nullOnDelete` na `teams.group_id` zeruje przypisania razem
            // ze starymi grupami, więc kolejny krok tylko je nadpisuje.
            $stage->groups()->delete();

            foreach ($groups as $index => $group) {
                $saved = $stage->groups()->create([
                    'tournament_id' => $stage->tournament_id,
                    'name' => $group['name'],
                    'order' => $index + 1,
                    'qualifiers' => $group['qualifiers'],
                ]);

                // `group_id` nigdy nie przychodzi z ciała żądania — grupę tworzymy
                // tutaj, w turnieju fazy, a drużyny sprawdził `ensureComposition`,
                // więc predykat `Team::groupBelongsToSameTournament()` (dla CRUD
                // drużyn) nie ma tu czego pilnować.
                Team::query()
                    ->where('tournament_id', $stage->tournament_id)
                    ->whereIn('id', $group['teamIds'])
                    ->update(['group_id' => $saved->id]);
            }

            // Skasowanie terminarza fazy, gdy istnieje. Mecze i ich zdarzenia
            // znikają kaskadą z kolejkami (`round_id` jest `cascadeOnDelete`).
            if ($stage->rounds()->exists()) {
                $stage->rounds()->delete();
            }

            return $stage->load(['groups' => fn ($query) => $query->orderBy('order')]);
        });
    }

    /**
     * Reguły składu, których nie wyrazi walidacja ciała, bo potrzebują drużyn
     * turnieju: każda drużyna dokładnie raz, nazwy grup rozłączne, liczba
     * wychodzących nie większa od składu i suma wychodzących co najmniej dwa.
     *
     * @param  list<array{name: string, teamIds: list<int>, qualifiers: int}>  $groups
     */
    private function ensureComposition(Stage $stage, array $groups): void
    {
        if ($groups === []) {
            throw ValidationException::withMessages(['groups' => 'Faza grupowa potrzebuje co najmniej jednej grupy.']);
        }

        $teamIds = $stage->tournament->teams()->pluck('id')->all();
        $seen = [];

        foreach ($groups as $index => $group) {
            foreach ($group['teamIds'] as $teamId) {
                if (! in_array($teamId, $teamIds, true) || in_array($teamId, $seen, true)) {
                    throw ValidationException::withMessages(['groups' => 'Skład musi zawierać każdą drużynę turnieju dokładnie raz.']);
                }

                $seen[] = $teamId;
            }

            if ($group['qualifiers'] > count($group['teamIds'])) {
                throw ValidationException::withMessages([
                    "groups.{$index}.qualifiers" => 'Z grupy nie może wyjść więcej drużyn, niż w niej gra.',
                ]);
            }
        }

        if (count($seen) !== count($teamIds)) {
            throw ValidationException::withMessages(['groups' => 'Skład musi zawierać każdą drużynę turnieju dokładnie raz.']);
        }

        $names = array_map(fn (array $group): string => $group['name'], $groups);
        $duplicate = $this->firstDuplicateIndex($names);

        if ($duplicate !== null) {
            throw ValidationException::withMessages([
                "groups.{$duplicate}.name" => 'Nazwy grup w fazie nie mogą się powtarzać.',
            ]);
        }

        if (array_sum(array_column($groups, 'qualifiers')) < 2) {
            throw ValidationException::withMessages(['groups' => 'Z grup muszą wyjść co najmniej dwie drużyny.']);
        }
    }

    /**
     * Indeks drugiego wystąpienia powtórzonej nazwy, czyli miejsce, na którym
     * widać duplikat. `null`, gdy nazwy są rozłączne.
     *
     * @param  list<string>  $names
     */
    private function firstDuplicateIndex(array $names): ?int
    {
        $seen = [];

        foreach ($names as $index => $name) {
            if (isset($seen[$name])) {
                return $index;
            }

            $seen[$name] = true;
        }

        return null;
    }
}
