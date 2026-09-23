<?php

use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

it('odmawia listy turniejów bez tokenu', function () {
    $this->getJson('/api/v1/tournaments')
        ->assertValidRequest()
        ->assertValidResponse(401);
});

// Turniej jest korzeniem własności (decyzja #5) — lista cudzych turniejów
// byłaby wyciekiem danych innego organizera, nie drobnym błędem filtra.
it('pokazuje organizerowi wyłącznie jego turnieje', function () {
    $organizerA = User::factory()->create();
    $organizerB = User::factory()->create();
    $ofA = Tournament::factory()->count(2)->for($organizerA)->create();
    $ofB = Tournament::factory()->for($organizerB)->create();

    actingAsOrganizer($organizerB)
        ->getJson('/api/v1/tournaments')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$ofB->id])
        ->assertJsonPath('meta.total', 1);

    // Strażnik trzyma raz rozwiązanego użytkownika do końca testu, więc bez
    // tego drugie żądanie poszłoby jako B mimo tokenu A.
    Auth::forgetGuards();

    actingAsOrganizer($organizerA)
        ->getJson('/api/v1/tournaments')
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('data.*.id', $ofA->pluck('id')->sortDesc()->values()->all());
});

it('oddaje turniej w kształcie z kontraktu, z liczbą drużyn', function () {
    $organizer = User::factory()->create();
    $tournament = Tournament::factory()->basketball()->for($organizer)->create([
        'name' => 'Puchar Zimowy',
        'slug' => 'puchar-zimowy',
        'primary_color' => '#1F7A45',
    ]);
    Team::factory()->count(3)->for($tournament)->create();

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.slug', 'puchar-zimowy')
        ->assertJsonPath('data.0.sport', ['id' => $tournament->sport_id, 'code' => 'basketball', 'name' => 'Koszykówka'])
        ->assertJsonPath('data.0.branding', ['logoUrl' => null, 'primaryColor' => '#1F7A45'])
        ->assertJsonPath('data.0.teamsCount', 3);
});

it('stronicuje domyślnie po 20 i opisuje stronę w meta', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->count(21)->for($organizer)->create();

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonCount(20, 'data')
        ->assertJsonPath('meta', ['currentPage' => 1, 'lastPage' => 2, 'perPage' => 20, 'total' => 21]);

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments?page=2')
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('meta.currentPage', 2);
});

// Kontrakt nie przewiduje przy tej liście 422, więc `perPage` spoza granic
// jest dociągane do nich, zamiast wracać błędem, którego klient nie zna.
// `assertValidRequest()` celowo nie ma: żądanie łamie `maximum` z założenia.
it('nie oddaje więcej niż 100 turniejów na stronę', function () {
    $organizer = User::factory()->create();
    Tournament::factory()->count(101)->for($organizer)->create();

    actingAsOrganizer($organizer)
        ->getJson('/api/v1/tournaments?perPage=500')
        ->assertValidResponse(200)
        ->assertJsonCount(100, 'data')
        ->assertJsonPath('meta.perPage', 100);
});

// Od najnowszego, a przy tym samym `createdAt` — po `id` malejąco. Bez
// drugiego klucza MySQL może zwrócić remisujące wiersze w dowolnej kolejności
// przy każdym zapytaniu z osobna, więc turniej z granicy strony pojawiłby się
// na obu stronach albo na żadnej. Turnieje założone w tej samej sekundzie to
// nie teoria: `created_at` ma sekundową rozdzielczość.
it('układa turnieje od najnowszego i stabilnie dzieli je na strony', function () {
    $organizer = User::factory()->create();

    $older = Tournament::factory()->for($organizer)->create(['created_at' => Carbon::parse('2026-09-01 08:00:00')]);
    $sameMoment = Tournament::factory()->count(5)->for($organizer)
        ->create(['created_at' => Carbon::parse('2026-09-10 07:00:00')]);
    $newest = Tournament::factory()->for($organizer)->create(['created_at' => Carbon::parse('2026-09-20 12:00:00')]);

    $expectedOrder = [
        $newest->id,
        ...$sameMoment->pluck('id')->sortDesc()->values()->all(),
        $older->id,
    ];

    $seen = [];
    foreach ([1, 2, 3] as $page) {
        $seen = [
            ...$seen,
            ...actingAsOrganizer($organizer)
                ->getJson("/api/v1/tournaments?perPage=3&page={$page}")
                ->assertValidRequest()
                ->assertValidResponse(200)
                ->json('data.*.id'),
        ];
    }

    expect($seen)->toBe($expectedOrder);
});
