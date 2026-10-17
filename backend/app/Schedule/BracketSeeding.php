<?php

namespace App\Schedule;

use App\Models\Group;
use App\Models\Stage;
use App\Models\Tournament;
use App\Standings\StandingTable;
use App\Standings\TournamentStandings;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Propozycja rozstawienia drabinki playoffu z tabel grup (#250, #260,
 * `GET /stages/{stage}/bracket/seeding`). Liczona przy odczycie i nigdzie
 * niezapisywana — tak jak samo rozstawienie (hasło „Seeding” w `CONTEXT.md`).
 *
 * Reguła z #250: start miejscami, w obrębie miejsca w kolejności
 * `groups.order` (1A, 1B, …, 2A, 2B, …), potem wspinaczka zamianami dwóch
 * drużyn z tego samego miejsca. Koszt listy to wektor: ile par z jednej grupy
 * może się spotkać najwcześniej w rundzie 1, ile w rundzie 2 itd., porównywany
 * leksykograficznie. Krok bierze zamianę o najmniejszym koszcie, a przy
 * remisie tę leżącą najniżej na liście, żeby górne numery jak najdłużej
 * zostały w kolejności grup. Pozycje w drabince są te z `BracketGenerator`.
 *
 * Wspólne z generatorem są też reguły wejścia z grup (`groupStageOf`,
 * `qualifyingGroups`): generowanie drabinki w turnieju z fazą `group`
 * odmawia z tych samych powodów co propozycja.
 */
final class BracketSeeding
{
    public const NO_GROUP_STAGE_MESSAGE = 'Propozycja rozstawienia z grup jest tylko w turnieju z fazą grupową.';

    public const NO_GROUPS_MESSAGE = 'Najpierw ustal skład grup.';

    public const TEAM_IDS_MESSAGE = 'Lista musi zawierać tyle drużyn z każdej grupy, ile z niej wychodzi.';

    /**
     * @return list<array{teamId: int, groupId: int, position: int}> w kolejności rozstawienia
     *
     * @throws ValidationException faza nie jest `knockout`, turniej nie ma
     *                             fazy `group`, ta nie ma składu albo grupa
     *                             ma mniej drużyn, niż z niej wychodzi
     */
    public function propose(Stage $stage): array
    {
        if ($stage->type !== 'knockout') {
            throw ValidationException::withMessages(['stage' => BracketGenerator::KNOCKOUT_ONLY_MESSAGE]);
        }

        $tournament = $stage->tournament;
        $groupStage = self::groupStageOf($tournament);

        if ($groupStage === null) {
            throw ValidationException::withMessages(['stage' => self::NO_GROUP_STAGE_MESSAGE]);
        }

        $groups = self::qualifyingGroups($groupStage);

        /** @var array<int, StandingTable> $tables tabela po id grupy */
        $tables = [];
        foreach (TournamentStandings::of($tournament) as $table) {
            if ($table->group !== null) {
                $tables[$table->group->id] = $table;
            }
        }

        // Start: miejscami, w obrębie miejsca w kolejności grup. Wiersze
        // tabeli idą od pierwszego miejsca, a grupa ma co najmniej
        // `qualifiers` drużyn, więc każde miejsce do `qualifiers` istnieje.
        $list = [];
        $deepest = $groups->max('qualifiers');
        for ($position = 1; $position <= $deepest; $position++) {
            foreach ($groups as $group) {
                if ($position <= $group->qualifiers) {
                    $row = $tables[$group->id]->rows[$position - 1];
                    $list[] = ['teamId' => $row->team->id, 'groupId' => $group->id, 'position' => $row->position];
                }
            }
        }

        return self::arrange($list);
    }

    /** Pierwsza faza `group` turnieju; `null` w samym pucharze i w lidze. */
    public static function groupStageOf(Tournament $tournament): ?Stage
    {
        return $tournament->stages()->where('type', 'group')->orderBy('order')->first();
    }

    /**
     * Grupy fazy w kolejności `order`, każda z liczbą żywych drużyn
     * (`teams_count`) nie mniejszą niż `qualifiers`.
     *
     * @return Collection<int, Group>
     *
     * @throws ValidationException faza nie ma składu albo grupa ma mniej
     *                             drużyn, niż z niej wychodzi (drużynę
     *                             usunięto po zapisie składu)
     */
    public static function qualifyingGroups(Stage $groupStage): Collection
    {
        // Relacja pomija drużyny usunięte miękko: te w grupie już nie grają.
        $groups = $groupStage->groups()->withCount('teams')->orderBy('order')->get();

        if ($groups->isEmpty()) {
            throw ValidationException::withMessages(['stage' => self::NO_GROUPS_MESSAGE]);
        }

        $tooSmall = $groups->first(fn (Group $group): bool => $group->teams_count < $group->qualifiers);

        if ($tooSmall !== null) {
            throw ValidationException::withMessages([
                'groups' => "Grupa „{$tooSmall->name}” ma mniej drużyn, niż z niej wychodzi.",
            ]);
        }

        return $groups;
    }

    /**
     * Wspinaczka z #250. Zamiana dwóch pozycji zmienia tylko pary z ich
     * grupami, więc koszt po zamianie liczy się różnicowo, bez przeliczania
     * całej listy — przy `MAX_TEAMS` drużyn pełne przeliczenie w każdym
     * kandydacie byłoby za wolne.
     *
     * @template T of array{groupId: int, position: int}
     *
     * @param  list<T>  $list  start: miejscami, w obrębie miejsca w kolejności grup
     * @return list<T>
     */
    public static function arrange(array $list): array
    {
        $count = count($list);
        $size = 2;
        $roundsCount = 1;
        while ($size < $count) {
            $size *= 2;
            $roundsCount++;
        }

        /** @var array<int, int> $slot pozycja w pełnej drabince po indeksie listy */
        $slot = [];
        foreach (BracketGenerator::seedPositions($size) as $index => $seed) {
            if ($seed <= $count) {
                $slot[$seed - 1] = $index;
            }
        }

        /** @var array<int, list<int>> $members indeksy listy po id grupy */
        $members = [];
        foreach ($list as $index => $entry) {
            $members[$entry['groupId']][] = $index;
        }

        $cost = array_fill(0, $roundsCount, 0);
        foreach ($members as $indexes) {
            foreach ($indexes as $a => $i) {
                foreach (array_slice($indexes, $a + 1) as $j) {
                    $cost[self::meetingRound($slot[$i], $slot[$j])]++;
                }
            }
        }

        for (; ;) {
            $best = null;
            $bestCost = $cost;

            // Od dołu listy i ostra nierówność: przy remisie zostaje zamiana
            // leżąca najniżej, jak w skrypcie odniesienia z #250.
            for ($j = $count - 1; $j > 0; $j--) {
                for ($i = $j - 1; $i >= 0; $i--) {
                    if ($list[$i]['position'] !== $list[$j]['position']) {
                        continue;
                    }

                    $next = self::swappedCost($cost, $list, $members, $slot, $i, $j);

                    if (self::isLower($next, $bestCost)) {
                        $best = [$i, $j];
                        $bestCost = $next;
                    }
                }
            }

            if ($best === null) {
                return $list;
            }

            [$i, $j] = $best;
            $groupI = $list[$i]['groupId'];
            $groupJ = $list[$j]['groupId'];
            $members[$groupI] = array_map(fn (int $index): int => $index === $i ? $j : $index, $members[$groupI]);
            $members[$groupJ] = array_map(fn (int $index): int => $index === $j ? $i : $index, $members[$groupJ]);
            [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
            $cost = $bestCost;
        }
    }

    /**
     * Koszt po zamianie pozycji `$i` i `$j`. To samo miejsce tabeli znaczy
     * różne grupy, bo grupa ma na każdym miejscu jedną drużynę. Drużyna
     * z `$i` przechodzi do slotu `$j` i odwrotnie, więc zmieniają się tylko
     * jej pary z resztą jej grupy.
     *
     * @param  list<int>  $cost
     * @param  list<array{groupId: int, position: int}>  $list
     * @param  array<int, list<int>>  $members
     * @param  array<int, int>  $slot
     * @return list<int>
     */
    private static function swappedCost(array $cost, array $list, array $members, array $slot, int $i, int $j): array
    {
        foreach ([[$i, $j], [$j, $i]] as [$from, $to]) {
            foreach ($members[$list[$from]['groupId']] as $other) {
                if ($other !== $from) {
                    $cost[self::meetingRound($slot[$from], $slot[$other])]--;
                    $cost[self::meetingRound($slot[$to], $slot[$other])]++;
                }
            }
        }

        return $cost;
    }

    /** Runda (od zera), w której drużyny z tych slotów mogą się spotkać najwcześniej. */
    private static function meetingRound(int $a, int $b): int
    {
        $round = -1;
        while ($a !== $b) {
            $a >>= 1;
            $b >>= 1;
            $round++;
        }

        return $round;
    }

    /**
     * @param  list<int>  $a
     * @param  list<int>  $b
     */
    private static function isLower(array $a, array $b): bool
    {
        foreach ($a as $round => $value) {
            if ($value !== $b[$round]) {
                return $value < $b[$round];
            }
        }

        return false;
    }
}
