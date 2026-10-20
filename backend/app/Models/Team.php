<?php

namespace App\Models;

use App\Exceptions\StartedMatchGuardException;
use App\Models\Concerns\GuardsStartedMatches;
use App\Models\Concerns\HasLogo;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * Uczestnik turnieju. Dwie drużyny o tej samej nazwie w dwóch turniejach to
 * dwa niepowiązane byty (decyzja #8).
 */
#[Fillable(['tournament_id', 'group_id', 'name', 'logo_path'])]
class Team extends Model
{
    use GuardsStartedMatches;
    use HasFactory;
    use HasLogo;
    use SoftDeletes;

    /**
     * Najwięcej żywych zawodników w drużynie (decyzja #80, opis `POST
     * /teams/{team}/players` w kontrakcie). Zmienia się razem z kontraktem.
     */
    public const MAX_PLAYERS = 50;

    /**
     * Kaskada: zawodnik nie istnieje bez drużyny (`CONTEXT.md`), więc
     * miękkie usunięcie drużyny usuwa miękko jej zawodników. Tak samo
     * znikają jej mecze `scheduled` (#171): mecz z drużyną, której już nie
     * ma, nie zostanie rozegrany. Obie kaskady siedzą w modelu z tego samego
     * powodu co guard — nie ominie ich ani seeder, ani przyszły kod
     * (`GuardsStartedMatches`).
     *
     * Zdarzenie `deleted`, nie `deleting`: guard odpala w `deleting`, więc
     * odrzucone usunięcie nie dochodzi tu wcale i zawodnicy oraz mecze
     * zostają nietknięci, bez zależności od kolejności rejestrowania nasłuchów.
     *
     * Każdy zawodnik idzie przez własny `delete()`, więc i przez swój guard.
     * Guard drużyny go nie zastępuje: baza nie wiąże zawodnika zdarzenia
     * z drużyną meczu, więc zawodnik może mieć rozegrany mecz, którego jego
     * drużyna nie ma. Usunięcie twarde załatwia `cascadeOnDelete` w bazie.
     *
     * Mecze kasuje jedno zapytanie, bez zdarzeń: `GameMatch` nie ma guarda
     * ani nasłuchów, a guard drużyny przepuścił ją tylko bez meczów `live`
     * i `finished`. Reszty terminarza kasowanie nie rusza — kolejki zostają,
     * także puste, a pozostałe mecze zachowują `match_number`, więc w kolejce
     * mogą powstać dziury (opis `DELETE /teams/{team}` w kontrakcie).
     *
     * Drabinki (faza `knockout`) nie da się tak załatać (#215): drużyna
     * stojąca w drabince zabiera ze sobą całą drabinkę fazy, rundy i mecze,
     * a po pierwszym meczu rozpoczętym fazy usunięcie jest zablokowane, także
     * dla drużyny, która jeszcze nie grała. Odmowa idzie w `deleting`, obok
     * guarda, więc tak samo nie dochodzi do kaskady.
     */
    protected static function booted(): void
    {
        static::deleting(function (self $team): void {
            if ($team->bracketStages()->contains(fn (Stage $stage): bool => $stage->hasStartedMatches())) {
                throw StartedMatchGuardException::forBracket($team->name);
            }
        });

        static::deleted(function (self $team): void {
            if (! $team->isForceDeleting()) {
                $team->players()->get()->each->delete();
                // Mecze drabinki znikają kaskadą z rundami.
                Round::query()->whereIn('stage_id', $team->bracketStages()->modelKeys())->delete();
                $team->matchesQuery()->where('status', 'scheduled')->delete();
                // Przyjęte zgłoszenie żyje tak długo jak jego drużyna, razem
                // z danymi zgłaszającego (#300, `CONTEXT.md`).
                $team->registration()->delete();
            }
        });
    }

    /**
     * Fazy `knockout`, w których drużyna stoi w którymś meczu. Drużyna dodana
     * po wygenerowaniu drabinki w niej nie stoi, więc usuwa się jak w lidze.
     *
     * @return Collection<int, Stage>
     */
    private function bracketStages(): Collection
    {
        return Stage::query()
            ->where('type', 'knockout')
            ->whereIn('id', $this->matchesQuery()->select('stage_id'))
            ->get();
    }

    /**
     * Drużyna, jej zawodnicy i jej mecze `scheduled` (w pucharze cała
     * drabinka) znikają razem albo wcale: odmowa guarda zawodnika w kaskadzie
     * cofa też usunięcie drużyny i jej meczów.
     */
    public function delete(): ?bool
    {
        return DB::transaction(fn (): ?bool => parent::delete());
    }

    public function tournament(): BelongsTo
    {
        return $this->belongsTo(Tournament::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function players(): HasMany
    {
        return $this->hasMany(Player::class);
    }

    /** Zgłoszenie, z którego przyjęcia powstała drużyna, jeśli takie było. */
    public function registration(): HasOne
    {
        return $this->hasOne(TeamRegistration::class);
    }

    public function homeMatches(): HasMany
    {
        return $this->hasMany(GameMatch::class, 'home_team_id');
    }

    public function awayMatches(): HasMany
    {
        return $this->hasMany(GameMatch::class, 'away_team_id');
    }

    /**
     * Mecze drużyny po obu stronach — gospodarz i gość to ta sama drużyna
     * widziana z dwóch stron terminarza. Świadomie **nie** jest relacją:
     * Eloquent nie umie zrobić `HasMany` po dwóch kluczach naraz, a metoda
     * nazwana `matches()` i zwracająca Buildera wywalałaby się w `with()`
     * i `withCount()`. Do eager loadingu są `homeMatches` i `awayMatches`.
     */
    public function matchesQuery(): Builder
    {
        return GameMatch::query()
            ->where(fn ($query) => $query
                ->where('home_team_id', $this->getKey())
                ->orWhere('away_team_id', $this->getKey()));
    }

    /**
     * Liczniki, których wymaga `TeamResource`, do `withCount()` na liście
     * i `loadCount()` przy pojedynczej drużynie — jedna lista dla wszystkich
     * odpowiedzi z drużyną.
     *
     * Mecze `scheduled` to suma dwóch liczników po relacjach, bo
     * `matchesQuery()` nie jest relacją i `withCount` go nie przyjmie.
     * Suma nie liczy meczu dwa razy: drużyna nie gra sama ze sobą.
     *
     * @return array<int|string, mixed>
     */
    public static function resourceCounts(): array
    {
        $scheduled = fn (Builder $query) => $query->where('status', 'scheduled');

        return [
            'players',
            'homeMatches as scheduled_home_matches_count' => $scheduled,
            'awayMatches as scheduled_away_matches_count' => $scheduled,
        ];
    }

    /**
     * Czy grupa, do której przypisujemy drużynę, należy do tego samego turnieju.
     *
     * Bazy o to nie prosimy — dlaczego, tłumaczy migracja `teams`. Wywołaj to
     * z Form Requesta przed zapisem `group_id`.
     */
    public function groupBelongsToSameTournament(?Group $group): bool
    {
        return $group === null || $group->tournament_id === $this->tournament_id;
    }

    /**
     * Pod katalogiem turnieju, żeby usunięcie turnieju zabrało herb razem
     * z resztą jego plików. Miękkie usunięcie drużyny herbu nie rusza (#111).
     */
    protected function logoDirectory(): string
    {
        return Tournament::storageDirectoryFor($this->tournament_id)."/teams/{$this->id}";
    }

    public function hasStartedMatches(): bool
    {
        return $this->matchesQuery()->whereIn('status', GameMatch::STARTED_STATUSES)->exists();
    }

    protected function guardLabel(): string
    {
        return "drużyna „{$this->name}”";
    }

    /**
     * Drużyna w kształcie `TeamSummary` kontraktu: jedno miejsce dla zasobów
     * meczu, zdarzenia, strzelców i listy drużyn strony publicznej.
     *
     * @return array{id: int, name: string, logoUrl: ?string}
     */
    public function summary(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'logoUrl' => $this->logoUrl()];
    }
}
