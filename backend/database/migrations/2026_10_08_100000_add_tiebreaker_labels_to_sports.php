<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Etykiety tiebreaków (#117) przepisane dosłownie z przykładu `GET /sports`
 * w `packages/api-contract/openapi.yaml`, tak jak reszta `config`.
 * Osobna migracja, a nie poprawka `create_sports_table`, bo tamta przeszła
 * już na bazach innych osób.
 */
return new class extends Migration
{
    private const LABELS = [
        'football' => [
            'points' => 'Punkty w tabeli',
            'head_to_head' => 'Bezpośredni mecz',
            'score_diff' => 'Różnica bramek',
            'score_for' => 'Bramki zdobyte',
            'wins' => 'Zwycięstwa',
        ],
        'basketball' => [
            'points' => 'Punkty w tabeli',
            'head_to_head' => 'Bezpośredni mecz',
            'score_diff' => 'Różnica punktów',
            'score_for' => 'Zdobyte punkty',
            'wins' => 'Zwycięstwa',
        ],
    ];

    public function up(): void
    {
        foreach (self::LABELS as $code => $labels) {
            $this->updateConfig($code, function (array $config) use ($labels) {
                $config['tiebreakerLabels'] = $labels;

                return $config;
            });
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::LABELS) as $code) {
            $this->updateConfig($code, function (array $config) {
                unset($config['tiebreakerLabels']);

                return $config;
            });
        }
    }

    private function updateConfig(string $code, callable $change): void
    {
        $config = DB::table('sports')->where('code', $code)->value('config');

        if ($config === null) {
            return;
        }

        DB::table('sports')->where('code', $code)->update([
            'config' => json_encode($change(json_decode($config, true)), JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ]);
    }
};
