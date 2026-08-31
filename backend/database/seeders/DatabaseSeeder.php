<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed daje jedno: komplet danych demo. Sporty wstawia migracja, więc
     * po `migrate:fresh --seed` baza ma i dane systemowe, i turniej do klikania.
     */
    public function run(): void
    {
        $this->call(DemoTournamentSeeder::class);
    }
}
