<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Format seta turnieju (#301, ADR-0012): `setsToWin`, `setPoints`,
 * `decidingSetPoints` i `minLead` jednym obiektem JSON, bo zmieniają się
 * i blokują razem (`TournamentUpdate.setFormat`). `null` w sporcie bez setów.
 *
 * Bez wypełniania istniejących turniejów: do tej migracji żaden sport nie
 * miał setów, więc wszystkie dotychczasowe turnieje mają tu `null`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->json('set_format')->nullable()->after('period_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn('set_format');
        });
    }
};
