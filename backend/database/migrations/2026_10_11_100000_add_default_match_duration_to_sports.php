<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Domyślna długość meczu (#158) wpisana do `config` sportu, bo turniej kopiuje
 * ją przy zakładaniu tak jak `points` i `tiebreakers`. Osobna migracja, a nie
 * poprawka `create_sports_table`, z tego samego powodu co
 * `add_tiebreaker_labels_to_sports`: tamta przeszła już na bazach innych osób.
 *
 * Wartości amatorskie z rozstrzygnięcia #158 i dosłownie z przykładu
 * `GET /sports` w `packages/api-contract/openapi.yaml`.
 */
return new class extends Migration
{
    private const DURATIONS = [
        'football' => 60,
        'basketball' => 40,
    ];

    public function up(): void
    {
        foreach (self::DURATIONS as $code => $minutes) {
            $this->updateConfig($code, function (array $config) use ($minutes) {
                $config['defaultMatchDuration'] = $minutes;

                return $config;
            });
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::DURATIONS) as $code) {
            $this->updateConfig($code, function (array $config) {
                unset($config['defaultMatchDuration']);

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
