<?php

use App\Matches\SetScores;

/**
 * Reguły seta z opisu `MatchUpdate` w kontrakcie (#301). Format domyślny
 * siatkówki: mecz do 3 setów, set do 25, decydujący do 15, przewaga 2.
 */
function volleyballFormat(array $overrides = []): array
{
    return [...['setsToWin' => 3, 'setPoints' => 25, 'decidingSetPoints' => 15, 'minLead' => 2], ...$overrides];
}

function sets(array $scores): array
{
    return array_map(fn (array $score): array => ['home' => $score[0], 'away' => $score[1]], $scores);
}

it('klasyfikuje set przy przewadze 2: zakończony, niedokończony albo niemożliwy', function (array $score, string $expected) {
    expect(SetScores::classify(['home' => $score[0], 'away' => $score[1]], 25, 2))->toBe($expected);
})->with([
    '25:23' => [[25, 23], 'complete'],
    '27:25 na przewagi' => [[27, 25], 'complete'],
    '31:29 na przewagi' => [[31, 29], 'complete'],
    '23:25 gość' => [[23, 25], 'complete'],
    '25:24 trwa' => [[25, 24], 'incomplete'],
    '24:24 trwa' => [[24, 24], 'incomplete'],
    '0:0 trwa' => [[0, 0], 'incomplete'],
    '18:12 trwa' => [[18, 12], 'incomplete'],
    '28:25' => [[28, 25], 'invalid'],
    '26:22' => [[26, 22], 'invalid'],
    '26:23' => [[26, 23], 'invalid'],
]);

it('klasyfikuje set przy przewadze 1: kończy się dokładnie na progu', function (array $score, string $expected) {
    expect(SetScores::classify(['home' => $score[0], 'away' => $score[1]], 25, 1))->toBe($expected);
})->with([
    '25:24' => [[25, 24], 'complete'],
    '25:0' => [[25, 0], 'complete'],
    '24:24 trwa' => [[24, 24], 'incomplete'],
    '26:24' => [[26, 24], 'invalid'],
    '25:25' => [[25, 25], 'invalid'],
]);

it('daje set decydujący z niższym progiem: 5. przy meczu do 3, 3. przy meczu do 2', function () {
    expect(SetScores::threshold(0, volleyballFormat()))->toBe(25)
        ->and(SetScores::threshold(3, volleyballFormat()))->toBe(25)
        ->and(SetScores::threshold(4, volleyballFormat()))->toBe(15)
        ->and(SetScores::threshold(1, volleyballFormat(['setsToWin' => 2])))->toBe(25)
        ->and(SetScores::threshold(2, volleyballFormat(['setsToWin' => 2])))->toBe(15);
});

it('liczy sety wygrane bez niedokończonego ostatniego seta', function () {
    expect(SetScores::won(sets([[25, 21], [18, 25], [14, 12]]), volleyballFormat()))->toBe([1, 1])
        ->and(SetScores::won(sets([[25, 23], [23, 25], [25, 21], [20, 25], [15, 11]]), volleyballFormat()))->toBe([3, 2])
        ->and(SetScores::won([], volleyballFormat()))->toBe([0, 0]);
});

it('sumuje punkty w setach obu drużyn', function () {
    expect(SetScores::rallyPoints(sets([[25, 19], [25, 21], [25, 17]])))->toBe([75, 57])
        ->and(SetScores::rallyPoints([]))->toBe([0, 0]);
});

it('przyjmuje mecz zakończony 3:2 z piątym setem do 15 i mecz trwający z niedokończonym setem', function () {
    expect(SetScores::errors(sets([[25, 23], [23, 25], [25, 21], [20, 25], [15, 13]]), 'finished', volleyballFormat()))->toBe([])
        ->and(SetScores::errors(sets([[25, 23], [23, 25], [25, 21], [20, 25], [25, 23]]), 'finished', volleyballFormat()))->toBe([])
        ->and(SetScores::errors(sets([[25, 21], [24, 24]]), 'live', volleyballFormat()))->toBe([])
        ->and(SetScores::errors([], 'live', volleyballFormat()))->toBe([])
        ->and(SetScores::errors([], 'scheduled', volleyballFormat()))->toBe([]);
});

it('odrzuca set niemożliwy, niedokończony w środku, po rozstrzygnięciu i decydujący 15:14', function (array $scores, string $status, string $key) {
    expect(SetScores::errors(sets($scores), $status, volleyballFormat()))->toHaveKey($key);
})->with([
    '25:24 w zakończonym' => [[[25, 24], [25, 20], [25, 20]], 'finished', 'sets.0'],
    '28:25' => [[[25, 20], [28, 25], [25, 20]], 'finished', 'sets.1'],
    'niedokończony w środku meczu trwającego' => [[[25, 20], [20, 18], [10, 5]], 'live', 'sets.1'],
    'decydujący 15:14' => [[[25, 23], [23, 25], [25, 21], [20, 25], [15, 14]], 'finished', 'sets.4'],
    'set po rozstrzygnięciu' => [[[25, 20], [25, 20], [25, 20], [25, 20]], 'finished', 'sets.3'],
    'zakończony bez zwycięzcy' => [[[25, 20], [20, 25]], 'finished', 'sets'],
    'zaplanowany z setem' => [[[25, 20]], 'scheduled', 'sets'],
    '26:22 w trwającym' => [[[26, 22]], 'live', 'sets.0'],
]);

it('kończy mecz do 2 setów na 2:1 i odrzuca trzeci set przy 2:0', function () {
    $format = volleyballFormat(['setsToWin' => 2]);

    expect(SetScores::errors(sets([[25, 20], [20, 25], [15, 10]]), 'finished', $format))->toBe([])
        ->and(SetScores::won(sets([[25, 20], [20, 25], [15, 10]]), $format))->toBe([2, 1])
        ->and(SetScores::errors(sets([[25, 20], [25, 20], [15, 10]]), 'finished', $format))->toHaveKey('sets.2');
});

it('stosuje progi turnieju: sety do 21 w setach 1–4', function () {
    $format = volleyballFormat(['setPoints' => 21]);

    expect(SetScores::errors(sets([[21, 15], [21, 19], [21, 10]]), 'finished', $format))->toBe([])
        ->and(SetScores::errors(sets([[25, 15], [21, 19], [21, 10]]), 'finished', $format))->toHaveKey('sets.0');
});
