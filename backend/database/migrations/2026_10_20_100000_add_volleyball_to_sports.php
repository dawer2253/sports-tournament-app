<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Siatkówka (#301), pierwszy sport z setami, oraz `defaultSetFormat: null`
 * dla piłki i koszykówki: sport z formatem seta to sport z setami
 * (ADR-0012). Osobna migracja, a nie poprawka `create_sports_table`, z tego
 * samego powodu co `add_running_clock_to_sports`: tamta przeszła już na
 * bazach innych osób (#188, reguła 5).
 *
 * Wartości dosłownie z przykładu `GET /sports` w
 * `packages/api-contract/openapi.yaml` (decyzja #25); zgodność pilnuje
 * `SportsTest`.
 */
return new class extends Migration
{
    private const VOLLEYBALL = [
        'allowsDraw' => false,
        'runningClock' => false,
        'defaultPoints' => ['win' => 3, 'draw' => 0, 'loss' => 0, 'winDecidingSet' => 2, 'lossDecidingSet' => 1],
        'defaultMatchDuration' => 90,
        'defaultPeriods' => ['count' => 1, 'minutes' => null],
        'defaultSetFormat' => ['setsToWin' => 3, 'setPoints' => 25, 'decidingSetPoints' => 15, 'minLead' => 2],
        'eventTypes' => [
            ['code' => 'ace', 'label' => 'As serwisowy', 'hasPlayer' => true, 'value' => 1, 'stat' => 'points'],
            ['code' => 'block', 'label' => 'Blok punktowy', 'hasPlayer' => true, 'value' => 1, 'stat' => 'points'],
            ['code' => 'attack', 'label' => 'Atak punktowy', 'hasPlayer' => true, 'value' => 1, 'stat' => 'points'],
        ],
        'defaultTiebreakers' => ['points', 'wins', 'set_ratio', 'point_ratio', 'head_to_head'],
        'availableTiebreakers' => ['points', 'wins', 'set_ratio', 'point_ratio', 'head_to_head'],
        'tiebreakerLabels' => [
            'points' => 'Punkty w tabeli',
            'wins' => 'Zwycięstwa',
            'set_ratio' => 'Stosunek setów',
            'point_ratio' => 'Stosunek punktów w setach',
            'head_to_head' => 'Bezpośredni mecz',
        ],
        'availableStats' => ['points'],
        'statLabels' => ['points' => 'Punkty'],
    ];

    /** Sporty bez setów: format seta `null`. */
    private const WITHOUT_SETS = ['football', 'basketball'];

    public function up(): void
    {
        foreach (self::WITHOUT_SETS as $code) {
            $this->updateConfig($code, fn (array $config): array => [...$config, 'defaultSetFormat' => null]);
        }

        $now = now();

        DB::table('sports')->insert([
            'code' => 'volleyball',
            'name' => 'Siatkówka',
            'config' => json_encode(self::VOLLEYBALL, JSON_UNESCAPED_UNICODE),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('sports')->where('code', 'volleyball')->delete();

        foreach (self::WITHOUT_SETS as $code) {
            $this->updateConfig($code, function (array $config): array {
                unset($config['defaultSetFormat']);

                return $config;
            });
        }
    }

    private function updateConfig(string $code, callable $change): void
    {
        $config = DB::table('sports')->where('code', $code)->value('config');

        // Sportu nie ma tylko w bazie bez migracji tworzącej. Wtedy nie ma
        // czego uzupełniać, a wstawianie sportów nie należy do tej migracji.
        if ($config === null) {
            return;
        }

        DB::table('sports')->where('code', $code)->update([
            'config' => json_encode($change(json_decode($config, true)), JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ]);
    }
};
