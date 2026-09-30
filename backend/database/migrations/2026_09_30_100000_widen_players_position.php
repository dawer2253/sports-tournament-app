<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kontrakt dopuszcza `position` do 60 znaków (decyzja #80), a kolumna miała
 * 40. Wygrywa kontrakt (ADR-0001). Osobna migracja, a nie poprawka
 * `create_players_table`, bo tamta mogła już przejść na bazach innych osób.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->string('position', 60)->nullable()->change();
        });
    }

    /**
     * Cofnięcie obetnie pozycje dłuższe niż 40 znaków albo się wywali,
     * zależnie od trybu SQL-a — to świadome, bo stan sprzed migracji ich
     * nie mieścił.
     */
    public function down(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->string('position', 40)->nullable()->change();
        });
    }
};
