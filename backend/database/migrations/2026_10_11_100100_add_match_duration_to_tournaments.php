<?php

use App\Schedule\MatchDurationBackfill;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Długość meczu turnieju (#158): razem z przerwą po nim, w minutach 10–600.
 * Wyznacza slot rozkładu dat i okno kolizji.
 *
 * Istniejące turnieje dostają wartość ze swojego sportu, tak samo jak przy
 * zakładaniu. Kolumna powstaje jako `nullable`, jest wypełniana, a dopiero
 * potem zacieśniana do `NOT NULL` — bez wartości domyślnej w bazie, bo
 * oznaczałaby drugie źródło prawdy o długości meczu (tak jak `points`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->unsignedSmallInteger('match_duration')->nullable()->after('tiebreakers');
        });

        // Wypełnienie ze sportu turnieju. Config czyta się w PHP, więc migracja
        // nie zależy od składni JSON-a w MySQL-u.
        MatchDurationBackfill::run();

        Schema::table('tournaments', function (Blueprint $table) {
            $table->unsignedSmallInteger('match_duration')->change();
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn('match_duration');
        });
    }
};
