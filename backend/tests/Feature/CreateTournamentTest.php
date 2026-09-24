<?php

use App\Models\Stage;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Spectator\Spectator;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

it('odmawia założenia turnieju bez tokenu', function () {
    $this->postJson('/api/v1/tournaments', [
        'name' => 'Liga Osiedlowa 2026',
        'sportId' => sport('football')->id,
        'format' => 'league',
    ])
        ->assertValidRequest()
        ->assertValidResponse(401);

    expect(Tournament::count())->toBe(0);
});

it('zakłada turniej jako szkic zalogowanego organizera', function () {
    $organizer = User::factory()->create();

    $response = actingAsOrganizer($organizer)
        ->postJson('/api/v1/tournaments', [
            'name' => 'Liga Osiedlowa 2026',
            'sportId' => sport('football')->id,
            'format' => 'league',
        ])
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data.name', 'Liga Osiedlowa 2026')
        ->assertJsonPath('data.slug', 'liga-osiedlowa-2026')
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.sport', ['id' => sport('football')->id, 'code' => 'football', 'name' => 'Piłka nożna'])
        ->assertJsonPath('data.teamsCount', 0)
        // Kolor marki z przykładu w kontrakcie — ten sam, który stoi w demo.
        ->assertJsonPath('data.branding', ['logoUrl' => null, 'primaryColor' => '#1F7A45']);

    expect(Tournament::findOrFail($response->json('data.id'))->user_id)->toBe($organizer->id);
});

// Format nie jest zapisywany, więc jedynym jego śladem są fazy (ADR-0002).
// `GET /tournaments/{tournament}/stages` jeszcze nie istnieje, dlatego fazy
// czyta relacja — kiedy endpoint wejdzie, ten test powinien przejść na niego.
//
// Komplet porównywany w całości i w kolejności `order`: nadmiarowa faza albo
// zamienione `order` to inny turniej, nie drobna różnica.
it('tworzy fazy wynikające z formatu i nic poza nimi', function (string $format, array $expectedStages) {
    $response = actingAsOrganizer()
        ->postJson('/api/v1/tournaments', [
            'name' => 'Turniej testowy',
            'sportId' => sport('football')->id,
            'format' => $format,
        ])
        ->assertValidRequest()
        ->assertValidResponse(201);

    $tournament = Tournament::findOrFail($response->json('data.id'));

    $stages = $tournament->stages()->orderBy('order')->get()
        ->map(fn ($stage) => ['type' => $stage->type, 'name' => $stage->name, 'order' => $stage->order])
        ->all();

    expect($stages)->toBe($expectedStages)
        ->and($tournament->groups()->count())->toBe(0)
        ->and($tournament->matches()->count())->toBe(0)
        ->and($tournament->stages()->withCount('rounds')->get()->sum('rounds_count'))->toBe(0);
})->with([
    'liga' => ['league', [
        ['type' => 'league', 'name' => 'Faza zasadnicza', 'order' => 1],
    ]],
    'puchar' => ['knockout', [
        ['type' => 'knockout', 'name' => 'Faza pucharowa', 'order' => 1],
    ]],
    'grupy i play-off' => ['groups_playoff', [
        ['type' => 'group', 'name' => 'Faza grupowa', 'order' => 1],
        ['type' => 'knockout', 'name' => 'Faza pucharowa', 'order' => 2],
    ]],
]);

// Wartości oczekiwane są literałami, a nie odczytem `Sport.config`, bo test
// odczytujący config tą samą drogą co kod przeszedłby przy każdym błędzie
// w tej drodze. Liczby pochodzą z przykładu `GET /sports` w kontrakcie.
it('kopiuje punktację i tiebreaki z domyślnych danego sportu', function (string $sportCode, array $points, array $tiebreakers) {
    actingAsOrganizer()
        ->postJson('/api/v1/tournaments', [
            'name' => 'Turniej testowy',
            'sportId' => sport($sportCode)->id,
            'format' => 'league',
        ])
        ->assertValidRequest()
        ->assertValidResponse(201)
        ->assertJsonPath('data.sport.code', $sportCode)
        ->assertJsonPath('data.points', $points)
        ->assertJsonPath('data.tiebreakers', $tiebreakers);
})->with([
    'piłka nożna' => ['football', ['win' => 3, 'draw' => 1, 'loss' => 0], ['points', 'head_to_head', 'score_diff', 'score_for']],
    'koszykówka' => ['basketball', ['win' => 2, 'draw' => 0, 'loss' => 1], ['points', 'head_to_head', 'score_diff']],
]);

// `assertValidRequest()` celowo nie ma: żądania są błędne z założenia, więc
// nie przechodzą walidacji kontraktu po stronie wejścia. Komunikat sprawdzany
// jest dosłownie, bo panel pokazuje go organizerowi pod polem — angielski
// tekst albo surowa nazwa `sportId` to błąd, który schemat przepuści.
it('odrzuca błędne dane turnieju z polskim komunikatem przy polu', function (array $override, string $field, string $message) {
    actingAsOrganizer()
        ->postJson('/api/v1/tournaments', array_filter([
            'name' => 'Liga Osiedlowa 2026',
            'sportId' => sport('football')->id,
            'format' => 'league',
            ...$override,
        ], fn ($value) => $value !== null))
        ->assertValidResponse(422)
        ->assertJsonValidationErrors([$field])
        ->assertJsonPath("errors.{$field}.0", $message);

    expect(Tournament::count())->toBe(0);
})->with([
    'brak nazwy' => [['name' => null], 'name', 'Pole nazwa jest wymagane.'],
    'pusta nazwa' => [['name' => ''], 'name', 'Pole nazwa jest wymagane.'],
    'nazwa z samych spacji' => [['name' => '   '], 'name', 'Pole nazwa jest wymagane.'],
    'za długa nazwa' => [['name' => str_repeat('a', 161)], 'name', 'Pole nazwa nie może mieć więcej niż 160 znaków.'],
    'brak sportu' => [['sportId' => null], 'sportId', 'Pole sport jest wymagane.'],
    'sport nie liczbą' => [['sportId' => 'abc'], 'sportId', 'Pole sport musi być liczbą całkowitą.'],
    'brak formatu' => [['format' => null], 'format', 'Pole format jest wymagane.'],
    'format spoza listy' => [['format' => 'swiss'], 'format', 'Wybrana wartość pola format jest nieprawidłowa.'],
]);

// Nieistniejący sport to błędna wartość pola w treści żądania, a nie brak
// zasobu z adresu — 404 wprowadziłoby panel w błąd, że nie ma samej trasy.
it('odrzuca nieistniejący sport jako błąd pola sportId, a nie 404', function () {
    actingAsOrganizer()
        ->postJson('/api/v1/tournaments', [
            'name' => 'Liga Osiedlowa 2026',
            'sportId' => 999999,
            'format' => 'league',
        ])
        ->assertValidRequest()
        ->assertValidResponse(422)
        ->assertJsonValidationErrors(['sportId'])
        ->assertJsonPath('errors.sportId.0', 'Wybrana wartość pola sport jest nieprawidłowa.');

    expect(Tournament::count())->toBe(0);
});

it('przyjmuje nazwę o maksymalnej długości', function () {
    actingAsOrganizer()
        ->postJson('/api/v1/tournaments', [
            'name' => str_repeat('a', 160),
            'sportId' => sport('football')->id,
            'format' => 'league',
        ])
        ->assertValidRequest()
        ->assertValidResponse(201);
});

// Ponowna próba z kolejnym sufiksem leczy wyłącznie kolizję sluga. Każde inne
// naruszenie unikatu powtórzy się przy każdym sufiksie, więc ponawianie go
// zapętliłoby żądanie zamiast oddać błąd. Naruszenie jest prawdziwe: faza
// wstawiona drugi raz z tym samym `order` łamie unikat `(tournament_id, order)`.
// Licznik prób jest bezpiecznikiem, żeby zapętlony kod dał czerwony test,
// a nie zawieszony zestaw.
it('nie ponawia zakładania przy naruszeniu unikatu innym niż slug', function () {
    $attempts = 0;
    Stage::created(function (Stage $stage) use (&$attempts) {
        if (++$attempts > 5) {
            throw new RuntimeException('Zakładanie turnieju zapętliło się.');
        }
        Stage::create($stage->only(['tournament_id', 'type', 'name', 'order']));
    });

    $this->withoutExceptionHandling();

    expect(fn () => actingAsOrganizer()->postJson('/api/v1/tournaments', [
        'name' => 'Liga Osiedlowa 2026',
        'sportId' => sport('football')->id,
        'format' => 'league',
    ]))->toThrow(UniqueConstraintViolationException::class);

    expect($attempts)->toBe(1)
        ->and(Tournament::count())->toBe(0);
});
