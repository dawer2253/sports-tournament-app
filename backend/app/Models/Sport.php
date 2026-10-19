<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sport jest predefiniowany: organizer go nie tworzy, tylko wybiera z listy,
 * a potem dostraja parametry w obrębie swojego turnieju (decyzja #10).
 *
 * Wiersze wstawia migracja, nie seeder, więc `SportFactory` celowo nie istnieje
 * — losowy sport to byt, którego w produkcji nie ma.
 */
#[Fillable(['code', 'name', 'config'])]
class Sport extends Model
{
    /**
     * Nagłówek kolumny zdobyczy w tabeli (`StandingTable.scoreLabel`). Etykietę
     * niesie odpowiedź tabeli, a wyprowadza ją serwer ze sportu (ADR-0006).
     * Stała w kodzie, a nie pole `config`, bo `config` jest przepisany
     * z przykładu `GET /sports` w kontrakcie, a tam tej etykiety nie ma.
     */
    private const SCORE_LABELS = [
        'football' => 'Bramki',
        'basketball' => 'Punkty',
    ];

    protected function casts(): array
    {
        return ['config' => 'array'];
    }

    public function tournaments(): HasMany
    {
        return $this->hasMany(Tournament::class);
    }

    /** Punktacja domyślna dla sportu, kopiowana do turnieju przy zakładaniu. */
    public function defaultPoints(): array
    {
        return $this->config['defaultPoints'];
    }

    /**
     * Domyślna długość meczu w minutach, kopiowana do turnieju przy zakładaniu
     * (#158). Turniej zmienia ją potem u siebie, więc sport nigdy sam nie
     * wyznacza długości meczu.
     */
    public function defaultMatchDuration(): int
    {
        return $this->config['defaultMatchDuration'];
    }

    /**
     * Domyślny podział meczu na części, kopiowany do turnieju przy zakładaniu
     * (#210), wzorem `defaultMatchDuration()`.
     *
     * @return array{count: int, minutes: ?int}
     */
    public function defaultPeriods(): array
    {
        return $this->config['defaultPeriods'];
    }

    /**
     * Domyślna kolejność tiebreaków, kopiowana do turnieju przy zakładaniu
     * (decyzja #25). Organizer zmienia ją potem u siebie, nie w sporcie.
     */
    public function defaultTiebreakers(): array
    {
        return $this->config['defaultTiebreakers'];
    }

    /** Kryteria, spośród których organizer może układać kolejność w turnieju. */
    public function availableTiebreakers(): array
    {
        return $this->config['availableTiebreakers'];
    }

    /** Kody zdarzeń dopuszczalnych w tym sporcie. */
    public function eventTypeCodes(): array
    {
        return array_column($this->config['eventTypes'], 'code');
    }

    /**
     * Typ zdarzenia z `config.eventTypes` po kodzie (`code`, `label`,
     * `hasPlayer`, `value`, `stat`), albo `null`, gdy sport go nie zna.
     *
     * @return array{code: string, label: string, hasPlayer: bool, value: int, stat: ?string}|null
     */
    public function eventType(string $code): ?array
    {
        foreach ($this->config['eventTypes'] as $type) {
            if ($type['code'] === $code) {
                return $type;
            }
        }

        return null;
    }

    public function allowsDraw(): bool
    {
        return $this->config['allowsDraw'];
    }

    /** Czy zegar meczu biegnie w minutach (#297): piłka tak, kosz pokazuje kwartę. */
    public function runningClock(): bool
    {
        return $this->config['runningClock'];
    }

    public function scoreLabel(): string
    {
        return self::SCORE_LABELS[$this->code];
    }

    /**
     * Etykieta kryterium z `config.tiebreakerLabels` (`StandingTable.tiebreakers`).
     * Turniej przyjmuje wyłącznie kryteria z `availableTiebreakers` sportu,
     * a klucze etykiet to dokładnie ta lista, więc brak etykiety to błąd danych.
     */
    public function tiebreakerLabel(string $code): string
    {
        return $this->config['tiebreakerLabels'][$code];
    }

    /**
     * Kody statystyk klasyfikacji (#190). Pierwszy wpis to klasyfikacja
     * domyślna: piłka `goals`, kosz `points`.
     *
     * @return list<string>
     */
    public function availableStats(): array
    {
        return $this->config['availableStats'];
    }

    /**
     * Etykieta statystyki z `config.statLabels`. Klucze etykiet to dokładnie
     * `availableStats`, więc brak etykiety to błąd danych.
     */
    public function statLabel(string $stat): string
    {
        return $this->config['statLabels'][$stat];
    }

    /**
     * Typy zdarzeń wliczane do statystyki, jako `kod => value`. Typ ze
     * `stat: null` (samobój) nie wlicza się do żadnej.
     *
     * @return array<string, int>
     */
    public function statEventValues(string $stat): array
    {
        $values = [];

        foreach ($this->config['eventTypes'] as $type) {
            if ($type['stat'] === $stat) {
                $values[$type['code']] = $type['value'];
            }
        }

        return $values;
    }
}
