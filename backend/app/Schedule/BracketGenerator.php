<?php

namespace App\Schedule;

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Drabinka single elimination fazy `knockout` według decyzji #215: rozmiar
 * to najbliższa potęga dwójki, seedy stoją na pozycjach ze standardowej
 * reguły (1–N, N/2–N/2+1…), wolne losy dostają najwyżej rozstawieni,
 * a `match_number` to pozycja w pełnej drabince, więc w pierwszej rundzie ma
 * dziury. Krawędzie i `advances_to_slot` idą według ADR-0004.
 *
 * Generowanie zastępuje całą drabinkę fazy, dopóki żaden jej mecz nie jest
 * rozpoczęty — ta sama reguła co w `ScheduleGenerator`, bo strukturę spod
 * generatora kasuje wyłącznie generator (`GuardsStartedMatches`).
 * Rozstawienie przychodzi z żądania, więc losowania tu nie ma: wymieszanie
 * listy to sprawa klienta.
 *
 * W turnieju z fazą `group` drabinka powstaje z wyjścia z grup (#250, #260):
 * lista ma z każdej grupy dokładnie `qualifiers` drużyn, niekoniecznie
 * czołówkę tabeli (remis na linii rozstrzyga organizer). Tabel generator nie
 * czyta, więc wolno generować przed końcem meczów grup, a wynik meczu grupy
 * wpisany później drabinki nie rusza.
 */
class BracketGenerator
{
    public const TEAM_IDS_MESSAGE = 'Lista musi zawierać każdą drużynę turnieju dokładnie raz.';

    /** Wspólne z `BracketSeeding`: propozycja też jest tylko dla fazy pucharowej. */
    public const KNOCKOUT_ONLY_MESSAGE = 'Drabinkę generuje się tylko w fazie pucharowej.';

    /**
     * Sprawdzenia i zapis idą w jednej transakcji, z blokadą wiersza fazy,
     * jak w `ScheduleGenerator`. Odmowa niczego nie zmienia. Pominięcie
     * kasowania pustej fazy i brak ponawiania też stamtąd — powód
     * w docblocku `ScheduleGenerator::generate()`.
     *
     * @param  list<int>  $teamIds  drużyny drabinki w kolejności rozstawienia
     * @return array{roundsCount: int, matchesCount: int}
     *
     * @throws ValidationException faza nie jest `knockout` albo ma mecz
     *                             rozpoczęty, w samym pucharze turniej ma
     *                             mniej niż dwie drużyny albo lista nie jest
     *                             zbiorem drużyn turnieju, w turnieju z fazą
     *                             `group` brakuje składu, grupa ma mniej
     *                             drużyn, niż z niej wychodzi, albo lista nie
     *                             ma z każdej grupy `qualifiers` drużyn, mecz
     *                             o 3. miejsce zamówiono przy mniej niż
     *                             czterech drużynach
     */
    public function generate(Stage $stage, array $teamIds, bool $thirdPlaceMatch): array
    {
        return DB::transaction(function () use ($stage, $teamIds, $thirdPlaceMatch): array {
            $stage = Stage::query()->lockForUpdate()->findOrFail($stage->id);
            $this->ensureCanGenerate($stage);

            $groupStage = BracketSeeding::groupStageOf($stage->tournament);

            if ($groupStage !== null) {
                $this->ensureQualifiersFromEachGroup($teamIds, BracketSeeding::qualifyingGroups($groupStage));
            } else {
                $this->ensureEveryTeamOnce($stage, $teamIds);
            }

            if ($thirdPlaceMatch && count($teamIds) < 4) {
                throw ValidationException::withMessages(['thirdPlaceMatch' => 'Mecz o 3. miejsce wymaga co najmniej czterech drużyn.']);
            }

            // Mecze i ich zdarzenia znikają kaskadą z rundami.
            if ($stage->rounds()->exists()) {
                $stage->rounds()->delete();
            }

            return $this->insertBracket($stage, $teamIds, $thirdPlaceMatch);
        });
    }

    /** Mecz `live` liczy się jak rozegrany, jak w `ScheduleGenerator` (#157). */
    private function ensureCanGenerate(Stage $stage): void
    {
        if ($stage->type !== 'knockout') {
            throw ValidationException::withMessages(['stage' => self::KNOCKOUT_ONLY_MESSAGE]);
        }

        if ($stage->hasStartedMatches()) {
            throw ValidationException::withMessages(['stage' => 'Faza ma rozegrane mecze, więc nie można wygenerować drabinki ponownie.']);
        }
    }

    /**
     * Sam puchar (#215): w drabince gra każda żywa drużyna turnieju, dokładnie raz.
     *
     * @param  list<int>  $teamIds  lista z żądania
     */
    private function ensureEveryTeamOnce(Stage $stage, array $teamIds): void
    {
        $tournamentTeamIds = $stage->tournament->teams()->pluck('id')->all();

        if (count($tournamentTeamIds) < 2) {
            throw ValidationException::withMessages(['teams' => 'Puchar potrzebuje co najmniej dwóch drużyn.']);
        }

        sort($teamIds);
        sort($tournamentTeamIds);

        if ($teamIds !== $tournamentTeamIds) {
            throw ValidationException::withMessages(['teamIds' => self::TEAM_IDS_MESSAGE]);
        }
    }

    /**
     * Turniej z fazą `group` (#250): z każdej grupy dokładnie `qualifiers`
     * żywych drużyn, każda raz. Drużyna bez grupy, obca albo usunięta nie
     * ma grupy na mapie, więc łamie regułę tak samo jak nadmiar z grupy.
     *
     * @param  list<int>  $teamIds  lista z żądania
     * @param  Collection<int, Group>  $groups  grupy fazy z `BracketSeeding::qualifyingGroups()`
     */
    private function ensureQualifiersFromEachGroup(array $teamIds, Collection $groups): void
    {
        /** @var array<int, int> $groupOf grupa po id drużyny */
        $groupOf = Team::query()->whereIn('group_id', $groups->modelKeys())->pluck('group_id', 'id')->all();
        $counts = array_count_values(array_map(fn (int $id): int => $groupOf[$id] ?? 0, $teamIds));

        $isQualifiersFromEachGroup = count(array_unique($teamIds)) === count($teamIds)
            && ! isset($counts[0])
            && $groups->every(fn (Group $group): bool => ($counts[$group->id] ?? 0) === $group->qualifiers);

        if (! $isQualifiersFromEachGroup) {
            throw ValidationException::withMessages(['teamIds' => BracketSeeding::TEAM_IDS_MESSAGE]);
        }
    }

    /**
     * Pozycje seedów w pełnej drabince o rozmiarze `$size`: kolejne pary to
     * mecze pierwszej rundy. Każdy poziom rozkłada seed `s` na parę
     * `s – (2m + 1 − s)`, więc seedy 1…2^k lądują w różnych częściach drabinki
     * i nie spotkają się, zanim zostanie 2^k drużyn.
     *
     * @return list<int> seedy od 1, np. `[1, 8, 4, 5, 2, 7, 3, 6]` dla 8
     */
    public static function seedPositions(int $size): array
    {
        $seeds = [1];

        while (count($seeds) < $size) {
            $mirror = count($seeds) * 2 + 1;
            $seeds = array_merge(...array_map(fn (int $seed): array => [$seed, $mirror - $seed], $seeds));
        }

        return $seeds;
    }

    /** Nazwa rundy po liczbie drużyn, które grają w niej w pełnej drabince. */
    public static function roundName(int $teamsInRound): string
    {
        return match ($teamsInRound) {
            2 => 'Finał',
            4 => 'Półfinał',
            8 => 'Ćwierćfinał',
            default => '1/'.intdiv($teamsInRound, 2).' finału',
        };
    }

    /**
     * Mecze idą od finału wstecz, runda po rundzie, tak jak przewiduje
     * migracja `matches`: cel krawędzi istnieje już w chwili wstawiania
     * wiersza. Wewnątrz rundy zapis idzie jednym zapytaniem, a id dociąga
     * drugie, po `match_number`.
     *
     * @param  list<int>  $teamIds
     * @return array{roundsCount: int, matchesCount: int}
     */
    private function insertBracket(Stage $stage, array $teamIds, bool $thirdPlaceMatch): array
    {
        $plan = $this->plan($teamIds);
        $roundsCount = count($plan);
        $roundIds = $this->insertRounds($stage, $roundsCount);

        /** @var array<int, int> $nextIds id meczów rundy o jeden dalej, po numerze */
        $nextIds = [];
        $loserTo = null;
        $matchesCount = 0;

        for ($order = $roundsCount; $order >= 1; $order--) {
            $rows = [];

            foreach ($plan[$order] as $number => [$home, $away]) {
                $target = $order < $roundsCount ? $nextIds[intdiv($number + 1, 2)] : null;
                $rows[] = $this->row($stage, $roundIds[$order], $number, $home, $away, $target, $order === $roundsCount - 1 ? $loserTo : null);
            }

            GameMatch::query()->insert($rows);
            $matchesCount += count($rows);
            $nextIds = GameMatch::query()->where('round_id', $roundIds[$order])->pluck('id', 'match_number')->all();

            // Mecz o 3. miejsce stoi w rundzie finału, więc wchodzi zaraz po
            // finale, zanim półfinały zapiszą do niego krawędź przegranego.
            if ($order === $roundsCount && $thirdPlaceMatch) {
                $loserTo = GameMatch::query()->insertGetId($this->row($stage, $roundIds[$order], 2, null, null, null, null));
                $matchesCount++;
            }
        }

        return ['roundsCount' => $roundsCount, 'matchesCount' => $matchesCount];
    }

    /**
     * Pary każdej rundy pełnej drabinki: w pierwszej z rozstawienia, w drugiej
     * drużyny z wolnym losem, dalej same puste sloty. Mecz pierwszej rundy
     * z rywalem spoza listy nie powstaje — jego numer zostaje dziurą, a seed
     * stoi od razu w meczu drugiej rundy, na stronie wynikającej z numeru.
     *
     * @param  list<int>  $teamIds
     * @return array<int, array<int, array{?int, ?int}>> po `order` rundy, potem po `match_number`
     */
    private function plan(array $teamIds): array
    {
        $count = count($teamIds);
        $size = 2;
        while ($size < $count) {
            $size *= 2;
        }
        $roundsCount = (int) log($size, 2);

        $plan = [];
        for ($order = 1; $order <= $roundsCount; $order++) {
            $plan[$order] = array_fill(1, intdiv($size, 2 ** $order), [null, null]);
        }

        $positions = self::seedPositions($size);
        foreach (array_chunk($positions, 2) as $index => [$seed, $rival]) {
            $number = $index + 1;

            if ($rival <= $count) {
                $plan[1][$number] = [$teamIds[$seed - 1], $teamIds[$rival - 1]];

                continue;
            }

            unset($plan[1][$number]);
            $plan[2][intdiv($number + 1, 2)][$number % 2 === 1 ? 0 : 1] = $teamIds[$seed - 1];
        }

        return $plan;
    }

    /**
     * Nazwa rundy wynika z jej rozmiaru: runda `order` pełnej drabinki ma
     * `2^(roundsCount − order + 1)` drużyn.
     *
     * @return array<int, int> id rundy po jej `order`
     */
    private function insertRounds(Stage $stage, int $roundsCount): array
    {
        $now = now();

        Round::query()->insert(array_map(fn (int $order): array => [
            'stage_id' => $stage->id,
            'name' => self::roundName(2 ** ($roundsCount - $order + 1)),
            'order' => $order,
            'created_at' => $now,
            'updated_at' => $now,
        ], range(1, $roundsCount)));

        return $stage->rounds()->pluck('id', 'order')->all();
    }

    /**
     * Strona w meczu docelowym jest wspólna dla obu krawędzi i wynika
     * z numeru: nieparzysty zasila gospodarza (ADR-0004). Bez żadnej krawędzi
     * strony nie ma.
     *
     * @return array<string, mixed>
     */
    private function row(Stage $stage, int $roundId, int $number, ?int $home, ?int $away, ?int $winnerTo, ?int $loserTo): array
    {
        $now = now();

        return [
            'round_id' => $roundId,
            'stage_id' => $stage->id,
            'match_number' => $number,
            'home_team_id' => $home,
            'away_team_id' => $away,
            'status' => 'scheduled',
            'winner_to_match_id' => $winnerTo,
            'loser_to_match_id' => $loserTo,
            'advances_to_slot' => $winnerTo === null && $loserTo === null ? null : ($number % 2 === 1 ? 'home' : 'away'),
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }
}
