<?php

use App\Matches\PeriodsBackfill;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Podział meczu turnieju na części (#210): liczba części 1–10 i minuty jednej
 * części, `null` przy jednej części („bez podziału”). Z nich strona meczu
 * liczy część każdego zdarzenia przy odczycie.
 *
 * Istniejące turnieje dostają podział ze swojego sportu, tak samo jak przy
 * zakładaniu, wzorem `add_match_duration_to_tournaments`: `period_count`
 * powstaje jako `nullable`, jest wypełniane, a dopiero potem zacieśniane do
 * `NOT NULL`, bez wartości domyślnej w bazie.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->unsignedTinyInteger('period_count')->nullable()->after('match_duration');
            $table->unsignedTinyInteger('period_minutes')->nullable()->after('period_count');
        });

        PeriodsBackfill::run();

        Schema::table('tournaments', function (Blueprint $table) {
            $table->unsignedTinyInteger('period_count')->change();
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn(['period_count', 'period_minutes']);
        });
    }
};
