<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Konta organizerów zespołu obok konta Dawida: Julia i Wojciech. Każde ma te
 * same dane demo co Dawid (patrz `DemoTournamentSeeder`), tyle że we własnych
 * kopiach turniejów — slug jest globalnie unikalny, więc kopie dostają
 * dopisek z klucza konta (`liga-osiedlowa-2026-julia`). Hasło jak u Dawida.
 */
class TeamAdminsSeeder extends Seeder
{
    /** Klucz konta (dopisek sluga) => [e-mail, imię]. */
    private const ADMINS = [
        'julia' => ['julia@example.com', 'Julia Gawlik'],
        'wojciech' => ['wojciech@example.com', 'Wojciech Czachurski'],
    ];

    public function run(): void
    {
        $demo = new DemoTournamentSeeder;

        foreach (self::ADMINS as $key => [$email, $name]) {
            $organizer = User::firstOrCreate(
                ['email' => $email],
                ['name' => $name, 'password' => 'tajnehaslo123'],
            );

            $demo->seedFor($organizer, $key);
        }
    }
}
