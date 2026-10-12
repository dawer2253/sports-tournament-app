<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Typy zdarzeń z `value` (#188, reguła 4): wkład jednego zdarzenia do
 * statystyki, ustawiony jawnie przy każdym typie. Koszykówka rozbija przy tym
 * „Punkty” na rzuty za 1, 2 i 3, bo przy stoliku klika się jeden rzut, a nie
 * wpisuje liczbę punktów.
 *
 * Osobna migracja, a nie poprawka `create_sports_table`, z tego samego powodu
 * co `add_tiebreaker_labels_to_sports`: tamta przeszła już na bazach innych
 * osób, a zespół ma dostać zmianę zwykłym `migrate`.
 *
 * Wartości dosłownie z przykładu `GET /sports` w
 * `packages/api-contract/openapi.yaml` — pilnuje tego `SportsTest`.
 */
return new class extends Migration
{
    private const EVENT_TYPES = [
        'football' => [
            ['code' => 'goal', 'label' => 'Bramka', 'hasPlayer' => true, 'value' => 1, 'stat' => 'goals'],
            ['code' => 'own_goal', 'label' => 'Bramka samobójcza', 'hasPlayer' => true, 'value' => 1, 'stat' => null],
            ['code' => 'yellow_card', 'label' => 'Żółta kartka', 'hasPlayer' => true, 'value' => 1, 'stat' => 'yellowCards'],
            ['code' => 'red_card', 'label' => 'Czerwona kartka', 'hasPlayer' => true, 'value' => 1, 'stat' => 'redCards'],
        ],
        'basketball' => [
            ['code' => 'free_throw', 'label' => 'Rzut wolny', 'hasPlayer' => true, 'value' => 1, 'stat' => 'points'],
            ['code' => 'two_pointer', 'label' => 'Rzut za 2', 'hasPlayer' => true, 'value' => 2, 'stat' => 'points'],
            ['code' => 'three_pointer', 'label' => 'Rzut za 3', 'hasPlayer' => true, 'value' => 3, 'stat' => 'points'],
            ['code' => 'foul', 'label' => 'Faul', 'hasPlayer' => true, 'value' => 1, 'stat' => 'fouls'],
        ],
    ];

    /** Typy sprzed tej migracji, do `down()`. */
    private const PREVIOUS_EVENT_TYPES = [
        'football' => [
            ['code' => 'goal', 'label' => 'Bramka', 'hasPlayer' => true, 'stat' => 'goals'],
            ['code' => 'own_goal', 'label' => 'Bramka samobójcza', 'hasPlayer' => true, 'stat' => null],
            ['code' => 'yellow_card', 'label' => 'Żółta kartka', 'hasPlayer' => true, 'stat' => 'yellowCards'],
            ['code' => 'red_card', 'label' => 'Czerwona kartka', 'hasPlayer' => true, 'stat' => 'redCards'],
        ],
        'basketball' => [
            ['code' => 'points', 'label' => 'Punkty', 'hasPlayer' => true, 'stat' => 'points'],
            ['code' => 'foul', 'label' => 'Faul', 'hasPlayer' => true, 'stat' => 'fouls'],
        ],
    ];

    public function up(): void
    {
        $this->replaceEventTypes(self::EVENT_TYPES);
    }

    public function down(): void
    {
        $this->replaceEventTypes(self::PREVIOUS_EVENT_TYPES);
    }

    /**
     * @param  array<string, list<array<string, mixed>>>  $eventTypes
     */
    private function replaceEventTypes(array $eventTypes): void
    {
        foreach ($eventTypes as $code => $types) {
            $config = DB::table('sports')->where('code', $code)->value('config');

            // Sportu nie ma tylko w bazie bez migracji tworzącej. Wtedy nie ma
            // czego uzupełniać, a wstawianie sportów nie należy do tej migracji.
            if ($config === null) {
                continue;
            }

            $config = json_decode($config, true);
            $config['eventTypes'] = $types;

            DB::table('sports')->where('code', $code)->update([
                'config' => json_encode($config, JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);
        }
    }
};
