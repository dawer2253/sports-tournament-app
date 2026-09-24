<?php

namespace App\Models;

use App\Models\Concerns\GuardsFinishedMatches;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Jedyny korzeń własności w systemie (decyzja #5): każdy inny byt należy do
 * organizera pośrednio, przez turniej.
 *
 * Bez soft-delete: turniej albo nie ma rozegranych meczów i kasuje się na twardo
 * razem z poddrzewem, albo je ma i guard nie pozwala go usunąć wcale.
 */
#[Fillable([
    'user_id', 'sport_id', 'slug', 'name',
    'logo_url', 'primary_color', 'points', 'tiebreakers', 'status',
])]
class Tournament extends Model
{
    use GuardsFinishedMatches;
    use HasFactory;

    /**
     * Kolor marki nowego turnieju. Stała w kodzie, a nie config ani wartość
     * domyślna kolumny: to decyzja produktowa, którą zmienia się razem
     * z przykładami w kontrakcie, a nie per środowisko.
     */
    public const DEFAULT_PRIMARY_COLOR = '#1F7A45';

    /**
     * Fazy, które powstają przy zakładaniu turnieju w danym formacie:
     * [type, name]; `order` wynika z pozycji. Format poza tym nie istnieje —
     * nie jest kolumną turnieju, a po założeniu o strukturze mówią wyłącznie
     * fazy (ADR-0002, „Format" w `CONTEXT.md`).
     *
     * Grupy, kolejki i mecze nie powstają: faza `group` czeka pusta, aż
     * organizer utworzy grupy.
     */
    public const STAGES_BY_FORMAT = [
        'league' => [['league', 'Faza zasadnicza']],
        'knockout' => [['knockout', 'Faza pucharowa']],
        'groups_playoff' => [['group', 'Faza grupowa'], ['knockout', 'Faza pucharowa']],
    ];

    /**
     * Granice sluga są te same co przy ręcznej zmianie (`TournamentUpdate`
     * w kontrakcie), żeby wygenerowany adres dało się też zapisać ręcznie.
     */
    public const SLUG_MIN_LENGTH = 3;

    public const SLUG_MAX_LENGTH = 80;

    /** Nazwa unikalnego indeksu sluga, którą MySQL podaje w komunikacie o duplikacie. */
    private const SLUG_UNIQUE_INDEX = 'tournaments_slug_unique';

    /** Zastępuje slug, z którego po transliteracji nic sensownego nie zostało („A", „!!!"). */
    public const SLUG_FALLBACK = 'turniej';

    /**
     * Zakłada turniej organizera jako szkic, razem z fazami wynikającymi
     * z formatu, w jednej transakcji.
     *
     * Punktacja i tiebreaki są kopią domyślnych dla sportu z chwili zakładania,
     * więc późniejsza zmiana w sporcie nie rusza istniejących turniejów.
     *
     * Slug bierze pierwszy wolny sufiks (`-2`, `-3`…). Sprawdzenie i zapis to
     * dwa kroki, więc równoległe żądanie może zająć slug pomiędzy nimi —
     * rozstrzyga wtedy unikalny indeks, a jego naruszenie przechodzi do
     * kolejnego sufiksu. Sufiks rośnie także po naruszeniu, bez ponownego
     * sprawdzenia tego samego: w transakcji z REPEATABLE READ odczyt nie
     * zobaczyłby cudzego wiersza i pętla kręciłaby się w miejscu.
     *
     * Ponawiana jest wyłącznie kolizja sluga. Każde inne naruszenie unikatu
     * powtórzyłoby się przy każdym sufiksie, więc idzie dalej jako błąd.
     */
    public static function createForOrganizer(User $organizer, Sport $sport, string $name, string $format): self
    {
        $baseSlug = self::baseSlugFrom($name);

        for ($attempt = 1; ; $attempt++) {
            $slug = self::slugCandidate($baseSlug, $attempt);

            if (self::where('slug', $slug)->exists()) {
                continue;
            }

            try {
                return DB::transaction(fn () => self::createWithStages($organizer, $sport, $name, $slug, $format));
            } catch (UniqueConstraintViolationException $violation) {
                if (! str_contains($violation->getMessage(), self::SLUG_UNIQUE_INDEX)) {
                    throw $violation;
                }
            }
        }
    }

    private static function createWithStages(User $organizer, Sport $sport, string $name, string $slug, string $format): self
    {
        $tournament = self::create([
            'user_id' => $organizer->id,
            'sport_id' => $sport->id,
            'name' => $name,
            'slug' => $slug,
            'logo_url' => null,
            'primary_color' => self::DEFAULT_PRIMARY_COLOR,
            'points' => $sport->defaultPoints(),
            'tiebreakers' => $sport->defaultTiebreakers(),
            'status' => 'draft',
        ]);

        foreach (self::STAGES_BY_FORMAT[$format] as $index => [$type, $stageName]) {
            $tournament->stages()->create([
                'type' => $type,
                'name' => $stageName,
                'order' => $index + 1,
            ]);
        }

        return $tournament;
    }

    /** Transliteracja (`ł` → `l`), przycięcie do limitu, a gdy nic nie zostało — `turniej`. */
    private static function baseSlugFrom(string $name): string
    {
        $slug = self::truncateSlug(Str::slug($name), self::SLUG_MAX_LENGTH);

        return strlen($slug) < self::SLUG_MIN_LENGTH ? self::SLUG_FALLBACK : $slug;
    }

    /** Pierwsza próba to sam slug, kolejne dostają sufiks mieszczący się w limicie. */
    private static function slugCandidate(string $baseSlug, int $attempt): string
    {
        if ($attempt === 1) {
            return $baseSlug;
        }

        $suffix = '-'.$attempt;

        return self::truncateSlug($baseSlug, self::SLUG_MAX_LENGTH - strlen($suffix)).$suffix;
    }

    /**
     * Przycina na granicy słowa. Twardo tylko wtedy, gdy granicy nie ma albo
     * zostawiłaby slug krótszy niż minimum — jedno bardzo długie słowo nie
     * może skończyć się pustym adresem.
     */
    private static function truncateSlug(string $slug, int $maxLength): string
    {
        if (strlen($slug) <= $maxLength) {
            return $slug;
        }

        if ($slug[$maxLength] === '-') {
            return substr($slug, 0, $maxLength);
        }

        $cut = substr($slug, 0, $maxLength);
        $lastBoundary = strrpos($cut, '-');

        if ($lastBoundary === false || $lastBoundary < self::SLUG_MIN_LENGTH) {
            return rtrim($cut, '-');
        }

        return substr($cut, 0, $lastBoundary);
    }

    protected function casts(): array
    {
        return [
            'points' => 'array',
            'tiebreakers' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sport(): BelongsTo
    {
        return $this->belongsTo(Sport::class);
    }

    public function stages(): HasMany
    {
        return $this->hasMany(Stage::class);
    }

    public function groups(): HasMany
    {
        return $this->hasMany(Group::class);
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    public function venues(): HasMany
    {
        return $this->hasMany(Venue::class);
    }

    public function matches(): HasManyThrough
    {
        return $this->hasManyThrough(GameMatch::class, Stage::class);
    }

    public function hasFinishedMatches(): bool
    {
        return $this->matches()->where('matches.status', 'finished')->exists();
    }

    protected function guardLabel(): string
    {
        return "turniej „{$this->name}”";
    }
}
