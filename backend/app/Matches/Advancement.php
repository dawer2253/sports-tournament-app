<?php

namespace App\Matches;

use App\Models\GameMatch;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Awans w drabince (#216): zapis meczu razem z wejściem zwycięzcy do meczu
 * `winner_to_match_id` i przegranego do `loser_to_match_id`, na stronę
 * `advances_to_slot`.
 *
 * Slot meczu zależnego dostaje zawsze tę drużynę, którą wyłania mecz po
 * zmianie: wypełnienie przy `finished`, podmiana przy zmianie zwycięzcy
 * i zerowanie przy powrocie z `finished` to ten sam ruch. Termin, obiekt
 * i druga drużyna meczu zależnego zostają. Ruch idzie tylko wtedy, gdy
 * drużyna w roli się zmienia, więc poprawka bez zmiany zwycięzcy niczego dalej
 * nie dotyka, a slotu po wolnym losie nie dotyka nic, bo nie prowadzi do niego
 * żadna krawędź.
 *
 * **Blokada**: gdy którykolwiek mecz zależny do ruszenia jest rozpoczęty,
 * cała zmiana daje `422` i nic się nie zapisuje. Kaskady dalej niż jeden
 * poziom nie ma, bo rozpoczęty mecz zależny blokuje, a zaplanowany nie ma
 * zwycięzcy, który mógłby awansować.
 */
final class Advancement
{
    /**
     * Mecz źródłowy i mecze zależne idą pod blokadą wierszy w jednej
     * transakcji, w kolejności krawędzi (źródło przed celem), więc dwa
     * równoległe zapisy w tej samej drabince nie zakleszczą się.
     *
     * @param  array<string, mixed>  $changes  kolumny meczu po walidacji
     * @param  string  $blockKey  klucz błędu blokady: `homeScore` albo `status`
     *
     * @throws ValidationException zmiana zwycięzcy przy rozpoczętym meczu zależnym
     */
    public function save(GameMatch $match, array $changes, string $blockKey): GameMatch
    {
        return DB::transaction(function () use ($match, $changes, $blockKey): GameMatch {
            $match = GameMatch::query()->lockForUpdate()->findOrFail($match->id);
            $before = ['winner' => $match->teamIdOf('winner'), 'loser' => $match->teamIdOf('loser')];
            $match->fill($changes);

            /** @var list<array{GameMatch, ?int}> $moves */
            $moves = [];
            foreach (['winner' => $match->winner_to_match_id, 'loser' => $match->loser_to_match_id] as $role => $targetId) {
                $team = $match->teamIdOf($role);

                if ($targetId !== null && $team !== $before[$role]) {
                    $moves[] = [GameMatch::query()->lockForUpdate()->findOrFail($targetId), $team];
                }
            }

            $started = array_filter($moves, fn (array $move): bool => in_array($move[0]->status, GameMatch::STARTED_STATUSES, true));

            if ($started !== []) {
                throw ValidationException::withMessages([$blockKey => $this->blockMessage(array_column($started, 0))]);
            }

            $match->save();

            foreach ($moves as [$target, $team]) {
                $target->update(["{$match->advances_to_slot}_team_id" => $team]);
            }

            return $match;
        });
    }

    /**
     * „Zwycięzca zagrał już dalej: Finał (Orły – Wilki), …” — mecze zależne
     * z etykietą pozycji i parą, w kolejności krawędzi: zwycięzca, przegrany.
     *
     * @param  list<GameMatch>  $started
     */
    private function blockMessage(array $started): string
    {
        $listed = array_map(function (GameMatch $match): string {
            $home = $match->homeTeam->name ?? 'Do ustalenia';
            $away = $match->awayTeam->name ?? 'Do ustalenia';

            return "{$match->positionLabel()} ({$home} – {$away})";
        }, $started);

        return 'Zwycięzca zagrał już dalej: '.implode(', ', $listed).'. Cofnij te mecze do zaplanowanych, zanim zmienisz zwycięzcę.';
    }
}
