<?php

namespace App\Schedule;

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Round;
use App\Models\Stage;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Random\Randomizer;

/**
 * Terminarz fazy `league` i `group` według decyzji #157 i #258: pary
 * z `RoundRobin`, kolejność drużyn w lidze losowana przy każdym wywołaniu,
 * kolejki „Kolejka {order}” i mecze `scheduled` bez terminu i obiektu. Daty to
 * osobny krok (#175).
 *
 * W fazie `group` pary powstają osobno w każdej grupie, a mecze trafiają do
 * wspólnych kolejek fazy z ustawionym `group_id` ([ADR-0011]). Kolejka jest
 * wspólna: najpierw idą mecze pierwszej grupy według `Group.order`, potem
 * kolejnych, a w grupie obowiązuje kolejność Bergera. Kolejność drużyn
 * w grupie bierze się ze składu (po `id`), bo losowanie należy do zapisu
 * składu, nie do generowania terminarza.
 *
 * Generowanie zastępuje cały terminarz fazy, dopóki żaden jej mecz nie jest
 * rozpoczęty. To jest reguła, na którą czekał docblock `GuardsStartedMatches`:
 * struktura spod generatora nie ma guarda w modelu, bo kasuje ją wyłącznie
 * ta klasa.
 *
 * [ADR-0011]: ../../docs/adr/0011-kolejka-fazy-grupowej-jest-wspolna.md
 */
class ScheduleGenerator
{
    /** Zapis meczów porcjami, żeby 128 drużyn × 2 nie poszło jednym zapytaniem. */
    private const INSERT_CHUNK = 500;

    /**
     * Losowanie przychodzi z kontenera, więc test podstawia silnik z ziarnem.
     * Bez podstawienia `Randomizer` bierze bezpieczny silnik systemowy.
     */
    public function __construct(private Randomizer $randomizer) {}

    /**
     * Sprawdzenia i zapis idą w jednej transakcji, z blokadą wiersza fazy:
     * dwa równoległe generowania tej samej fazy ustawiają się w kolejce,
     * zamiast przeplatać kasowanie i wstawianie.
     *
     * Generowań w różnych fazach blokada wiersza nie szereguje. Nie wchodzą
     * w deadlock, bo połączenie działa w READ COMMITTED, które nie blokuje
     * szczelin przy kasowaniu kolejek i kaskadzie na mecze (uzasadnienie i pomiar:
     * ADR-0010, `docs/adr/0010-polaczenie-mysql-w-read-committed.md`).
     * Transakcja nie jest ponawiana: deadlock, gdyby jednak wystąpił, wraca
     * błędem od razu.
     *
     * Jedna blokada szczeliny zostaje: kolejki wstawiane przy regeneracji
     * mają te same klucze `(stage_id, order)` co skasowane, więc sprawdzenie
     * duplikatu blokuje szczelinę za nimi i generowanie innej fazy może
     * czekać na commit. Pustej fazy nie kasujemy, więc pierwsze generowanie
     * nie bierze nawet tej.
     *
     * @return array{roundsCount: int, matchesCount: int}
     *
     * @throws ValidationException faza jest `knockout`, ma mecz rozpoczęty,
     *                             brakuje jej składu grup, turniej ma mniej niż
     *                             dwie drużyny albo któraś drużyna nie ma grupy
     */
    public function generate(Stage $stage, int $meetings): array
    {
        return DB::transaction(function () use ($stage, $meetings): array {
            $stage = Stage::query()->lockForUpdate()->findOrFail($stage->id);
            $this->ensureCanGenerate($stage);

            $rounds = $stage->type === 'group'
                ? $this->groupRounds($stage, $meetings)
                : $this->leagueRounds($stage, $meetings);

            // Mecze i ich zdarzenia znikają kaskadą z kolejkami (`round_id`
            // i `match_id` są `cascadeOnDelete`).
            if ($stage->rounds()->exists()) {
                $stage->rounds()->delete();
            }
            $roundIds = $this->insertRounds($stage, count($rounds));
            $matchesCount = $this->insertMatches($stage, $rounds, $roundIds);

            return ['roundsCount' => count($rounds), 'matchesCount' => $matchesCount];
        });
    }

    /**
     * Mecz `live` liczy się jak rozegrany: za chwilę stanie się historią,
     * a regeneracja skasowałaby go razem z wynikiem (#157).
     */
    private function ensureCanGenerate(Stage $stage): void
    {
        // Fazę pucharową układa `BracketGenerator`, więc odmowa odsyła tam.
        if ($stage->type === 'knockout') {
            throw ValidationException::withMessages(['stage' => 'Faza pucharowa nie ma terminarza „każdy z każdym”. Wygeneruj dla niej drabinkę.']);
        }

        if ($stage->hasStartedMatches()) {
            throw ValidationException::withMessages(['stage' => 'Faza ma rozegrane mecze, więc nie można wygenerować terminarza ponownie.']);
        }
    }

    /**
     * Liga: wszystkie drużyny turnieju na jednej liście, wylosowane.
     *
     * @return list<list<array{home_team_id: int, away_team_id: int, group_id: null}>>
     */
    private function leagueRounds(Stage $stage, int $meetings): array
    {
        // Po `id`, żeby wynik zależał tylko od losowania, a nie od kolejności
        // zwróconej przez bazę.
        $teams = $stage->tournament->teams()->orderBy('id')->pluck('id')->all();

        if (count($teams) < 2) {
            throw ValidationException::withMessages(['teams' => 'Liga potrzebuje co najmniej dwóch drużyn.']);
        }

        $teams = $this->randomizer->shuffleArray($teams);

        return array_map(
            fn (array $pairs): array => array_map(
                fn (array $pair): array => [
                    'home_team_id' => $teams[$pair[0]],
                    'away_team_id' => $teams[$pair[1]],
                    'group_id' => null,
                ],
                $pairs,
            ),
            RoundRobin::rounds(count($teams), $meetings),
        );
    }

    /**
     * Faza grupowa: osobne koło Bergera na każdą grupę, w kolejności `order`.
     * Wspólna kolejka fazy powstaje przez sklejenie k-tej kolejki każdej grupy —
     * najpierw pierwsza grupa, potem kolejne ([ADR-0011]). `meetings` dotyczy
     * całej fazy.
     *
     * Grupy z mniej niż dwiema żywymi drużynami (drużynę usunięto po zapisie
     * składu) nie dostają meczów, zamiast wywalać generowanie — skład grup
     * poprawia `PUT /stages/{stage}/groups`.
     *
     * @return list<list<array{home_team_id: int, away_team_id: int, group_id: int}>>
     */
    private function groupRounds(Stage $stage, int $meetings): array
    {
        $groups = $stage->groups()
            ->with(['teams' => fn (HasMany $teams): HasMany => $teams->orderBy('id')])
            ->orderBy('order')
            ->get();

        if ($groups->isEmpty()) {
            throw ValidationException::withMessages(['stage' => 'Najpierw ustal skład grup.']);
        }

        $withoutGroup = $stage->tournament->teams()->whereNull('group_id')->orderBy('id')->value('name');

        if ($withoutGroup !== null) {
            throw ValidationException::withMessages([
                'teams' => "Drużyna „{$withoutGroup}” nie ma grupy. Zapisz skład grup od nowa.",
            ]);
        }

        $perGroup = $groups->map(fn (Group $group): array => [
            'id' => $group->id,
            'teamIds' => $group->teams->pluck('id')->all(),
            'rounds' => $group->teams->count() < 2 ? [] : RoundRobin::rounds($group->teams->count(), $meetings),
        ]);

        $roundsCount = $perGroup->max(fn (array $group): int => count($group['rounds']));
        $rounds = [];

        for ($round = 0; $round < $roundsCount; $round++) {
            $matches = [];

            foreach ($perGroup as $group) {
                foreach ($group['rounds'][$round] ?? [] as [$home, $away]) {
                    $matches[] = [
                        'home_team_id' => $group['teamIds'][$home],
                        'away_team_id' => $group['teamIds'][$away],
                        'group_id' => $group['id'],
                    ];
                }
            }

            $rounds[] = $matches;
        }

        return $rounds;
    }

    /**
     * Numeracja kolejek jest ciągła przez obie rundy (#157), więc nazwa
     * wynika wprost z `order`.
     *
     * @return array<int, int> id kolejki po jej `order`
     */
    private function insertRounds(Stage $stage, int $count): array
    {
        if ($count === 0) {
            return [];
        }

        $now = now();

        Round::query()->insert(array_map(fn (int $order): array => [
            'stage_id' => $stage->id,
            'name' => "Kolejka {$order}",
            'order' => $order,
            'created_at' => $now,
            'updated_at' => $now,
        ], range(1, $count)));

        return $stage->rounds()->pluck('id', 'order')->all();
    }

    /**
     * @param  list<list<array{home_team_id: int, away_team_id: int, group_id: ?int}>>  $rounds
     * @param  array<int, int>  $roundIds  id kolejki po jej `order`
     */
    private function insertMatches(Stage $stage, array $rounds, array $roundIds): int
    {
        $now = now();
        $rows = [];

        foreach ($rounds as $index => $matches) {
            foreach ($matches as $number => $match) {
                $rows[] = [
                    'round_id' => $roundIds[$index + 1],
                    'stage_id' => $stage->id,
                    'group_id' => $match['group_id'],
                    'match_number' => $number + 1,
                    'home_team_id' => $match['home_team_id'],
                    'away_team_id' => $match['away_team_id'],
                    'status' => 'scheduled',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach (array_chunk($rows, self::INSERT_CHUNK) as $chunk) {
            GameMatch::query()->insert($chunk);
        }

        return count($rows);
    }
}
