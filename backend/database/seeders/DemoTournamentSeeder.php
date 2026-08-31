<?php

namespace Database\Seeders;

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Round;
use App\Models\Sport;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use App\Models\Venue;
use Illuminate\Database\Seeder;

/**
 * Turniej demo: „Liga Osiedlowa 2026" pod `/t/liga-osiedlowa-2026`.
 *
 * To ten sam turniej, który serwuje mock kontraktu — dane są przepisane
 * z przykładów w `packages/api-contract/openapi.yaml`, żeby `apps/public`
 * pokazywało to samo niezależnie od tego, w co celuje (decyzja z ticketu #9).
 *
 * Przykłady w kontrakcie przeczyły dotąd same sobie: lista meczów pokazywała
 * kolejkę 2 jako nierozegraną, a tabela liczyła każdej drużynie dwa mecze.
 * Rozstrzygnięcie poszło na korzyść **tabeli**, bo to ona jest treścią strony
 * publicznej — pierwsza runda (kolejki 1–3) jest rozegrana, rewanże (kolejki
 * 4–6) czekają w terminarzu — i przykłady w `openapi.yaml` zostały do tego
 * doprowadzone w tej samej zmianie. Kto rusza dane niżej, poprawia najpierw
 * kontrakt (kolejność z rootowego `AGENTS.md`), bo to on karmi mock.
 *
 * Sporty sieje migracja, nie ten seeder — są danymi systemowymi (decyzja #10).
 *
 * Seeder jest idempotentny: wszystko wisi na turnieju o stałym slugu, więc
 * powtórne `db:seed` na stojącej bazie odświeża demo zamiast wywalać się na
 * unikacie.
 */
class DemoTournamentSeeder extends Seeder
{
    /** Rozegrana pierwsza runda: [kolejka, gospodarz, gość, bramki gospodarza, bramki gościa, termin]. */
    private const RESULTS = [
        [1, 'Wilki Bemowo', 'Sokoły Ursus', 2, 1, '2026-09-06 12:00:00'],
        [2, 'Orły Bielany', 'Wilki Bemowo', 0, 3, '2026-09-13 12:00:00'],
        [3, 'Sokoły Ursus', 'Orły Bielany', 2, 1, '2026-09-20 12:00:00'],
    ];

    /**
     * Rewanże, jeszcze nierozegrane: [kolejka, gospodarz, gość, termin, obiekt].
     * Ostatnia kolejka nie ma jeszcze obiektu — `venue` jest w kontrakcie polem
     * opcjonalnym i demo ma pokazywać także ten przypadek.
     */
    private const FIXTURES = [
        [4, 'Sokoły Ursus', 'Wilki Bemowo', '2026-09-27 12:00:00', true],
        [5, 'Wilki Bemowo', 'Orły Bielany', '2026-10-04 12:00:00', true],
        [6, 'Orły Bielany', 'Sokoły Ursus', '2026-10-11 12:00:00', false],
    ];

    /**
     * Zdarzenia meczowe: [kolejka, zawodnik, typ, minuta]. Bramki muszą sumować
     * się do wyniku meczu — inaczej klasyfikacja strzelców i tabela mówiłyby
     * o tym samym meczu co innego. Najwięcej ma Marek Nowak, tak jak
     * w przykładzie `GET /public/t/{slug}/top-scorers`.
     */
    private const EVENTS = [
        [1, 'Marek Nowak', 'goal', 12],
        [1, 'Marek Nowak', 'goal', 58],
        [1, 'Adam Zieliński', 'goal', 34],
        [1, 'Tomasz Lis', 'yellow_card', 71],
        [2, 'Marek Nowak', 'goal', 21],
        [2, 'Jakub Wrona', 'goal', 63],
        [2, 'Marek Nowak', 'goal', 77],
        [3, 'Adam Zieliński', 'goal', 15],
        [3, 'Tomasz Lis', 'goal', 70],
        [3, 'Rafał Duda', 'goal', 44],
    ];

    /**
     * Składy: drużyna => [nazwisko, numer, pozycja]. Kolejność ma znaczenie —
     * wyznacza id, a te padają w przykładach `GET /teams/{team}/players`
     * i `GET /public/t/{slug}/top-scorers`.
     */
    private const SQUADS = [
        'Wilki Bemowo' => [
            ['Marek Nowak', 9, 'napastnik'],
            ['Piotr Kowal', 1, 'bramkarz'],
            ['Jakub Wrona', 7, 'pomocnik'],
        ],
        'Sokoły Ursus' => [
            ['Tomasz Lis', 5, 'obrońca'],
            ['Adam Zieliński', 11, 'napastnik'],
            ['Michał Sowa', 12, 'bramkarz'],
        ],
        'Orły Bielany' => [
            ['Rafał Duda', 10, 'napastnik'],
            ['Kamil Zając', 3, 'obrońca'],
            ['Bartosz Jodła', 22, 'bramkarz'],
        ],
    ];

    public function run(): void
    {
        // Konto z przykładu `POST /login` w kontrakcie — tym samym loginem
        // klika się po panelu na mocku i na Laravelu. Hasło idzie jawne:
        // hashuje je cast `hashed` na modelu, tak samo jak przy rejestracji.
        $organizer = User::firstOrCreate(
            ['email' => 'dawid@example.com'],
            ['name' => 'Dawid Patko', 'password' => 'tajnehaslo123'],
        );

        $football = Sport::firstWhere('code', 'football');

        $tournament = Tournament::updateOrCreate(
            ['slug' => 'liga-osiedlowa-2026'],
            [
                'user_id' => $organizer->id,
                'sport_id' => $football->id,
                'name' => 'Liga Osiedlowa 2026',
                'logo_url' => null,
                'primary_color' => '#1F7A45',
                'points' => $football->defaultPoints(),
                'tiebreakers' => $football->defaultTiebreakers(),
                'status' => 'active',
            ],
        );

        // Poddrzewo turnieju idzie od zera przy każdym seedowaniu: kasowanie
        // meczów zwalnia unikat `(round_id, match_number)`, a przy okazji nie
        // trzeba dopasowywać istniejących wierszy do stałych wyżej. Guard
        // rozegranych meczów pilnuje bytów kasowanych ręcznie z panelu i tego
        // czyszczenia nie dotyczy — leci kaskadą po fazie.
        $tournament->stages()->delete();

        $stage = Stage::create([
            'tournament_id' => $tournament->id,
            'type' => 'league',
            'name' => 'Faza zasadnicza',
            'order' => 1,
        ]);

        $venue = Venue::updateOrCreate(
            ['tournament_id' => $tournament->id, 'name' => 'Boisko Bemowo'],
            ['address' => 'ul. Obrońców Tobruku 40, Warszawa'],
        );

        $teams = [];
        $players = [];

        foreach (self::SQUADS as $teamName => $squad) {
            $team = Team::updateOrCreate(
                ['tournament_id' => $tournament->id, 'name' => $teamName],
                ['group_id' => null, 'logo_url' => null],
            );
            $teams[$teamName] = $team;

            foreach ($squad as [$playerName, $number, $position]) {
                $players[$playerName] = Player::updateOrCreate(
                    ['team_id' => $team->id, 'name' => $playerName],
                    ['number' => $number, 'position' => $position],
                );
            }
        }

        $matches = [];

        foreach (self::RESULTS as [$roundNumber, $home, $away, $homeScore, $awayScore, $kickoff]) {
            $matches[$roundNumber] = $this->createMatch(
                $stage, $roundNumber, $teams[$home], $teams[$away], $kickoff, $venue,
                homeScore: $homeScore, awayScore: $awayScore,
            );
        }

        foreach (self::FIXTURES as [$roundNumber, $home, $away, $kickoff, $atVenue]) {
            $this->createMatch(
                $stage, $roundNumber, $teams[$home], $teams[$away], $kickoff,
                $atVenue ? $venue : null,
            );
        }

        foreach (self::EVENTS as [$roundNumber, $playerName, $type, $minute]) {
            $player = $players[$playerName];

            MatchEvent::create([
                'match_id' => $matches[$roundNumber]->id,
                'team_id' => $player->team_id,
                'player_id' => $player->id,
                'type' => $type,
                'minute' => $minute,
            ]);
        }
    }

    /**
     * Mecz razem z jego kolejką: w lidze demo każda kolejka ma dokładnie jeden
     * mecz, więc jedno bez drugiego nie powstaje. Wynik podany oznacza mecz
     * rozegrany — innego stanu to demo nie potrzebuje.
     */
    private function createMatch(
        Stage $stage,
        int $roundNumber,
        Team $home,
        Team $away,
        string $kickoff,
        ?Venue $venue,
        ?int $homeScore = null,
        ?int $awayScore = null,
    ): GameMatch {
        $round = Round::create([
            'stage_id' => $stage->id,
            'name' => "Kolejka {$roundNumber}",
            'order' => $roundNumber,
        ]);

        return GameMatch::create([
            'round_id' => $round->id,
            'stage_id' => $stage->id,
            'group_id' => null,
            'match_number' => 1,
            'home_team_id' => $home->id,
            'away_team_id' => $away->id,
            'home_score' => $homeScore,
            'away_score' => $awayScore,
            'status' => $homeScore === null ? 'scheduled' : 'finished',
            'kickoff_at' => $kickoff,
            'venue_id' => $venue?->id,
        ]);
    }
}
