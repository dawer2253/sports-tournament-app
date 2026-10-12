<?php

namespace Database\Seeders;

use App\Models\GameMatch;
use App\Models\MatchEvent;
use App\Models\Player;
use App\Models\Sport;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use App\Models\Venue;
use Illuminate\Database\Seeder;

/**
 * Turniej demo: „Liga Osiedlowa 2026" pod `/t/liga-osiedlowa-2026`, a obok
 * niego, od #176, „Liga Koszykówki 2026" pod `/t/liga-koszykowki-2026`.
 *
 * To te same turnieje, które serwuje mock kontraktu — dane są przepisane
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
 *
 * Id fazy, kolejek i meczów przydziela autoinkrement. Na świeżej bazie
 * (`make fresh`) demo jest pierwszym turniejem, więc dostaje te same id co
 * w przykładach kontraktu (`stageId: 1`, kolejki i mecze 1–6). Powtórne
 * `db:seed` na stojącej bazie odtwarza poddrzewo pod nowymi id — i to jest
 * cena przyjęta świadomie. Wcześniej seed nadawał te id na sztywno, ale od
 * kiedy organizer zakłada turnieje przez API (#47), najniższe id może zająć
 * jego turniej i seed padał na duplikacie klucza. Zgodność id z mockiem nie
 * jest warta wywracania seeda na bazie, na której ktoś pracuje: strona
 * publiczna adresuje turniej slugiem, nie id.
 */
class DemoTournamentSeeder extends Seeder
{
    /**
     * Rozegrana pierwsza runda: [kolejka, gospodarz, gość, bramki gospodarza,
     * bramki gościa, termin].
     *
     * Terminy są **w UTC**, bo na UTC stoi aplikacja (`config/app.php`), i tak
     * samo zapisuje je dziś kontrakt: `10:00+00:00` w `openapi.yaml` to mecz
     * umówiony na południe czasu polskiego. Zapisanie tu `12:00` przesunęłoby
     * mecze o dwie godziny względem mocka.
     */
    private const RESULTS = [
        [1, 'Wilki Bemowo', 'Sokoły Ursus', 2, 1, '2026-09-06 10:00:00'],
        [2, 'Orły Bielany', 'Wilki Bemowo', 0, 3, '2026-09-13 10:00:00'],
        [3, 'Sokoły Ursus', 'Orły Bielany', 2, 1, '2026-09-20 10:00:00'],
    ];

    /**
     * Rewanże, jeszcze nierozegrane: [kolejka, gospodarz, gość, termin (UTC), obiekt].
     * Ostatnia kolejka nie ma jeszcze obiektu — `venue` jest w kontrakcie polem
     * opcjonalnym i demo ma pokazywać także ten przypadek.
     */
    private const FIXTURES = [
        [4, 'Sokoły Ursus', 'Wilki Bemowo', '2026-09-27 10:00:00', true],
        [5, 'Wilki Bemowo', 'Orły Bielany', '2026-10-04 10:00:00', true],
        [6, 'Orły Bielany', 'Sokoły Ursus', '2026-10-11 10:00:00', false],
    ];

    /**
     * Zdarzenia meczowe: [kolejka, zawodnik, typ, minuta]. Bramki muszą sumować
     * się do wyniku meczu — inaczej klasyfikacja strzelców i tabela mówiłyby
     * o tym samym meczu co innego. Samobój należy do drużyny strzelca, a bramkę
     * daje przeciwnikowi (#188, reguła 9). Najwięcej ma Marek Nowak, tak jak
     * w przykładzie `GET /public/t/{slug}/top-scorers`.
     *
     * Kolejka 1 to przykład `pilka` w `GET /matches/{match}/events`: kolejność
     * wierszy wyznacza id z tamtego przykładu.
     */
    private const EVENTS = [
        [1, 'Marek Nowak', 'goal', 12],
        [1, 'Tomasz Lis', 'own_goal', 58],
        [1, 'Adam Zieliński', 'goal', 34],
        [1, 'Tomasz Lis', 'yellow_card', 71],
        [2, 'Marek Nowak', 'goal', 21],
        [2, 'Jakub Wrona', 'goal', 63],
        [2, 'Marek Nowak', 'goal', 77],
        [3, 'Adam Zieliński', 'goal', 15],
        [3, 'Tomasz Lis', 'goal', 70],
        [3, 'Rafał Duda', 'goal', 44],
    ];

    /** Obiekty: [nazwa, adres]. */
    private const VENUES = [
        ['Boisko Bemowo', 'ul. Powstańców Śląskich 1, Warszawa'],
        ['Hala Ursus', 'ul. Sosnkowskiego 3, Warszawa'],
    ];

    /**
     * Liga koszykówki demo — drugi turniej tego samego organizera. Drużyny
     * i wyniki są przepisane z przykładu `koszykowka` listy meczów i tabeli
     * panelu: dwa mecze Żubry Wola – Rysie Mokotów, razem 168:141. Jest po to,
     * żeby dało się pokazać regułę „bez remisów” z okna meczu (#159) na
     * danych z seeda, a nie z fabryki.
     *
     * Rozegrane mecze: [kolejka, gospodarz, gość, punkty gospodarza, punkty
     * gościa, termin (UTC)], jak `RESULTS` przy piłce.
     */
    private const BASKETBALL_RESULTS = [
        [1, 'Żubry Wola', 'Rysie Mokotów', 90, 70, '2026-09-06 16:00:00'],
        [2, 'Rysie Mokotów', 'Żubry Wola', 71, 78, '2026-09-13 16:00:00'],
    ];

    /** Drużyny ligi koszykówki, w kolejności z przykładu (id 4 i 5 w mocku). */
    private const BASKETBALL_TEAMS = ['Żubry Wola', 'Rysie Mokotów'];

    /**
     * Składy koszykarzy: drużyna => [nazwisko, numer, pozycja]. Na świeżej
     * bazie dostają id 10–15, po dziewięciu piłkarzach — te id i nazwiska
     * padają w przykładzie `koszykowka` w `GET /matches/{match}/events`.
     */
    private const BASKETBALL_SQUADS = [
        'Żubry Wola' => [
            ['Kacper Lipa', 4, 'rozgrywający'],
            ['Oskar Dąb', 8, 'skrzydłowy'],
            ['Bruno Klon', 15, 'środkowy'],
        ],
        'Rysie Mokotów' => [
            ['Filip Sarna', 6, 'rozgrywający'],
            ['Hubert Łoś', 10, 'skrzydłowy'],
            ['Wiktor Bóbr', 23, 'środkowy'],
        ],
    ];

    /**
     * Kolejne rzuty drużyny w meczu koszykówki (wartości `value`), powtarzane
     * w kółko. Stały wzór zamiast losowania, żeby seed był deterministyczny.
     */
    private const BASKETBALL_SHOT_PATTERN = [2, 2, 3, 1, 2, 3, 2, 1];

    /** Kody typów rzutów po ich `value` (konfiguracja koszykówki). */
    private const BASKETBALL_SHOT_TYPES = [1 => 'free_throw', 2 => 'two_pointer', 3 => 'three_pointer'];

    /** Fauli na drużynę w każdym rozegranym meczu. */
    private const BASKETBALL_FOULS_PER_TEAM = 3;

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
                'logo_path' => null,
                'primary_color' => '#1F7A45',
                'points' => $football->defaultPoints(),
                'tiebreakers' => $football->defaultTiebreakers(),
                'match_duration' => $football->defaultMatchDuration(),
                'status' => 'active',
            ],
        );

        // Poddrzewo turnieju idzie od zera przy każdym seedowaniu: kasowanie
        // meczów zwalnia unikat `(round_id, match_number)`, a przy okazji nie
        // trzeba dopasowywać istniejących wierszy do stałych wyżej. Guard
        // rozegranych meczów pilnuje bytów kasowanych ręcznie z panelu i tego
        // czyszczenia nie dotyczy — leci kaskadą po fazie.
        $tournament->stages()->delete();

        $stage = $tournament->stages()->create([
            'type' => 'league',
            'name' => 'Faza zasadnicza',
            'order' => 1,
        ]);

        // Obiekty są dwa, tak jak w przykładzie `GET /tournaments/{tournament}/venues`.
        // Mecze demo toczą się na pierwszym; drugi istnieje, bo panel obiektów ma
        // mieć na czym pokazać listę dłuższą niż jednoelementowa.
        $venues = [];

        foreach (self::VENUES as [$venueName, $address]) {
            $venues[$venueName] = Venue::updateOrCreate(
                ['tournament_id' => $tournament->id, 'name' => $venueName],
                ['address' => $address],
            );
        }

        $venue = $venues['Boisko Bemowo'];

        $teams = [];
        $players = [];

        foreach (self::SQUADS as $teamName => $squad) {
            $team = Team::updateOrCreate(
                ['tournament_id' => $tournament->id, 'name' => $teamName],
                ['group_id' => null, 'logo_path' => null],
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

        $this->seedBasketball($organizer);
    }

    /**
     * Drugi turniej demo: liga koszykówki tego samego organizera. Poddrzewo
     * powstaje od zera przy każdym seedowaniu, jak przy piłce, więc powtórne
     * `db:seed` odświeża dane zamiast dublować turniej.
     */
    private function seedBasketball(User $organizer): void
    {
        $basketball = Sport::firstWhere('code', 'basketball');

        $tournament = Tournament::updateOrCreate(
            ['slug' => 'liga-koszykowki-2026'],
            [
                'user_id' => $organizer->id,
                'sport_id' => $basketball->id,
                'name' => 'Liga Koszykówki 2026',
                'logo_path' => null,
                'primary_color' => '#1F7A45',
                'points' => $basketball->defaultPoints(),
                'tiebreakers' => $basketball->defaultTiebreakers(),
                'match_duration' => $basketball->defaultMatchDuration(),
                'status' => 'active',
            ],
        );

        $tournament->stages()->delete();

        $stage = $tournament->stages()->create([
            'type' => 'league',
            'name' => 'Faza zasadnicza',
            'order' => 1,
        ]);

        $venue = Venue::updateOrCreate(
            ['tournament_id' => $tournament->id, 'name' => 'Hala Bemowo'],
            ['address' => 'ul. Powstańców Śląskich 1, Warszawa'],
        );

        $teams = [];
        $squads = [];

        foreach (self::BASKETBALL_TEAMS as $teamName) {
            $teams[$teamName] = Team::updateOrCreate(
                ['tournament_id' => $tournament->id, 'name' => $teamName],
                ['group_id' => null, 'logo_path' => null],
            );

            $squads[$teamName] = array_map(
                fn (array $player): Player => Player::updateOrCreate(
                    ['team_id' => $teams[$teamName]->id, 'name' => $player[0]],
                    ['number' => $player[1], 'position' => $player[2]],
                ),
                self::BASKETBALL_SQUADS[$teamName],
            );
        }

        foreach (self::BASKETBALL_RESULTS as [$roundNumber, $home, $away, $homeScore, $awayScore, $kickoff]) {
            $match = $this->createMatch(
                $stage, $roundNumber, $teams[$home], $teams[$away], $kickoff, $venue,
                homeScore: $homeScore, awayScore: $awayScore,
            );

            $this->seedBasketballEvents($match, [
                [$squads[$home], $homeScore],
                [$squads[$away], $awayScore],
            ]);
        }
    }

    /**
     * Rzuty i faule meczu koszykówki (#188). Suma `value` rzutów drużyny daje
     * jej wynik — inaczej klasyfikacja „Punkty” rozjechałaby się z tabelą,
     * choć API zgodności nie wymaga. Rzuty idą po kolei przez skład, a ostatni
     * dostaje taką wartość, żeby suma wyszła równo.
     *
     * Minuty rozkładamy po czterdziestu minutach meczu, a wiersze wstawiamy
     * w kolejności minut, żeby lista z API i kolejność id mówiły to samo.
     *
     * @param  list<array{list<Player>, int}>  $sides  [skład, wynik] gospodarza i gościa
     */
    private function seedBasketballEvents(GameMatch $match, array $sides): void
    {
        $events = [];

        foreach ($sides as [$squad, $score]) {
            $shots = [];

            for ($left = $score, $i = 0; $left > 0; $i++) {
                $value = min(self::BASKETBALL_SHOT_PATTERN[$i % count(self::BASKETBALL_SHOT_PATTERN)], $left);
                $shots[] = $value;
                $left -= $value;
            }

            foreach ($shots as $i => $value) {
                $player = $squad[$i % count($squad)];
                $events[] = [$player, self::BASKETBALL_SHOT_TYPES[$value], intdiv($i * 40, count($shots)) + 1];
            }

            for ($i = 0; $i < self::BASKETBALL_FOULS_PER_TEAM; $i++) {
                $events[] = [$squad[$i % count($squad)], 'foul', 10 * $i + 5];
            }
        }

        usort($events, fn (array $a, array $b): int => $a[2] <=> $b[2]);

        foreach ($events as [$player, $type, $minute]) {
            MatchEvent::create([
                'match_id' => $match->id,
                'team_id' => $player->team_id,
                'player_id' => $player->id,
                'type' => $type,
                'minute' => $minute,
            ]);
        }
    }

    /**
     * Mecz razem z jego kolejką: w lidze demo każda kolejka ma dokładnie jeden
     * mecz, więc jedno bez drugiego nie powstaje. Wynik podany oznacza mecz rozegrany — innego stanu to demo
     * nie potrzebuje.
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
        $round = $stage->rounds()->create([
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
