<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Faza istnieje zawsze, także w zwykłej lidze (ADR-0002). Turniej nie ma
 * kolumny `format` — strukturę opisują właśnie fazy.
 *
 * Kolumna `order` koliduje ze słowem zarezerwowanym w SQL-u i zostaje, bo tak
 * nazywa ją kontrakt. W surowym SQL-u cytuj ją backtickami (patrz `AGENTS.md`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['league', 'group', 'knockout']);
            $table->string('name', 80);
            $table->unsignedTinyInteger('order');
            $table->timestamps();

            // Porządek faz jest strukturą turnieju, nie danymi organizera.
            $table->unique(['tournament_id', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stages');
    }
};
