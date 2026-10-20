<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wyniki setów meczu (#301, ADR-0012): lista `{home, away}` w kolejności
 * setów, w sporcie z setami pusta przed pierwszym setem, w pozostałych
 * `null`. `home_score` i `away_score` to wtedy sety wygrane, liczone przez
 * serwer z tej listy przy zapisie.
 *
 * Bez wypełniania istniejących meczów: do tej migracji żaden sport nie miał
 * setów, więc wszystkie dotychczasowe mecze mają tu `null`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->json('sets')->nullable()->after('away_penalties');
        });
    }

    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->dropColumn('sets');
        });
    }
};
