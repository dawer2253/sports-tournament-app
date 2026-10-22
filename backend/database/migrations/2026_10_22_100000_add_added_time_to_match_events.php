<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Doliczony czas zdarzenia (#317): `minute: 45, added_time: 3` to „45+3′”.
 * Osobna kolumna zamiast zwykłej liczby w `minute`, bo część meczu liczy się
 * z samej `minute` — 45+3 ma zostać w 1. połowie. Stare zdarzenia, w których
 * „45+2” zapisano jako `47`, zostają bez migracji danych.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('match_events', function (Blueprint $table) {
            $table->unsignedTinyInteger('added_time')->nullable()->after('minute');
        });
    }

    public function down(): void
    {
        Schema::table('match_events', function (Blueprint $table) {
            $table->dropColumn('added_time');
        });
    }
};
