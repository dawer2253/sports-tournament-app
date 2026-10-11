<?php

namespace App\Schedule;

use App\Models\GameMatch;
use App\Models\Stage;
use App\Models\Tournament;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Rozkład dat i obiektów po wygenerowanym terminarzu (#158), osobny krok od
 * generowania par (`ScheduleGenerator`). Dzięki temu przestawienie dat nie
 * losuje par od nowa.
 *
 * Rusza wyłącznie mecze `scheduled` w kolejkach od `fromRound` i nadpisuje
 * ręczne korekty. Mecze `live`/`finished` oraz kolejki przed `fromRound`
 * zachowują termin i obiekt, bo terminarz bywa już częściowo rozegrany.
 * W bazie nic poza `kickoff_at` i `venue_id` się nie zmienia; kolizje liczy
 * `CollisionCalculator` przy odczycie.
 */
class DateDistributor
{
    private const HAS_SCHEDULE_MESSAGE = 'Faza nie ma jeszcze terminarza, więc nie ma czego rozkładać.';

    public function __construct(private CollisionCalculator $collisions) {}

    /**
     * @return array{matchesCount: int, collisionsCount: int}
     *
     * @throws ValidationException faza nie ma żadnego meczu
     */
    public function distribute(Stage $stage, DatePlan $plan): array
    {
        return DB::transaction(function () use ($stage, $plan): array {
            $stage = Stage::query()->lockForUpdate()->findOrFail($stage->id);

            if ($stage->matches()->doesntExist()) {
                throw ValidationException::withMessages(['stage' => self::HAS_SCHEDULE_MESSAGE]);
            }

            $tournament = $stage->tournament;
            $duration = $tournament->match_duration;

            $updates = $this->slots($stage, $plan, $duration);

            foreach ($updates as $matchId => $attributes) {
                GameMatch::query()->whereKey($matchId)->update($attributes);
            }

            return [
                'matchesCount' => count($updates),
                'collisionsCount' => $this->collisionsCount($stage, $tournament),
            ];
        });
    }

    /**
     * Termin i obiekt dla każdego meczu `scheduled` w kolejkach od `fromRound`,
     * po `id` meczu.
     *
     * @return array<int, array{kickoff_at: string, venue_id: ?int}>
     */
    private function slots(Stage $stage, DatePlan $plan, int $duration): array
    {
        $rounds = $stage->rounds()
            ->with(['matches' => fn ($query) => $query->where('status', 'scheduled')->orderBy('match_number')])
            ->orderBy('order')
            ->get();

        $from = $plan->fromRound ?? 1;
        $startLocal = $plan->startAt->setTimezone($plan->timeZone);
        $dayEndMinutes = $this->minutesOfDay($plan->dayEndTime);
        $startMinutes = $startLocal->hour * 60 + $startLocal->minute;

        /** @var list<int> $venues */
        $venues = array_values($plan->venueIds);
        $venueCount = count($venues);

        $updates = [];
        $cursor = null;
        // Indeks liczy kolejki od pierwszej rozkładanej, więc `startAt` dotyczy
        // pierwszej z nich (`fromRound`), a nie bezwzględnego `order`.
        $index = -1;

        foreach ($rounds as $round) {
            if ($round->order < $from) {
                continue;
            }

            $index++;

            if ($round->matches->isEmpty()) {
                continue;
            }

            $roundStart = match ($plan->mode) {
                'interval' => $startLocal->addDays($index * ($plan->intervalDays ?? 1)),
                default => $cursor ?? $startLocal,
            };

            $slotStart = $roundStart;

            foreach ($round->matches as $position => $match) {
                // Nowy slot co `venueCount` meczów; bez obiektów cała kolejka
                // gra o jednej godzinie.
                if ($position > 0 && $venueCount > 0 && $position % $venueCount === 0) {
                    $slotStart = $slotStart->addMinutes($duration);
                }

                if ($plan->mode === 'continuous' && $dayEndMinutes !== null) {
                    $slotStart = $this->shiftPastDayEnd($slotStart, $duration, $startMinutes, $dayEndMinutes);
                }

                $updates[$match->id] = [
                    'kickoff_at' => $slotStart->utc()->format('Y-m-d H:i:s'),
                    'venue_id' => $venueCount > 0 ? $venues[$position % $venueCount] : null,
                ];

                $cursor = $slotStart->addMinutes($duration);
            }
        }

        return $updates;
    }

    /**
     * Slot, który kończyłby się po `dayEndTime`, przechodzi na następny dzień
     * o godzinie startu. Slot dłuższy niż okno dnia (od godziny startu do
     * `dayEndTime`) zostaje, bo nie zmieściłby się także po przesunięciu.
     */
    private function shiftPastDayEnd(CarbonImmutable $slotStart, int $duration, int $startMinutes, int $dayEndMinutes): CarbonImmutable
    {
        $window = $dayEndMinutes - $startMinutes;

        if ($window <= 0 || $duration > $window) {
            return $slotStart;
        }

        $dayEnd = $slotStart->startOfDay()->addMinutes($dayEndMinutes);

        if ($slotStart->addMinutes($duration)->lessThanOrEqualTo($dayEnd)) {
            return $slotStart;
        }

        return $slotStart->addDay()->startOfDay()->addMinutes($startMinutes);
    }

    /** „18:00” na minuty od północy; `null` zostaje `null`. */
    private function minutesOfDay(?string $time): ?int
    {
        if ($time === null) {
            return null;
        }

        [$hours, $minutes] = array_map(intval(...), explode(':', $time));

        return $hours * 60 + $minutes;
    }

    /** Mecze fazy z kolizją, licząc też kolizje z meczami innych faz turnieju. */
    private function collisionsCount(Stage $stage, Tournament $tournament): int
    {
        $collisions = $this->collisions->forTournament($tournament);
        $stageMatchIds = $stage->matches()->pluck('id')->all();

        return count(array_intersect($stageMatchIds, array_keys($collisions)));
    }
}
