<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Turniej jest jedynym korzeniem własności (decyzja #5): wszystko inne należy
 * do organizera przez tę tabelę.
 *
 * Bez soft-delete i to nie jest przeoczenie. Turniej albo nie ma rozegranych
 * meczów i kasuje się na twardo razem z poddrzewem (zwalniając `slug`), albo
 * je ma i guard nie pozwala go usunąć wcale. Trzeciego stanu nie ma, więc
 * znacznik „usunięty" nie miałby czego obsługiwać.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournaments', function (Blueprint $table) {
            $table->id();
            // `restrict`, nie `cascade`: kaskada z `users` obchodziłaby guard
            // i kasowała turnieje z rozegranymi meczami. Konto z turniejami
            // zamyka się anonimizacją, nie usunięciem wiersza — patrz ADR-0005.
            // Nie łamie to zakazu `RESTRICT` z tego samego ADR-a, bo `users`
            // leży poza poddrzewem turnieju i nie bierze udziału w jego kaskadzie.
            $table->foreignId('user_id')->constrained()->restrictOnDelete();

            // Sport leży poza poddrzewem turnieju i nigdy nie jest kasowany,
            // więc restrict nie wejdzie w drogę kaskadzie usuwania turnieju.
            $table->foreignId('sport_id')->constrained()->restrictOnDelete();

            // Globalnie unikalny, bo wprost buduje publiczny adres /t/{slug}.
            // 120 znaków z zapasem: kontrakt ogranicza zapis do 80.
            $table->string('slug', 120)->unique();
            $table->string('name', 160);

            $table->string('logo_url')->nullable();
            $table->char('primary_color', 7);

            // Punktacja i kolejność tiebreaków tego turnieju, kopiowane przy
            // zakładaniu z `Sport.config`. Bez wartości domyślnej w bazie:
            // null oznaczałby drugie źródło prawdy o punktacji.
            $table->json('points');
            $table->json('tiebreakers');

            $table->enum('status', ['draft', 'active', 'finished'])->default('draft');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournaments');
    }
};
