<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Kolumna trzyma ścieżkę pliku na dysku `public`, a nie adres (#88, #111):
 * adres składa model z bieżącego `APP_URL`, a po ścieżce kasuje się stary
 * plik. Osobna migracja, a nie poprawka migracji tworzących, bo tamte
 * przeszły już na bazach innych osób.
 */
return new class extends Migration
{
    private const TABLES = ['tournaments', 'teams'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->renameColumn('logo_url', 'logo_path');
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->renameColumn('logo_path', 'logo_url');
            });
        }
    }
};
