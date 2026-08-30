<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Zdarzenie meczowe: bramka, kartka, faul. Źródło statystyk indywidualnych,
 * nie źródło wyniku meczu — wynik wpisuje się osobno.
 *
 * `type` jest kolumną tekstową, nie enumem, i to jest celowe: zbiór
 * dopuszczalnych wartości wynika z `Sport.config.eventTypes`, więc dodanie
 * sportu ma pozostać seedem, a nie migracją (decyzja #10). Walidacja przeciw
 * konfiguracji sportu należy do Form Requesta.
 *
 * `minute` i `player_id` są nullowalne, bo kartka dla ławki albo punkty bez
 * przypisania zdarzają się realnie, a koszykówka liczy czas kwartami — reszta
 * współrzędnych mieści się w `meta`. Kontrakt v0.1 tej encji nie eksponuje
 * (wchodzi w v0.2), więc jej kształt jest zakotwiczony w `CONTEXT.md`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('match_id')->constrained('matches')->cascadeOnDelete();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('player_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 32);
            $table->unsignedTinyInteger('minute')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            // Zdarzenia jednego meczu (widok meczu) i klasyfikacja strzelców
            // (agregacja po zawodniku i rodzaju zdarzenia).
            $table->index('match_id');
            $table->index(['player_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_events');
    }
};
