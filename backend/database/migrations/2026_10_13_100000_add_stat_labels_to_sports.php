<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Etykiety statystyk (#190, #207) przepisane dosłownie z przykładu
 * `GET /sports` w `packages/api-contract/openapi.yaml`, wzorem
 * `add_tiebreaker_labels_to_sports`. Klucze to dokładnie `availableStats`
 * sportu — pilnuje tego `SportsTest`. Osobna migracja z tego samego powodu co
 * tamta: `create_sports_table` przeszła już na bazach innych osób.
 */
return new class extends Migration
{
    private const LABELS = [
        'football' => [
            'goals' => 'Bramki',
            'yellowCards' => 'Żółte kartki',
            'redCards' => 'Czerwone kartki',
        ],
        'basketball' => [
            'points' => 'Punkty',
            'fouls' => 'Faule',
        ],
    ];

    public function up(): void
    {
        foreach (self::LABELS as $code => $labels) {
            $this->updateConfig($code, function (array $config) use ($labels) {
                $config['statLabels'] = $labels;

                return $config;
            });
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::LABELS) as $code) {
            $this->updateConfig($code, function (array $config) {
                unset($config['statLabels']);

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
