<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bieżąca część meczu na żywo (#297): numer części, start części w UTC (jak
 * `kickoff_at`, ADR-0008) i przerwa po części. Z nich przeglądarka liczy
 * minutę meczu.
 *
 * `on_break` odróżnia przerwę od meczu, który wrócił z `finished` do `live`:
 * oba mają `period_started_at = null`, ale tablica pokazuje „Przerwa” tylko
 * w pierwszym. `live_period` zostaje po zakończeniu meczu, żeby powrót do
 * `live` wiedział, która część była ostatnia (API pokazuje je tylko przy
 * `live`).
 *
 * Mecz trwający w chwili migracji nie ma znanej części ani startu, więc
 * dostaje stan „po powrocie”: 1. część bez zegara, samo „Na żywo”.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->unsignedTinyInteger('live_period')->nullable()->after('status');
            $table->dateTime('period_started_at')->nullable()->after('live_period');
            $table->boolean('on_break')->default(false)->after('period_started_at');
        });

        DB::table('matches')->where('status', 'live')->update(['live_period' => 1]);
    }

    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->dropColumn(['live_period', 'period_started_at', 'on_break']);
        });
    }
};
