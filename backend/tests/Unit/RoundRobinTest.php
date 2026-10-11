<?php

use App\Schedule\RoundRobin;

/**
 * Kolejki z numeracją FIDE (od jedynki), żeby test dało się porównać wprost
 * z tablicą w `docs/research/circle-method-berger.md` §3. Para to
 * [gospodarz, gość].
 *
 * @return list<list<array{int, int}>>
 */
function bergerFromOne(int $teams, int $meetings = 1): array
{
    return array_map(
        fn (array $round): array => array_map(fn (array $pair): array => [$pair[0] + 1, $pair[1] + 1], $round),
        RoundRobin::rounds($teams, $meetings),
    );
}

it('odtwarza tablicę Bergera FIDE dla sześciu drużyn co do par i gospodarzy', function () {
    expect(bergerFromOne(6))->toBe([
        [[1, 6], [2, 5], [3, 4]],
        [[6, 4], [5, 3], [1, 2]],
        [[2, 6], [3, 1], [4, 5]],
        [[6, 5], [1, 4], [2, 3]],
        [[3, 6], [4, 2], [5, 1]],
    ]);
});

// Przy nieparzystym n szósty numer to pauza: kto miałby grać z nim, pauzuje,
// a w kolejce zostaje o jeden mecz mniej (decyzja #24, pauza bez wiersza).
it('przy nieparzystej liczbie drużyn wycina mecze z widmem zamiast je zapisywać', function () {
    expect(bergerFromOne(5))->toBe([
        [[2, 5], [3, 4]],
        [[5, 3], [1, 2]],
        [[3, 1], [4, 5]],
        [[1, 4], [2, 3]],
        [[4, 2], [5, 1]],
    ]);
});

it('przy dwóch spotkaniach dokłada rewanż jako czyste lustro', function () {
    $rounds = bergerFromOne(4, meetings: 2);
    $firstLeg = array_slice($rounds, 0, 3);
    $secondLeg = array_slice($rounds, 3);

    expect($rounds)->toHaveCount(6)
        ->and($secondLeg)->toBe(array_map(
            fn (array $round): array => array_map(fn (array $pair): array => [$pair[1], $pair[0]], $round),
            $firstLeg,
        ));
});

it('dla dwóch drużyn daje jedną kolejkę z jednym meczem', function () {
    expect(bergerFromOne(2))->toBe([[[1, 2]]]);
});

it('odrzuca liczbę spotkań inną niż 1 i 2 oraz mniej niż dwie drużyny', function (int $teams, int $meetings) {
    RoundRobin::rounds($teams, $meetings);
})->with([
    'trzy spotkania' => [4, 3],
    'zero spotkań' => [4, 0],
    'jedna drużyna' => [1, 1],
])->throws(InvalidArgumentException::class);
