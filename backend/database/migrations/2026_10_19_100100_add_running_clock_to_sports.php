<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Flaga `runningClock` (#297) wpisana do `config` sportu: czy zegar meczu
 * biegnie w minutach. Piłka tak (tablica pokazuje „67′”), kosz nie (zegar
 * staje przy każdym przerwaniu gry, więc tablica pokazuje „3. kwarta”).
 * Osobna migracja, a nie poprawka `create_sports_table`, z tego samego
 * powodu co `add_default_periods_to_sports`: tamta przeszła już na bazach
 * innych osób (#188, reguła 5).
 *
 * Wartości dosłownie z przykładu `GET /sports` w
 * `packages/api-contract/openapi.yaml`; zgodność pilnuje `SportsTest`.
 */
return new class extends Migration
{
    private const RUNNING_CLOCK = [
        'football' => true,
        'basketball' => false,
    ];

    public function up(): void
    {
        foreach (self::RUNNING_CLOCK as $code => $running) {
            $this->updateConfig($code, function (array $config) use ($running) {
                $config['runningClock'] = $running;

                return $config;
            });
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::RUNNING_CLOCK) as $code) {
            $this->updateConfig($code, function (array $config) {
                unset($config['runningClock']);

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
