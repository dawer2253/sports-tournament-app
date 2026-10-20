<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Zapisy turnieju (#300): przełącznik organizera i opcjonalny termin w UTC
 * (jak `kickoff_at`, ADR-0008). Istniejące turnieje dostają zapisy zamknięte,
 * tak jak nowy turniej.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->boolean('registration_open')->default(false)->after('status');
            $table->dateTime('registration_deadline')->nullable()->after('registration_open');
        });
    }

    public function down(): void
    {
        Schema::table('tournaments', function (Blueprint $table) {
            $table->dropColumn(['registration_open', 'registration_deadline']);
        });
    }
};
