<?php

use App\Models\GameMatch;
use App\Models\Group;
use App\Models\Round;
use App\Models\Stage;
use App\Models\Team;
use App\Models\TeamRegistration;
use App\Models\Tournament;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Zgłoszenia drużyn (#300)
|--------------------------------------------------------------------------
|
| Zgłaszający wysyła zgłoszenie ze strony publicznej, bez tokenu, a organizer
| przyjmuje je (wtedy powstaje drużyna) albo odrzuca w panelu. 401, 403
| i 404 tras panelu pilnuje `SubtreeAuthorizationTest`. Helpery lądują
| w globalnej przestrzeni nazw Pesta, stąd prefiks `registration`.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

/** @return array<string, mixed> */
function registrationBody(array $overrides = []): array
{
    return [
        'teamName' => 'Lwy Mokotów',
        'contactName' => 'Anna Wiśniewska',
        'contactEmail' => 'anna.wisniewska@example.com',
        'contactPhone' => '+48 600 100 200',
        'players' => [
            ['name' => 'Paweł Lis', 'number' => 1],
            ['name' => 'Kamil Dąb', 'number' => 9],
            ['name' => 'Igor Wrzos', 'number' => null],
        ],
        'consent' => true,
        ...$overrides,
    ];
}

function postRegistrationTo(Tournament $tournament, array $body): TestResponse
{
    return test()->postJson("/api/v1/public/t/{$tournament->slug}/registrations", $body);
}

function startMatchIn(Tournament $tournament): void
{
    GameMatch::factory()->live()->for(Round::factory()->for(Stage::factory()->for($tournament)))->create();
}

/*
| Wysłanie ze strony publicznej
*/

it('przyjmuje zgłoszenie przy otwartych zapisach i oddaje potwierdzenie bez danych osobowych', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();

    postRegistrationTo($tournament, registrationBody())
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertExactJson(['data' => ['teamName' => 'Lwy Mokotów']]);

    $registration = $tournament->registrations()->sole();
    expect($registration)
        ->status->toBe('pending')
        ->team_name->toBe('Lwy Mokotów')
        ->contact_name->toBe('Anna Wiśniewska')
        ->contact_email->toBe('anna.wisniewska@example.com')
        ->contact_phone->toBe('+48 600 100 200')
        ->players->toBe([
            ['name' => 'Paweł Lis', 'number' => 1],
            ['name' => 'Kamil Dąb', 'number' => 9],
            ['name' => 'Igor Wrzos', 'number' => null],
        ])
        ->team_id->toBeNull()
        ->decided_at->toBeNull();

    // Zgłoszenie nie jest drużyną.
    expect($tournament->teams()->count())->toBe(0);
});

it('przyjmuje zgłoszenie bez telefonu i bez składu', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $body = registrationBody();
    unset($body['contactPhone'], $body['players']);

    postRegistrationTo($tournament, $body)->assertValidResponse(201);

    expect($tournament->registrations()->sole())
        ->contact_phone->toBeNull()
        ->players->toBe([]);
});

it('przyjmuje zgłoszenie przed terminem zapisów', function () {
    $tournament = Tournament::factory()->openForRegistration()->create(['registration_deadline' => now()->addDay()]);

    postRegistrationTo($tournament, registrationBody())->assertValidResponse(201);
});

it('odrzuca zgłoszenie przy zamkniętych zapisach pod kluczem registration', function (Closure $close) {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $close($tournament);

    postRegistrationTo($tournament, registrationBody())
        ->assertValidResponse(422)
        ->assertJsonPath('errors.registration', ['Zapisy do tego turnieju są zamknięte.']);

    expect($tournament->registrations()->count())->toBe(0);
})->with([
    'zapisy wyłączone' => [fn (Tournament $t) => $t->update(['registration_open' => false])],
    'po terminie' => [fn (Tournament $t) => $t->update(['registration_deadline' => now()->subMinute()])],
    'turniej zakończony' => [fn (Tournament $t) => $t->update(['status' => 'finished'])],
    'mecz rozpoczęty' => [fn (Tournament $t) => startMatchIn($t)],
]);

it('oddaje 404 dla turnieju w szkicu, także z otwartymi zapisami', function () {
    $tournament = Tournament::factory()->create(['status' => 'draft', 'registration_open' => true]);

    postRegistrationTo($tournament, registrationBody())
        ->assertValidResponse(404)
        ->assertExactJson(['message' => contractErrorMessage('NotFound')]);
});

it('odrzuca nazwę zajętą przez drużynę turnieju, także inną wielkością liter', function (string $name) {
    $tournament = Tournament::factory()->openForRegistration()->create();
    Team::factory()->for($tournament)->create(['name' => 'Lwy Mokotów']);

    postRegistrationTo($tournament, registrationBody(['teamName' => $name]))
        ->assertValidResponse(422)
        ->assertJsonPath('errors.teamName', ['W tym turnieju jest już drużyna o tej nazwie.']);
})->with(['ta sama' => 'Lwy Mokotów', 'małymi literami' => 'lwy mokotów']);

it('przepuszcza dwa oczekujące zgłoszenia o tej samej nazwie', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();

    postRegistrationTo($tournament, registrationBody())->assertValidResponse(201);
    postRegistrationTo($tournament, registrationBody(['contactEmail' => 'inny@example.com']))->assertValidResponse(201);

    expect($tournament->registrations()->count())->toBe(2);
});

it('odrzuca zgłoszenie do turnieju z kompletem drużyn', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    Team::factory()->count(Tournament::MAX_TEAMS)->for($tournament)->create();

    postRegistrationTo($tournament, registrationBody())
        ->assertValidResponse(422)
        ->assertJsonPath('errors.registration', ['Turniej ma już komplet drużyn.']);
});

it('odrzuca skład ponad limit drużyny', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $players = array_map(fn (int $n): array => ['name' => "Zawodnik {$n}", 'number' => $n], range(1, Team::MAX_PLAYERS + 1));

    postRegistrationTo($tournament, registrationBody(['players' => $players]))
        ->assertValidResponse(422)
        ->assertJsonPath('errors.players', ['Skład mieści najwyżej 50 zawodników.']);
});

it('odrzuca numer powtórzony w składzie, a dwóch zawodników bez numeru przepuszcza', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();

    postRegistrationTo($tournament, registrationBody(['players' => [
        ['name' => 'Paweł Lis', 'number' => 7],
        ['name' => 'Kamil Dąb', 'number' => 7],
    ]]))
        ->assertValidResponse(422)
        ->assertJsonPath('errors', [
            'players.0.number' => ['Ten numer ma już inny zawodnik ze składu.'],
            'players.1.number' => ['Ten numer ma już inny zawodnik ze składu.'],
        ]);

    postRegistrationTo($tournament, registrationBody(['players' => [
        ['name' => 'Paweł Lis', 'number' => null],
        ['name' => 'Kamil Dąb', 'number' => null],
    ]]))->assertValidResponse(201);
});

it('odrzuca zawodnika bez imienia i numer spoza zakresu', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();

    postRegistrationTo($tournament, registrationBody(['players' => [
        ['name' => '', 'number' => 1],
        ['name' => 'Kamil Dąb', 'number' => 1000],
    ]]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['players.0.name', 'players.1.number']);
});

it('odrzuca zgłoszenie bez zgody na przetwarzanie danych', function (array $body) {
    $tournament = Tournament::factory()->openForRegistration()->create();

    postRegistrationTo($tournament, registrationBody($body))
        ->assertStatus(422)
        ->assertJsonPath('errors.consent', ['Zaznacz zgodę na przetwarzanie danych.']);
})->with([
    'false' => [['consent' => false]],
    'napis' => [['consent' => 'tak']],
]);

it('odrzuca zgłoszenie bez danych zgłaszającego', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();

    postRegistrationTo($tournament, registrationBody(['contactName' => '', 'contactEmail' => 'nie-email']))
        ->assertValidResponse(422)
        ->assertJsonValidationErrors(['contactName', 'contactEmail']);
});

it('udaje sukces przy wypełnionym polu-pułapce i niczego nie zapisuje', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();

    postRegistrationTo($tournament, registrationBody(['website' => 'https://spam.example.com']))
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertExactJson(['data' => ['teamName' => 'Lwy Mokotów']]);

    // Nawet ciało, które nie przeszłoby walidacji, nie zdradza botowi pułapki.
    postRegistrationTo($tournament, ['website' => 'x', 'teamName' => ['nie napis']])
        ->assertValidResponse(201);

    expect(TeamRegistration::count())->toBe(0);
});

it('przepuszcza puste pole-pułapkę', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();

    postRegistrationTo($tournament, registrationBody(['website' => '']))->assertValidResponse(201);

    expect($tournament->registrations()->count())->toBe(1);
});

it('oddaje 429 po pięciu zgłoszeniach z jednego IP w godzinie, także do różnych turniejów', function () {
    $first = Tournament::factory()->openForRegistration()->create();
    $second = Tournament::factory()->openForRegistration()->create();

    foreach (range(1, 3) as $n) {
        postRegistrationTo($first, registrationBody(['teamName' => "Drużyna {$n}"]))->assertCreated();
    }
    foreach (range(4, 5) as $n) {
        postRegistrationTo($second, registrationBody(['teamName' => "Drużyna {$n}"]))->assertCreated();
    }

    postRegistrationTo($second, registrationBody(['teamName' => 'Drużyna 6']))
        ->assertValidResponse(429)
        ->assertHeader('Retry-After')
        ->assertExactJson(['message' => contractErrorMessage('TooManyRequests')]);

    expect(TeamRegistration::count())->toBe(5);

    // Inne IP ma własny licznik.
    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2']);
    postRegistrationTo($second, registrationBody(['teamName' => 'Drużyna 7']))->assertCreated();
});

it('nie pokazuje danych zgłaszającego na stronie publicznej', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    postRegistrationTo($tournament, registrationBody())->assertCreated();

    $page = $this->getJson("/api/v1/public/t/{$tournament->slug}")->assertValidResponse(200);

    expect($page->getContent())
        ->not->toContain('anna.wisniewska@example.com')
        ->not->toContain('Anna Wiśniewska')
        ->not->toContain('Paweł Lis');
});

/*
| Stan zapisów na stronie publicznej
*/

it('pokazuje na stronie publicznej zapisy otwarte z terminem', function () {
    $tournament = Tournament::factory()->openForRegistration()->create(['registration_deadline' => '2099-11-15 17:00:00']);

    $this->getJson("/api/v1/public/t/{$tournament->slug}")
        ->assertValidResponse(200)
        ->assertJsonPath('data.registration', ['open' => true, 'deadline' => '2099-11-15T17:00:00+00:00']);
});

it('pokazuje na stronie publicznej zapisy zamknięte, choć organizer je otworzył', function (Closure $close) {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $close($tournament);

    $this->getJson("/api/v1/public/t/{$tournament->slug}")
        ->assertValidResponse(200)
        ->assertJsonPath('data.registration.open', false);
})->with([
    'po terminie' => [fn (Tournament $t) => $t->update(['registration_deadline' => now()->subMinute()])],
    'turniej zakończony' => [fn (Tournament $t) => $t->update(['status' => 'finished'])],
    'mecz rozpoczęty' => [fn (Tournament $t) => startMatchIn($t)],
]);

/*
| Zapisy w ustawieniach turnieju
*/

it('otwiera zapisy z terminem i przelicza termin na UTC', function () {
    $tournament = Tournament::factory()->create();

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", [
            'registration' => ['open' => true, 'deadline' => '2026-11-15T18:00:00+01:00'],
        ])
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->assertJsonPath('data.registration', ['open' => true, 'deadline' => '2026-11-15T17:00:00+00:00', 'pendingCount' => 0]);

    expect($tournament->fresh())
        ->registration_open->toBeTrue()
        ->registration_deadline->toDateTimeString()->toBe('2026-11-15 17:00:00');
});

it('zmienia tylko tę część zapisów, która przyszła, a null usuwa termin', function () {
    $tournament = Tournament::factory()->openForRegistration()->create(['registration_deadline' => '2026-11-15 17:00:00']);

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", ['registration' => ['open' => false]])
        ->assertValidResponse(200)
        ->assertJsonPath('data.registration.open', false)
        ->assertJsonPath('data.registration.deadline', '2026-11-15T17:00:00+00:00');

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", ['registration' => ['deadline' => null]])
        ->assertValidResponse(200)
        ->assertJsonPath('data.registration', ['open' => false, 'deadline' => null, 'pendingCount' => 0]);
});

it('odrzuca termin zapisów bez offsetu i przełącznik, który nie jest wartością logiczną', function () {
    $tournament = Tournament::factory()->create();

    actingAsOrganizer($tournament->user)
        ->patchJson("/api/v1/tournaments/{$tournament->id}", [
            'registration' => ['open' => 'tak', 'deadline' => '2026-11-15T18:00:00'],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['registration.open', 'registration.deadline']);

    expect($tournament->fresh()->registration_open)->toBeFalse();
});

it('liczy w turnieju tylko zgłoszenia oczekujące', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    TeamRegistration::factory()->count(2)->for($tournament)->create();
    TeamRegistration::factory()->rejected()->for($tournament)->create();
    TeamRegistration::factory()->for(Tournament::factory())->create();

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}")
        ->assertValidResponse(200)
        ->assertJsonPath('data.registration.pendingCount', 2);

    actingAsOrganizer($tournament->user)
        ->getJson('/api/v1/tournaments')
        ->assertValidResponse(200)
        ->assertJsonPath('data.0.registration.pendingCount', 2);
});

/*
| Lista w panelu
*/

it('oddaje zgłoszenia turnieju od najstarszego, z danymi zgłaszającego', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $later = TeamRegistration::factory()->for($tournament)->create(['team_name' => 'Smoki Ochota', 'created_at' => '2026-10-12 08:05:00']);
    $earlier = TeamRegistration::factory()->for($tournament)->create([
        'team_name' => 'Lwy Mokotów',
        'contact_name' => 'Anna Wiśniewska',
        'contact_email' => 'anna@example.com',
        'contact_phone' => '+48 600 100 200',
        'players' => [['name' => 'Paweł Lis', 'number' => 1]],
        'created_at' => '2026-10-10 17:42:00',
    ]);
    TeamRegistration::factory()->for(Tournament::factory()->for($tournament->user))->create();

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/registrations")
        ->assertValidResponse(200)
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0', [
            'id' => $earlier->id,
            'tournamentId' => $tournament->id,
            'teamName' => 'Lwy Mokotów',
            'status' => 'pending',
            'contact' => ['name' => 'Anna Wiśniewska', 'email' => 'anna@example.com', 'phone' => '+48 600 100 200'],
            'players' => [['name' => 'Paweł Lis', 'number' => 1]],
            'teamId' => null,
            'createdAt' => '2026-10-10T17:42:00+00:00',
            'decidedAt' => null,
        ])
        ->assertJsonPath('data.1.id', $later->id);
});

it('zawęża listę zgłoszeń do podanych stanów', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $pending = TeamRegistration::factory()->for($tournament)->create();
    $rejected = TeamRegistration::factory()->rejected()->for($tournament)->create();

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/registrations?status=pending")
        ->assertValidResponse(200)
        ->assertJsonPath('data.*.id', [$pending->id]);

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/registrations?status=rejected,pending")
        ->assertValidResponse(200)
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.1.contact', null)
        ->assertJsonPath('data.1.players', [])
        ->assertJsonPath('data.1.id', $rejected->id);

    actingAsOrganizer($tournament->user)
        ->getJson("/api/v1/tournaments/{$tournament->id}/registrations?status=waiting")
        ->assertValidResponse(422)
        ->assertJsonPath('errors.status', ['Nieznany stan zgłoszenia: waiting. Dozwolone: pending, accepted, rejected.']);
});

/*
| Przyjęcie
*/

function acceptRegistration(TeamRegistration $registration): TestResponse
{
    return actingAsOrganizer($registration->tournament->user)
        ->postJson("/api/v1/registrations/{$registration->id}/accept");
}

function rejectRegistration(TeamRegistration $registration): TestResponse
{
    return actingAsOrganizer($registration->tournament->user)
        ->postJson("/api/v1/registrations/{$registration->id}/reject");
}

it('przyjmuje zgłoszenie: tworzy drużynę i zawodników ze składu, bez danych zgłaszającego', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $registration = TeamRegistration::factory()->for($tournament)->create([
        'team_name' => 'Lwy Mokotów',
        'players' => [['name' => 'Paweł Lis', 'number' => 1], ['name' => 'Igor Wrzos', 'number' => null]],
    ]);

    $response = acceptRegistration($registration)
        ->assertValidResponse(201)
        ->assertJsonPath('data.name', 'Lwy Mokotów')
        ->assertJsonPath('data.tournamentId', $tournament->id)
        ->assertJsonPath('data.playersCount', 2);

    $team = Team::findOrFail($response->json('data.id'));
    expect($team->players()->orderBy('id')->get(['name', 'number', 'position'])->toArray())->toBe([
        ['name' => 'Paweł Lis', 'number' => 1, 'position' => null],
        ['name' => 'Igor Wrzos', 'number' => null, 'position' => null],
    ]);

    expect($registration->fresh())
        ->status->toBe('accepted')
        ->team_id->toBe($team->id)
        ->decided_at->not->toBeNull()
        // Przyjęcie zostawia kontakt organizerowi (`CONTEXT.md`).
        ->contact_email->not->toBeNull();
});

it('przyjmuje zgłoszenie także po zamknięciu zapisów', function () {
    $tournament = Tournament::factory()->create(['status' => 'active', 'registration_open' => false]);
    $registration = TeamRegistration::factory()->for($tournament)->create();

    acceptRegistration($registration)->assertValidResponse(201);
});

it('przyjmuje zgłoszenie po ustaleniu składu grup jak każdą drużynę, bez grupy', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $stage = Stage::factory()->group()->for($tournament)->create();
    Group::factory()->for($stage)->create();
    $registration = TeamRegistration::factory()->for($tournament)->create();

    acceptRegistration($registration)
        ->assertValidResponse(201)
        ->assertJsonPath('data.groupId', null);
});

it('odmawia drugiego przyjęcia tej samej nazwy i niczego nie zapisuje', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $first = TeamRegistration::factory()->for($tournament)->create(['team_name' => 'Lwy Mokotów']);
    $second = TeamRegistration::factory()->for($tournament)->create([
        'team_name' => 'LWY MOKOTÓW',
        'players' => [['name' => 'Paweł Lis', 'number' => 1]],
    ]);

    acceptRegistration($first)->assertCreated();

    acceptRegistration($second)
        ->assertValidResponse(422)
        ->assertJsonPath('errors.name', ['W tym turnieju jest już drużyna o tej nazwie.']);

    expect($tournament->teams()->count())->toBe(1)
        ->and($second->fresh()->status)->toBe('pending');
});

it('odmawia przyjęcia w turnieju z meczem rozpoczętym pod kluczem teams', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    startMatchIn($tournament);
    $registration = TeamRegistration::factory()->for($tournament)->create();

    acceptRegistration($registration)
        ->assertValidResponse(422)
        ->assertJsonPath('errors.teams', ['Turniej ma rozegrane lub trwające mecze, więc nie można dodać drużyny.']);

    expect($registration->fresh()->status)->toBe('pending');
});

it('odmawia przyjęcia i odrzucenia zgłoszenia już rozpatrzonego', function (string $state, string $action) {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $registration = TeamRegistration::factory()->for($tournament)->create(['team_name' => 'Lwy Mokotów']);
    $state === 'accepted' ? acceptRegistration($registration)->assertCreated() : rejectRegistration($registration)->assertOk();

    $response = $action === 'accept' ? acceptRegistration($registration->fresh()) : rejectRegistration($registration->fresh());

    $response
        ->assertValidResponse(422)
        ->assertExactJson([
            'message' => 'To zgłoszenie zostało już rozpatrzone.',
            'errors' => ['registration' => ['To zgłoszenie zostało już rozpatrzone.']],
        ]);

    expect($tournament->teams()->count())->toBe($state === 'accepted' ? 1 : 0);
})->with(['przyjęte' => 'accepted', 'odrzucone' => 'rejected'])
    ->with(['przyjęcie' => 'accept', 'odrzucenie' => 'reject']);

/*
| Odrzucenie i los danych
*/

it('odrzuca zgłoszenie i od razu usuwa dane osobowe', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $registration = TeamRegistration::factory()->for($tournament)->create([
        'team_name' => 'Smoki Ochota',
        'contact_phone' => '+48 600 100 200',
        'players' => [['name' => 'Paweł Lis', 'number' => 1]],
    ]);

    rejectRegistration($registration)
        ->assertValidResponse(200)
        ->assertJsonPath('data.status', 'rejected')
        ->assertJsonPath('data.teamName', 'Smoki Ochota')
        ->assertJsonPath('data.contact', null)
        ->assertJsonPath('data.players', []);

    expect($registration->fresh())
        ->contact_name->toBeNull()
        ->contact_email->toBeNull()
        ->contact_phone->toBeNull()
        ->players->toBeNull()
        ->decided_at->not->toBeNull();
    expect($tournament->teams()->count())->toBe(0);
});

it('usuwa przyjęte zgłoszenie razem z jego drużyną', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    $registration = TeamRegistration::factory()->for($tournament)->create();
    $teamId = acceptRegistration($registration)->assertCreated()->json('data.id');

    actingAsOrganizer($tournament->user)->deleteJson("/api/v1/teams/{$teamId}")->assertNoContent();

    expect(TeamRegistration::find($registration->id))->toBeNull();
});

it('usuwa zgłoszenia razem z turniejem', function () {
    $tournament = Tournament::factory()->openForRegistration()->create();
    TeamRegistration::factory()->count(2)->for($tournament)->create();

    actingAsOrganizer($tournament->user)->deleteJson("/api/v1/tournaments/{$tournament->id}")->assertNoContent();

    expect(TeamRegistration::count())->toBe(0);
});
