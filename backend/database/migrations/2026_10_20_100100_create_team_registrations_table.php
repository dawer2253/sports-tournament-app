<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Zgłoszenie drużyny (#300, `TeamRegistration` w `CONTEXT.md`).
 *
 * Dane zgłaszającego i skład są `nullable`, bo odrzucenie je usuwa, a wiersz
 * zostaje z nazwą drużyny i chwilą decyzji. Skład to JSON, bo zgłoszenie nie
 * jest drużyną i jego zawodnicy nie są `Player`: nie mają zdarzeń ani
 * statystyk, dopóki przyjęcie nie utworzy z nich zawodników.
 *
 * `team_id` z `nullOnDelete` tylko dla porządku: drużyna znika miękko, a jej
 * zgłoszenie usuwa wtedy model (`Team::booted()`); twardo drużyny kasuje
 * wyłącznie turniej, który kaskadą zabiera też zgłoszenia.
 *
 * Bez unikatu na nazwę: dwa oczekujące zgłoszenia o tej samej nazwie są
 * dozwolone, a rozstrzyga je przyjęcie (`CONTEXT.md`).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_registrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tournament_id')->constrained()->cascadeOnDelete();
            $table->foreignId('team_id')->nullable()->constrained()->nullOnDelete();
            $table->string('team_name', 120);
            $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->string('contact_name', 120)->nullable();
            $table->string('contact_email', 254)->nullable();
            $table->string('contact_phone', 40)->nullable();
            $table->json('players')->nullable();
            $table->dateTime('decided_at')->nullable();
            $table->timestamps();

            $table->index(['tournament_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_registrations');
    }
};
