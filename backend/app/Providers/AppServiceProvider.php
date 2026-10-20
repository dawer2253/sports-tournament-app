<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Najwięcej zgłoszeń drużyn z jednego IP na godzinę, do wszystkich
     * turniejów łącznie (#300, opis `POST /public/t/{slug}/registrations`
     * w kontrakcie). Zmienia się razem z kontraktem.
     */
    public const TEAM_REGISTRATIONS_PER_HOUR = 5;

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Formularz zgłoszenia to jedyny zapis bez logowania, więc jedyna
        // trasa z limitem. Klucz po samym IP, nie po turnieju: spam idzie
        // zwykle po wielu turniejach naraz.
        RateLimiter::for('team-registrations', fn (Request $request): Limit => Limit::perHour(self::TEAM_REGISTRATIONS_PER_HOUR)->by($request->ip()));
    }
}
