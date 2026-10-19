<?php

namespace App\Standings;

use App\Models\GameMatch;
use App\Models\Team;
use Closure;
use Collator;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * Liczy jedną tabelę przy odczycie: z drużyn i meczów fazy `league` albo
 * jednej grupy. Tabela nie jest zapisywana, więc zmiana punktacji, kryteriów
 * czy wyniku działa od następnego odczytu. Reguły ustalił #160:
 *
 * 1. Do bilansu wchodzą wyłącznie mecze `finished`; `live` się nie liczy.
 * 2. Kryteria idą po kolei z listy turnieju. Każde dzieli remisującą grupę na
 *    mniejsze, a każda z nich idzie do **następnego** kryterium — także po
 *    `head_to_head`, bez powrotu do niego (decyzja #11).
 * 3. `head_to_head` to mini-tabela z meczów między remisującymi (punkty,
 *    bilans, zdobycze w tych meczach). Jest pomijane, dopóki któryś z tych
 *    meczów nie jest zakończony.
 * 4. Ostatnie, ukryte kryterium to nazwa drużyny po polsku, bez rozróżniania
 *    wielkości liter, z `team.id` jako bezpiecznikiem. Miejsca są więc zawsze
 *    unikalne, `1..n`.
 * 5. Wiersz dostaje każda podana drużyna, także bez meczów.
 * 6. Forma (#291) to wyniki z tych samych meczów co bilans, po kolejce
 *    (`rounds.order`, potem `match_number`, na końcu `id`), nie po chwili
 *    zapisu wyniku: terminarz powstaje bez dat, a kolejka meczu się nie
 *    zmienia. Mini-tabela `head_to_head` liczy na osobnych wierszach, więc
 *    formy pełnej tabeli nie rusza.
 */
final readonly class StandingsCalculator
{
    /**
     * @param  array{win: int, draw: int, loss: int}  $points  punktacja turnieju
     * @param  list<string>  $tiebreakers  kody `TiebreakerCode` w kolejności
     */
    public function __construct(
        private array $points,
        private array $tiebreakers,
    ) {}

    /**
     * @param  Collection<int, Team>  $teams  komplet drużyn tabeli
     * @param  Collection<int, GameMatch>  $matches  mecze tabeli w każdym statusie;
     *                                               niezakończone są potrzebne regule 3,
     *                                               kolejka (`round`) regule 6
     * @return list<StandingRow>
     */
    public function calculate(Collection $teams, Collection $matches): array
    {
        // Kolejność rozegrania idzie po kolejce: `loadMissing` dociąga ją jednym
        // zapytaniem, gdy wywołujący nie wczytał `matches.round`.
        $finished = EloquentCollection::make($matches->filter(fn (GameMatch $match): bool => $match->isFinished())->all())
            ->loadMissing('round')
            ->sortBy([
                fn (GameMatch $a, GameMatch $b): int => $a->round->order <=> $b->round->order,
                fn (GameMatch $a, GameMatch $b): int => $a->match_number <=> $b->match_number,
                fn (GameMatch $a, GameMatch $b): int => $a->id <=> $b->id,
            ]);
        $rows = $this->tally($teams, $finished);
        $ranked = $this->rank(array_values($rows), 0, $matches);

        foreach ($ranked as $index => $row) {
            $row->position = $index + 1;
        }

        return $ranked;
    }

    /**
     * Wiersze podanych drużyn z bilansem z podanych meczów. Mecz z drużyną
     * spoza listy jest pomijany: drużyna usunięta nie ma wiersza, więc jej
     * przeciwnik też nie dostaje za niego punktów.
     *
     * @param  Collection<int, Team>  $teams
     * @param  Collection<int, GameMatch>  $finished
     * @return array<int, StandingRow> po `team.id`
     */
    private function tally(Collection $teams, Collection $finished): array
    {
        $rows = [];

        foreach ($teams as $team) {
            $rows[$team->id] = new StandingRow($team);
        }

        foreach ($finished as $match) {
            $home = $rows[$match->home_team_id] ?? null;
            $away = $rows[$match->away_team_id] ?? null;

            if ($home === null || $away === null) {
                continue;
            }

            $home->record($match->home_score, $match->away_score, $this->points);
            $away->record($match->away_score, $match->home_score, $this->points);
        }

        return $rows;
    }

    /**
     * Układa remisującą grupę od kryterium o numerze `$criterion`.
     *
     * @param  list<StandingRow>  $rows
     * @param  Collection<int, GameMatch>  $matches
     * @return list<StandingRow>
     */
    private function rank(array $rows, int $criterion, Collection $matches): array
    {
        if (count($rows) < 2) {
            return $rows;
        }

        $code = $this->tiebreakers[$criterion] ?? null;

        if ($code === null) {
            return $this->byName($rows);
        }

        $tiers = $code === 'head_to_head'
            ? $this->headToHeadTiers($rows, $matches)
            : $this->tiers($rows, fn (StandingRow $row): array => [$this->value($row, $code)]);

        $ranked = [];

        foreach ($tiers as $tier) {
            array_push($ranked, ...$this->rank($tier, $criterion + 1, $matches));
        }

        return $ranked;
    }

    /**
     * Wartość kryterium; wyżej staje drużyna z większą. Przy `score_against`
     * mniej straconych to lepiej, więc znak jest odwrócony.
     */
    private function value(StandingRow $row, string $code): int
    {
        return match ($code) {
            'points' => $row->points,
            'score_diff' => $row->scoreDifference(),
            'score_for' => $row->scoreFor,
            'score_against' => -$row->scoreAgainst,
            'wins' => $row->won,
            default => throw new RuntimeException("Nieznane kryterium kolejności: {$code}."),
        };
    }

    /**
     * Mini-tabela z zakończonych meczów między remisującymi. Dopóki któryś
     * z ich meczów w tabeli nie jest zakończony, kryterium nie rozstrzyga
     * niczego i cała grupa idzie dalej razem.
     *
     * @param  list<StandingRow>  $rows
     * @param  Collection<int, GameMatch>  $matches
     * @return list<list<StandingRow>>
     */
    private function headToHeadTiers(array $rows, Collection $matches): array
    {
        $ids = array_map(fn (StandingRow $row): int => $row->team->id, $rows);

        $between = $matches->filter(fn (GameMatch $match): bool => in_array($match->home_team_id, $ids, true)
            && in_array($match->away_team_id, $ids, true));

        if ($between->contains(fn (GameMatch $match): bool => ! $match->isFinished())) {
            return [$rows];
        }

        $mini = $this->tally(
            collect($rows)->map(fn (StandingRow $row): Team => $row->team),
            $between,
        );

        return $this->tiers($rows, function (StandingRow $row) use ($mini): array {
            $record = $mini[$row->team->id];

            return [$record->points, $record->scoreDifference(), $record->scoreFor];
        });
    }

    /**
     * Dzieli wiersze na grupy o równym kluczu, od najlepszej. Klucze to listy
     * liczb tej samej długości, porównywane po kolei; większy jest lepszy.
     *
     * @param  list<StandingRow>  $rows
     * @param  Closure(StandingRow): list<int>  $key
     * @return list<list<StandingRow>>
     */
    private function tiers(array $rows, Closure $key): array
    {
        usort($rows, fn (StandingRow $a, StandingRow $b): int => $key($b) <=> $key($a));

        $tiers = [];
        $previous = null;

        foreach ($rows as $row) {
            $current = $key($row);

            if ($current !== $previous) {
                $tiers[] = [];
                $previous = $current;
            }

            $tiers[array_key_last($tiers)][] = $row;
        }

        return $tiers;
    }

    /**
     * Nazwa po polsku („Legia” < „Łódź” < „Mazur”), bez rozróżniania
     * wielkości liter (siła `SECONDARY`), a przy tej samej nazwie `team.id`.
     *
     * @param  list<StandingRow>  $rows
     * @return list<StandingRow>
     */
    private function byName(array $rows): array
    {
        $collator = new Collator('pl_PL');
        $collator->setStrength(Collator::SECONDARY);

        usort($rows, fn (StandingRow $a, StandingRow $b): int => $collator->compare($a->team->name, $b->team->name)
            ?: $a->team->id <=> $b->team->id);

        return $rows;
    }
}
