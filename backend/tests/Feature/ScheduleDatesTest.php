<?php

use App\Models\GameMatch;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\Venue;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// 401, 403 i 404 tej trasy pilnuje `SubtreeAuthorizationTest`.

/** Faza `league` z wygenerowanym terminarzem: `$teams` drużyn, `$meetings` spotkań. */
function scheduleStage(int $teams = 4, int $meetings = 1): Stage
{
    $tournament = Tournament::factory()->create();
    Team::factory()->count($teams)->for($tournament)->create();
    $stage = Stage::factory()->for($tournament)->create();

    actingAsOrganizer($tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/schedule", ['meetings' => $meetings])
        ->assertStatus(201);

    return $stage->refresh();
}

function postDates(Stage $stage, array $body): TestResponse
{
    return actingAsOrganizer($stage->tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/schedule/dates", $body);
}

/**
 * Terminy kolejki po `order`, po `match_number`.
 *
 * @return array<int, list<string>>
 */
function roundKickoffs(Stage $stage): array
{
    return $stage->rounds()->orderBy('order')->with('matches')->get()
        ->mapWithKeys(fn (Round $round): array => [
            $round->order => $round->matches->sortBy('match_number')
                ->map(fn (GameMatch $match): string => $match->kickoff_at->toIso8601String())
                ->values()->all(),
        ])
        ->all();
}

it('rozkłada terminy i obiekty i oddaje liczbę meczów', function () {
    $stage = scheduleStage(4);
    $venues = Venue::factory()->count(2)->for($stage->tournament)->create();

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
        'venueIds' => $venues->pluck('id')->all(),
    ])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data', ['matchesCount' => 6, 'collisionsCount' => 0]);

    $stage->matches()->get()->each(function (GameMatch $match): void {
        expect($match->kickoff_at)->not->toBeNull()
            ->and($match->venue_id)->not->toBeNull();
    });
});

it('w trybie interval trzyma godzinę zegarową przez zmianę czasu', function () {
    $stage = scheduleStage(4);

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-10-18T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])->assertValidResponse(200);

    $kickoffs = roundKickoffs($stage);

    // 10:00 Warszawa to 08:00 UTC przed zmianą czasu (25 października)
    // i 09:00 UTC po niej — dzięki temu kolejka 2 i 3 różnią się offsetem.
    expect($kickoffs[1])->toBe(['2026-10-18T08:00:00+00:00', '2026-10-18T08:00:00+00:00'])
        ->and($kickoffs[2])->toBe(['2026-10-25T09:00:00+00:00', '2026-10-25T09:00:00+00:00'])
        ->and($kickoffs[3])->toBe(['2026-11-01T09:00:00+00:00', '2026-11-01T09:00:00+00:00']);
});

it('bez obiektów daje całej kolejce jedną godzinę i venue null', function () {
    $stage = scheduleStage(6);

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])->assertValidResponse(200);

    $kickoffs = roundKickoffs($stage);
    expect($kickoffs[1])->toBe([
        '2026-09-06T08:00:00+00:00',
        '2026-09-06T08:00:00+00:00',
        '2026-09-06T08:00:00+00:00',
    ]);

    expect($stage->matches()->whereNotNull('venue_id')->exists())->toBeFalse();
});

it('z V obiektami żadne dwa mecze fazy nie mają kolizji', function () {
    $stage = scheduleStage(6, 2);
    $venues = Venue::factory()->count(2)->for($stage->tournament)->create();

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
        'venueIds' => $venues->pluck('id')->all(),
    ])->assertValidResponse(200);

    $response = actingAsOrganizer($stage->tournament->user)
        ->getJson("/api/v1/tournaments/{$stage->tournament_id}/matches?perPage=200")
        ->assertValidResponse(200);

    expect(collect($response->json('data'))->pluck('collisions')->flatten())->toBeEmpty();
});

it('w trybie continuous kolejka k+1 nie zaczyna się przed końcem kolejki k', function () {
    $stage = scheduleStage(6);

    postDates($stage, [
        'mode' => 'continuous',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'venueIds' => [],
    ])->assertValidResponse(200);

    $kickoffs = roundKickoffs($stage);
    $duration = $stage->tournament->match_duration;

    for ($order = 1; $order < count($kickoffs); $order++) {
        $lastStart = max(array_map(fn (string $k): int => strtotime($k), $kickoffs[$order]));
        $nextStart = min(array_map(fn (string $k): int => strtotime($k), $kickoffs[$order + 1]));

        expect($nextStart)->toBeGreaterThanOrEqual($lastStart + $duration * 60);
    }
});

it('z dayEndTime żaden mecz nie kończy się po tej godzinie', function () {
    $stage = scheduleStage(6);
    $venue = Venue::factory()->for($stage->tournament)->create();

    postDates($stage, [
        'mode' => 'continuous',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'dayEndTime' => '12:00',
        'venueIds' => [$venue->id],
    ])->assertValidResponse(200);

    $duration = $stage->tournament->match_duration;
    $zone = new DateTimeZone('Europe/Warsaw');

    $stage->matches()->get()->each(function (GameMatch $match) use ($duration, $zone): void {
        $end = $match->kickoff_at->copy()->setTimezone($zone)->addMinutes($duration);
        expect($end->format('H:i'))->toBeLessThanOrEqual('12:00');
    });
});

it('zachowuje termin i obiekt meczów live i finished oraz kolejek przed fromRound', function () {
    $stage = scheduleStage(6);
    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])->assertValidResponse(200);
    $before = roundKickoffs($stage);

    // Kolejka 1 przed `fromRound`, więc stoi. W kolejkach 3 i 4 mecz
    // rozpoczęty: mimo że są w zakresie, termin i obiekt zostają.
    $finished = $stage->rounds()->where('order', 3)->first()
        ->matches()->orderBy('match_number')->first();
    $finished->update(['status' => 'finished', 'home_score' => 2, 'away_score' => 1]);
    $live = $stage->rounds()->where('order', 4)->first()
        ->matches()->orderBy('match_number')->first();
    $live->update(['status' => 'live', 'home_score' => 0, 'away_score' => 0]);

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2027-01-03T10:00:00+01:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
        'fromRound' => 3,
    ])->assertValidResponse(200);
    $after = roundKickoffs($stage);

    expect($after[1])->toBe($before[1])
        ->and($after[2])->toBe($before[2])
        ->and($finished->fresh()->kickoff_at->toIso8601String())->toBe($before[3][0])
        ->and($live->fresh()->kickoff_at->toIso8601String())->toBe($before[4][0])
        // Zaplanowane mecze kolejki 3 dostały nowy termin.
        ->and($after[3][1])->toBe('2027-01-03T09:00:00+00:00');
});

it('odmawia z 422, gdy faza nie ma terminarza', function () {
    $tournament = Tournament::factory()->create();
    $stage = Stage::factory()->for($tournament)->create();

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])
        ->assertValidResponse(422)
        ->assertJsonPath('errors.stage', ['Faza nie ma jeszcze terminarza, więc nie ma czego rozkładać.']);
});

it('odrzuca startAt bez offsetu i przyjmuje offset, przeliczając na UTC', function () {
    $stage = scheduleStage(4);

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor('startAt');

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T12:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])->assertValidResponse(200);

    expect($stage->matches()->orderBy('id')->first()->kickoff_at->toIso8601String())
        ->toBe('2026-09-06T10:00:00+00:00');
});

it('odrzuca obiekty obce, usunięte, powtórzone i ponad limit', function () {
    $stage = scheduleStage(4);
    $own = Venue::factory()->for($stage->tournament)->create();
    $foreign = Venue::factory()->create();

    $removed = Venue::factory()->for($stage->tournament)->create();
    $removed->delete();

    $tooMany = Venue::factory()->count(21)->for($stage->tournament)->create()->pluck('id')->all();

    $base = [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ];

    postDates($stage, [...$base, 'venueIds' => [$foreign->id]])
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor('venueIds');

    postDates($stage, [...$base, 'venueIds' => [$removed->id]])
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor('venueIds');

    postDates($stage, [...$base, 'venueIds' => [$own->id, $own->id]])
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor('venueIds.1');

    postDates($stage, [...$base, 'venueIds' => $tooMany])
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor('venueIds');
});

it('pilnuje pól zależnych od trybu i poprawnego ciała', function (array $body, string $field) {
    $stage = scheduleStage(4);

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        ...$body,
    ])
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor($field);
})->with([
    'brak intervalDays' => [[], 'intervalDays'],
    'dayEndTime przy interval' => [['intervalDays' => 7, 'dayEndTime' => '18:00'], 'dayEndTime'],
    'zła strefa' => [['intervalDays' => 7, 'timeZone' => 'Mars/Olympus'], 'timeZone'],
    'zły tryb' => [['mode' => 'ciagiem', 'intervalDays' => 7], 'mode'],
    'fromRound ujemny' => [['intervalDays' => 7, 'fromRound' => 0], 'fromRound'],
]);

it('odrzuca intervalDays przy trybie continuous', function () {
    $stage = scheduleStage(4);

    postDates($stage, [
        'mode' => 'continuous',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])
        ->assertValidResponse(422)
        ->assertJsonValidationErrorFor('intervalDays');
});

it('zmiana matchDuration nie przesuwa żadnego terminu', function () {
    $stage = scheduleStage(4);
    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])->assertValidResponse(200);
    $before = $stage->matches()->orderBy('id')->pluck('kickoff_at')->map(fn ($date) => $date->toIso8601String())->all();

    actingAsOrganizer($stage->tournament->user)
        ->patchJson("/api/v1/tournaments/{$stage->tournament_id}", ['matchDuration' => 90])
        ->assertValidResponse(200)
        ->assertJsonPath('data.matchDuration', 90);

    expect($stage->matches()->orderBy('id')->pluck('kickoff_at')->map(fn ($date) => $date->toIso8601String())->all())->toBe($before);
});

it('rozkłada od kolejki z fromRound, licząc startAt od pierwszej rozkładanej', function () {
    $stage = scheduleStage(6);
    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-09-06T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
    ])->assertValidResponse(200);
    $before = roundKickoffs($stage);

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2027-05-02T10:00:00+02:00',
        'timeZone' => 'Europe/Warsaw',
        'intervalDays' => 7,
        'fromRound' => 3,
    ])->assertValidResponse(200);
    $after = roundKickoffs($stage);

    expect($after[1])->toBe($before[1])
        ->and($after[2])->toBe($before[2])
        ->and($after[3])->toBe([
            '2027-05-02T08:00:00+00:00',
            '2027-05-02T08:00:00+00:00',
            '2027-05-02T08:00:00+00:00',
        ])
        ->and($after[4])->toBe([
            '2027-05-09T08:00:00+00:00',
            '2027-05-09T08:00:00+00:00',
            '2027-05-09T08:00:00+00:00',
        ]);
});

// Niezmiennik 10 z #215: mecz o 3. miejsce gra przed finałem, choć ma wyższy
// `match_number`. Jeden obiekt, więc mecze rundy idą slot po slocie.
it('w rundzie finału daje meczowi o 3. miejsce termin przed finałem', function () {
    $tournament = Tournament::factory()->create(['match_duration' => 60]);
    $teams = Team::factory()->count(4)->for($tournament)->create();
    $stage = Stage::factory()->knockout()->for($tournament)->create();
    $venue = Venue::factory()->for($tournament)->create();
    actingAsOrganizer($tournament->user)
        ->postJson("/api/v1/stages/{$stage->id}/bracket", ['teamIds' => $teams->pluck('id')->all(), 'thirdPlaceMatch' => true])
        ->assertStatus(201);

    postDates($stage, [
        'mode' => 'interval',
        'startAt' => '2026-10-04T10:00:00+00:00',
        'timeZone' => 'UTC',
        'intervalDays' => 7,
        'venueIds' => [$venue->id],
    ])->assertValidResponse(200);

    $final = $stage->rounds()->where('order', 2)->firstOrFail()->matches()->get()->keyBy('match_number');
    expect($final[2]->kickoff_at->toIso8601String())->toBe('2026-10-11T10:00:00+00:00')
        ->and($final[1]->kickoff_at->toIso8601String())->toBe('2026-10-11T11:00:00+00:00');
});
