<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Domyślny podział meczu na części (#210) wpisany do `config` sportu, bo
 * turniej kopiuje go przy zakładaniu tak jak `defaultMatchDuration`. Osobna
 * migracja, a nie poprawka `create_sports_table`, z tego samego powodu co
 * `add_default_match_duration_to_sports`: tamta przeszła już na bazach innych
 * osób (#188, reguła 5).
 *
 * Wartości dosłownie z przykładu `GET /sports` w
 * `packages/api-contract/openapi.yaml`; zgodność pilnuje `SportsTest`.
 */
return new class extends Migration
{
    private const PERIODS = [
        'football' => ['count' => 2, 'minutes' => 45],
        'basketball' => ['count' => 4, 'minutes' => 10],
    ];

    public function up(): void
    {
        foreach (self::PERIODS as $code => $periods) {
            $this->updateConfig($code, function (array $config) use ($periods) {
                $config['defaultPeriods'] = $periods;

                return $config;
            });
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::PERIODS) as $code) {
            $this->updateConfig($code, function (array $config) {
                unset($config['defaultPeriods']);

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
