<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drużyna należy do jednego turnieju i nie jest współdzielona między turniejami
 * (decyzja #8). Soft-delete obsługuje pomyłkę organizera, dopóki guard
 * `finished` nie zamknie sprawy.
 *
 * Bez unikatu na `(tournament_id, name)`: dwie „Rezerwy" w jednym turnieju to
 * nie jest rzecz, na której admin ma dostać błąd z bazy, a przy soft-delete
 * unikat liczyłby też usunięte wiersze.
 *
 * **Przynależność grupy do tego samego turnieju pilnuje aplikacja, nie baza.**
 * Próbowaliśmy w bazie i się nie da — powód opisuje ADR-0005.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();

            // Drużyna należy do co najwyżej jednej grupy — stąd kolumna,
            // nie tabela pośrednia. Usunięcie grupy zeruje przypisanie,
            // zamiast kasować drużynę razem z zawodnikami.
            $table->foreignId('group_id')->nullable()->constrained()->nullOnDelete();

            $table->string('name', 120);
            $table->string('logo_url')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teams');
    }
};
