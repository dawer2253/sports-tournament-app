<?php

use App\Models\Tournament;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Slug nowego turnieju
|--------------------------------------------------------------------------
|
| Slug buduje publiczny adres `/t/{slug}`, więc wygenerowany musi spełniać te
| same reguły co wpisany ręcznie w `TournamentUpdate`: 3–80 znaków i wzorzec
| niżej. Inaczej organizer dostałby adres, którego sam nie mógłby zapisać.
|
*/

const SLUG_PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

beforeEach(function () {
    Spectator::using('openapi.yaml');
});

function createTournamentNamed(string $name): TestResponse
{
    return actingAsOrganizer()
        ->postJson('/api/v1/tournaments', [
            'name' => $name,
            'sportId' => sport('football')->id,
            'format' => 'league',
        ])
        ->assertValidRequest()
        ->assertValidResponse(201);
}

function expectSlugAcceptedByTournamentUpdate(string $slug): void
{
    expect($slug)->toMatch(SLUG_PATTERN)
        ->and(strlen($slug))->toBeGreaterThanOrEqual(3)->toBeLessThanOrEqual(80);
}

it('transliteruje polskie znaki w slugu', function () {
    createTournamentNamed('Żółta Łódź')->assertJsonPath('data.slug', 'zolta-lodz');
});

// Slug jest globalnie unikalny, a nazwa nie — dwóch organizerów może mieć
// „Ligę Osiedlową". Kolejne sufiksy, bo `-2` powtórzone dałoby kolizję.
it('dokleja kolejny sufiks przy powtórzonej nazwie', function () {
    createTournamentNamed('Żółta Łódź')->assertJsonPath('data.slug', 'zolta-lodz');
    createTournamentNamed('Żółta Łódź')->assertJsonPath('data.slug', 'zolta-lodz-2');
    createTournamentNamed('Żółta Łódź')->assertJsonPath('data.slug', 'zolta-lodz-3');
});

// Z „A" wychodzi `a` (za krótki), z „!!!" i emoji — pusty string, czyli
// adres `/t/`. Oba zastępuje słowo, które spełnia reguły.
it('zastępuje za krótki albo pusty slug słowem „turniej"', function (string $name) {
    $slug = createTournamentNamed($name)->json('data.slug');

    expect($slug)->toBe('turniej');
    expectSlugAcceptedByTournamentUpdate($slug);
})->with(['A', '!!!', '⚽⚽⚽']);

it('dokleja sufiks także do zastępczego sluga', function () {
    createTournamentNamed('A')->assertJsonPath('data.slug', 'turniej');
    createTournamentNamed('!!!')->assertJsonPath('data.slug', 'turniej-2');
});

// Przycięcie na granicy słowa: slug jest początkiem pełnego sluga z nazwy,
// a w pełnym slugu zaraz po nim stoi myślnik — nie zostaje urwane słowo.
// Nazwa ma 160 znaków, czyli najdłuższą, jaką przepuszcza walidacja.
it('przycina slug z najdłuższej nazwy do 80 znaków na granicy słowa, także z sufiksem', function () {
    $name = str_repeat('Rozgrywki ', 15).'Osiedlowe';
    expect(mb_strlen($name))->toBe(159);
    $name .= 'x';
    $fullSlug = str_repeat('rozgrywki-', 15).'osiedlowex';

    $first = createTournamentNamed($name)->json('data.slug');
    $second = createTournamentNamed($name)->json('data.slug');

    expectSlugAcceptedByTournamentUpdate($first);
    expect(str_starts_with($fullSlug, $first.'-'))->toBeTrue();

    expectSlugAcceptedByTournamentUpdate($second);
    expect($second)->toEndWith('-2');
    $secondBase = substr($second, 0, -2);
    expect(str_starts_with($fullSlug, $secondBase.'-'))->toBeTrue();
});

// Jedno słowo dłuższe niż limit nie ma granicy, na której dałoby się uciąć,
// więc zostaje ucięte twardo — zamiast pustego sluga albo przekroczenia limitu.
it('przycina twardo jedno słowo dłuższe niż limit, także z sufiksem', function () {
    $name = str_repeat('a', 160);

    createTournamentNamed($name)->assertJsonPath('data.slug', str_repeat('a', 80));
    createTournamentNamed($name)->assertJsonPath('data.slug', str_repeat('a', 78).'-2');
});

// Wyścig: sprawdzenie wolnego sluga i zapis to dwa kroki, więc równoległe
// żądanie może zająć slug pomiędzy nimi. Rozstrzyga unikalny indeks, a jego
// naruszenie ma skończyć się kolejnym sufiksem, nie 500.
//
// Konkurenta gra osobne połączenie z bazą, które zatwierdza swój wiersz
// naprawdę — w tym samym połączeniu wstawka zniknęłaby razem z savepointem
// nieudanej próby i test niczego by nie dowodził.
//
// Zatwierdzone wiersze sprząta sam test, bo `RefreshDatabase` cofa wyłącznie
// własną transakcję. Sprzątanie musi przy tym poczekać na ten rollback:
// nieudany zapis zostawia na zduplikowanym kluczu blokadę, którą główne
// połączenie trzyma do końca transakcji, więc wcześniejszy `delete` czekałby
// na nią do timeoutu. Callbacki `beforeApplicationDestroyed` idą w kolejności
// rejestracji, a ten od `RefreshDatabase` powstaje przed ciałem testu.
it('bierze kolejny sufiks, gdy równoległe żądanie zajmie slug między sprawdzeniem a zapisem', function () {
    config(['database.connections.rival' => config('database.connections.'.config('database.default'))]);
    $rival = DB::connection('rival');

    $rivalUserId = $rival->table('users')->insertGetId([
        'name' => 'Konkurent',
        'email' => 'konkurent-'.uniqid().'@example.com',
        'password' => 'x',
    ]);

    $this->beforeApplicationDestroyed(function () use ($rival, $rivalUserId) {
        $rival->table('tournaments')->where('user_id', $rivalUserId)->delete();
        $rival->table('users')->where('id', $rivalUserId)->delete();
        $rival->disconnect();
    });

    $raced = false;
    Tournament::creating(function (Tournament $tournament) use ($rival, $rivalUserId, &$raced) {
        if ($raced) {
            return;
        }
        $raced = true;

        $rival->table('tournaments')->insert([
            'user_id' => $rivalUserId,
            'sport_id' => $tournament->sport_id,
            'name' => 'Żółta Łódź',
            'slug' => $tournament->slug,
            'primary_color' => '#000000',
            'points' => '{}',
            'tiebreakers' => '[]',
        ]);
    });

    createTournamentNamed('Żółta Łódź')->assertJsonPath('data.slug', 'zolta-lodz-2');
    expect($raced)->toBeTrue();
});
