<?php

use Spectator\Spectator;
use Symfony\Component\Yaml\Yaml;

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

// `/sports` nie leży pod `/public/*`, więc obowiązuje go globalne
// `security: bearerAuth` z kontraktu — lista sportów to dane panelu.
it('odmawia listy sportów bez tokenu', function () {
    $this->getJson('/api/v1/sports')
        ->assertValidRequest()
        ->assertValidResponse(401);
});

// Sporty wstawia migracja z wartościami przepisanymi z przykładu w kontrakcie,
// a mock serwuje panelowi właśnie ten przykład. Spectator waliduje sam schemat,
// więc rozjazd `config` z przykładem przeszedłby mu niezauważony — stąd
// porównanie z przykładem czytanym ze speca, a nie z literałem w teście.
it('oddaje sporty z konfiguracją dokładnie taką, jaką obiecuje przykład w kontrakcie', function () {
    $spec = Yaml::parseFile(config('spectator.sources.local.base_path').'/openapi.yaml');
    $promised = $spec['paths']['/sports']['get']['responses']['200']['content']['application/json']['example']['data'];

    $response = actingAsOrganizer()
        ->getJson('/api/v1/sports')
        ->assertValidRequest()
        ->assertValidResponse(200);

    expect($response->json('data'))->toEqual($promised);
});

// #188, reguła 4: `value` przy każdym typie, ustawione jawnie, a kosz liczy
// punkty z rzutów, nie z jednego typu `points`. Sprawdzone niezależnie od
// przykładu, żeby zmiana przykładu i migracji naraz tego nie zgubiła.
it('oddaje value przy każdym typie zdarzenia, a kosz nie ma już typu points', function () {
    $sports = actingAsOrganizer()
        ->getJson('/api/v1/sports')
        ->assertValidResponse(200)
        ->collect('data')
        ->keyBy('code');

    foreach ($sports as $sport) {
        foreach ($sport['config']['eventTypes'] as $type) {
            expect($type['value'])->toBeInt()->toBeGreaterThanOrEqual(1);
        }
    }

    expect(array_column($sports['basketball']['config']['eventTypes'], 'value', 'code'))
        ->toBe(['free_throw' => 1, 'two_pointer' => 2, 'three_pointer' => 3, 'foul' => 1]);
});

// #297: zegar w minutach ma piłka, a kosz pokazuje kwartę. Sprawdzone
// niezależnie od przykładu, jak `value` wyżej.
it('oddaje runningClock: piłka true, kosz false', function () {
    $sports = actingAsOrganizer()->getJson('/api/v1/sports')->assertValidResponse(200)->collect('data')->keyBy('code');

    expect($sports['football']['config']['runningClock'])->toBeTrue()
        ->and($sports['basketball']['config']['runningClock'])->toBeFalse();
});

// #190, niezmiennik 9: etykieta dla każdej statystyki sportu i żadnej ponad
// nie — klasyfikacja i `PublicTournament.stats` biorą etykietę po kodzie.
it('oddaje statLabels z kluczami dokładnie z availableStats każdego sportu', function () {
    $sports = actingAsOrganizer()->getJson('/api/v1/sports')->assertValidResponse(200)->json('data');

    expect($sports)->not->toBeEmpty();
    foreach ($sports as $sport) {
        expect(array_keys($sport['config']['statLabels']))->toEqualCanonicalizing($sport['config']['availableStats']);
    }
});
