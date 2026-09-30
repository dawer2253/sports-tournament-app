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
