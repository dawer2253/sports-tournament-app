<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Jeden byt o dwóch etykietach w UI: „kolejka" w fazie `league` i `group`,
 * „runda" w fazie `knockout`. W kodzie i w API występuje wyłącznie `Round`.
 *
 * Kolumna `order` — patrz uwaga o słowach zarezerwowanych w `stages`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rounds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stage_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->unsignedTinyInteger('order');
            $table->timestamps();

            $table->unique(['stage_id', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rounds');
    }
};
