<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Grupy istnieją wyłącznie wewnątrz fazy `group`.
 *
 * `tournament_id` jest zdenormalizowane (wynika ze `stage_id`) i służy do
 * taniego sprawdzenia, czy grupa i drużyna należą do tego samego turnieju —
 * bez wspinania się przez `stage`. Samo sprawdzenie robi aplikacja: powód,
 * dla którego baza go nie egzekwuje, opisuje migracja `teams`.
 *
 * Nazwa tabeli koliduje ze słowem zarezerwowanym w MySQL 8 (`GROUPS`, od 8.0.2)
 * i zostaje, bo `Group` to nazwa kanoniczna z `CONTEXT.md`. W surowym SQL-u
 * cytuj ją backtickami (patrz `AGENTS.md`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stage_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();
            $table->string('name', 40);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('groups');
    }
};
