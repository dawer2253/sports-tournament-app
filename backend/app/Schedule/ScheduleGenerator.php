<?php

namespace App\Schedule;

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Random\Randomizer;

/**
 * Terminarz fazy `league` według decyzji #157: pary z `RoundRobin`, kolejność
 * drużyn losowana przy każdym wywołaniu, kolejki „Kolejka {order}” i mecze
 * `scheduled` bez terminu i obiektu. Daty to osobny krok (#175).
 *
 * Generowanie zastępuje cały terminarz fazy, dopóki żaden jej mecz nie jest
 * rozpoczęty. To jest reguła, na którą czekał docblock `GuardsStartedMatches`:
 * struktura spod generatora nie ma guarda w modelu, bo kasuje ją wyłącznie
 * ta klasa.
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
     * @return array{roundsCount: int, matchesCount: int}
     *
     * @throws ValidationException faza nie jest `league`, ma mecz rozpoczęty
     *                             albo turniej ma mniej niż dwie drużyny
     */
    public function generate(Stage $stage, int $meetings): array
    {
        return DB::transaction(function () use ($stage, $meetings): array {
            $stage = Stage::query()->lockForUpdate()->findOrFail($stage->id);
            $this->ensureCanGenerate($stage);

            // Po `id`, żeby wynik zależał tylko od losowania, a nie od kolejności
            // zwróconej przez bazę.
            $teams = $stage->tournament->teams()->orderBy('id')->pluck('id')->all();

            if (count($teams) < 2) {
                throw ValidationException::withMessages(['teams' => 'Liga potrzebuje co najmniej dwóch drużyn.']);
            }

            $teams = $this->randomizer->shuffleArray($teams);
            $rounds = RoundRobin::rounds(count($teams), $meetings);

            // Mecze i ich zdarzenia znikają kaskadą z kolejkami (`round_id`
            // i `match_id` są `cascadeOnDelete`).
            $stage->rounds()->delete();
            $roundIds = $this->insertRounds($stage, count($rounds));
            $matchesCount = $this->insertMatches($stage, $rounds, $teams, $roundIds);

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

        if ($stage->type !== 'league') {
            throw ValidationException::withMessages(['stage' => 'Generowanie terminarza działa na razie tylko dla fazy ligowej.']);
        }

        if ($stage->hasStartedMatches()) {
            throw ValidationException::withMessages(['stage' => 'Faza ma rozegrane mecze, więc nie można wygenerować terminarza ponownie.']);
        }
    }

    /**
     * Numeracja kolejek jest ciągła przez obie rundy (#157), więc nazwa
     * wynika wprost z `order`.
     *
     * @return array<int, int> id kolejki po jej `order`
     */
    private function insertRounds(Stage $stage, int $count): array
    {
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
     * @param  list<list<array{int, int}>>  $rounds  pary pozycji z `RoundRobin`
     * @param  list<int>  $teams  id drużyn w wylosowanej kolejności
     * @param  array<int, int>  $roundIds  id kolejki po jej `order`
     */
    private function insertMatches(Stage $stage, array $rounds, array $teams, array $roundIds): int
    {
        $now = now();
        $rows = [];

        foreach ($rounds as $index => $pairs) {
            foreach ($pairs as $number => [$home, $away]) {
                $rows[] = [
                    'round_id' => $roundIds[$index + 1],
                    'stage_id' => $stage->id,
                    'match_number' => $number + 1,
                    'home_team_id' => $teams[$home],
                    'away_team_id' => $teams[$away],
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
