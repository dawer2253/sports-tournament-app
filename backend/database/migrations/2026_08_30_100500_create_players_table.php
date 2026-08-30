<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Zawodnik istnieje po to, żeby przypisywać mu zdarzenia meczowe i budować
 * z nich statystyki indywidualne.
 *
 * Bez unikatu na `(team_id, number)`: dwóch zawodników bez numeru to normalny
 * stan, a numery bywają wpisywane później niż nazwiska.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->unsignedTinyInteger('number')->nullable();
            $table->string('position', 40)->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('players');
    }
};
