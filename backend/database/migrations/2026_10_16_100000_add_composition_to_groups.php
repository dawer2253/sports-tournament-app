<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Skład grup (#258): `order` to kolejność grupy w fazie, a `qualifiers` to liczba
 * drużyn wychodzących z niej do drabinki playoffu (#250).
 *
 * Unikat `(stage_id, order)` trzyma kolejność grup rozłączną — tak samo jak
 * `(stage_id, order)` w `rounds`. Kolumna `order` koliduje ze słowem
 * zarezerwowanym MySQL 8 i zostaje, bo jest kanoniczna (`AGENTS.md`); Query
 * Builder i Eloquent cytują identyfikatory same.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->unsignedTinyInteger('order')->after('name');
            $table->unsignedTinyInteger('qualifiers')->after('order');

            $table->unique(['stage_id', 'order']);
        });
    }

    public function down(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->dropUnique(['stage_id', 'order']);
            $table->dropColumn(['order', 'qualifiers']);
        });
    }
};
