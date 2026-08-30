<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Sporty są danymi systemowymi, nie danymi demo: organizer ich nie tworzy,
 * tylko wybiera z listy (decyzja #10). Dlatego wiersze wstawia migracja,
 * a nie seeder — po samym `migrate:fresh` baza jest kompletna, a seedery
 * zostają przy danych demo.
 *
 * Wartości `config` są przepisane dosłownie z przykładu `GET /sports`
 * w `packages/api-contract/openapi.yaml`. To ten sam komplet, który serwuje
 * mock i przeciw któremu stoi `apps/admin` — rozjazd oznaczałby dwie różne
 * prawdy o tym samym sporcie (decyzja #25).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sports', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 64);
            $table->json('config');
            $table->timestamps();
        });

        $now = now();

        DB::table('sports')->insert([
            [
                'code' => 'football',
                'name' => 'Piłka nożna',
                'config' => json_encode([
                    'allowsDraw' => true,
                    'defaultPoints' => ['win' => 3, 'draw' => 1, 'loss' => 0],
                    'eventTypes' => [
                        ['code' => 'goal', 'label' => 'Bramka', 'hasPlayer' => true, 'stat' => 'goals'],
                        ['code' => 'own_goal', 'label' => 'Bramka samobójcza', 'hasPlayer' => true, 'stat' => null],
                        ['code' => 'yellow_card', 'label' => 'Żółta kartka', 'hasPlayer' => true, 'stat' => 'yellowCards'],
                        ['code' => 'red_card', 'label' => 'Czerwona kartka', 'hasPlayer' => true, 'stat' => 'redCards'],
                    ],
                    'availableTiebreakers' => ['points', 'head_to_head', 'score_diff', 'score_for', 'wins'],
                    'availableStats' => ['goals', 'yellowCards', 'redCards'],
                ], JSON_UNESCAPED_UNICODE),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'basketball',
                'name' => 'Koszykówka',
                'config' => json_encode([
                    'allowsDraw' => false,
                    'defaultPoints' => ['win' => 2, 'draw' => 0, 'loss' => 1],
                    'eventTypes' => [
                        ['code' => 'points', 'label' => 'Punkty', 'hasPlayer' => true, 'stat' => 'points'],
                        ['code' => 'foul', 'label' => 'Faul', 'hasPlayer' => true, 'stat' => 'fouls'],
                    ],
                    'availableTiebreakers' => ['points', 'head_to_head', 'score_diff', 'score_for', 'wins'],
                    'availableStats' => ['points', 'fouls'],
                ], JSON_UNESCAPED_UNICODE),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('sports');
    }
};
