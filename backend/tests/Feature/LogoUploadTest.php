<?php

use App\Exceptions\PublicFileCleanupException;
use App\Models\Team;
use App\Models\Tournament;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Logo turnieju i herb drużyny
|--------------------------------------------------------------------------
|
| Obie trasy uploadu działają tak samo (decyzje w #88), więc każdy test
| biegnie dla obu przez dataset `logo`. Różnią się adresem, katalogiem na
| dysku i rzeczownikiem w komunikatach. 401, 403 i 404 po miękkim usunięciu
| pilnuje `SubtreeAuthorizationTest`.
|
| Funkcje i stałe lądują w globalnej przestrzeni nazw Pesta, stąd prefiks
| `logo`/`LOGO_` w każdej nazwie.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
    fakePublicDisk();
});

dataset('logo', [
    'logo turnieju' => ['tournament'],
    'herb drużyny' => ['team'],
]);

/** Komunikaty przepisane dosłownie z tabeli w #111, pkt 5. */
const LOGO_MESSAGES = [
    'tournament' => [
        'required' => 'Wybierz plik z logo.',
        'format' => 'Logo musi być plikiem PNG, JPG albo WebP.',
        'max' => 'Logo może mieć najwyżej 2 MB.',
        'dimensions' => 'Logo musi mieć od 64×64 do 4096×4096 pikseli.',
    ],
    'team' => [
        'required' => 'Wybierz plik z herbem.',
        'format' => 'Herb musi być plikiem PNG, JPG albo WebP.',
        'max' => 'Herb może mieć najwyżej 2 MB.',
        'dimensions' => 'Herb musi mieć od 64×64 do 4096×4096 pikseli.',
    ],
];

function logoOwner(string $kind): Tournament|Team
{
    return $kind === 'tournament' ? Tournament::factory()->create() : Team::factory()->create();
}

function logoEndpoint(Tournament|Team $owner): string
{
    return $owner instanceof Tournament
        ? "/api/v1/tournaments/{$owner->id}/logo"
        : "/api/v1/teams/{$owner->id}/logo";
}

/** Katalog z #111, pkt 3 — złożony tu z ręki, nie wzięty z modelu. */
function logoDirectory(Tournament|Team $owner): string
{
    return $owner instanceof Tournament
        ? "tournaments/{$owner->id}/logo"
        : "tournaments/{$owner->tournament_id}/teams/{$owner->id}";
}

/** Adres logo w odpowiedzi: turniej trzyma go w `branding`, drużyna wprost. */
function logoUrlPath(Tournament|Team $owner): string
{
    return $owner instanceof Tournament ? 'data.branding.logoUrl' : 'data.logoUrl';
}

function logoOrganizer(Tournament|Team $owner): Model
{
    return $owner instanceof Tournament ? $owner->user : $owner->tournament->user;
}

function logoUpload(Tournament|Team $owner, ?UploadedFile $file): TestResponse
{
    return actingAsOrganizer(logoOrganizer($owner))
        ->post(logoEndpoint($owner), $file === null ? [] : ['logo' => $file], multipartHeaders());
}

/** Ścieżka pliku na dysku `public`, odczytana z adresu w odpowiedzi. */
function logoStoredPath(string $url): string
{
    return ltrim(substr($url, strlen(config('filesystems.disks.public.url'))), '/');
}

it('przyjmuje PNG, JPG i WebP i oddaje absolutny adres pliku w swoim katalogu', function (string $kind, string $name) {
    $owner = logoOwner($kind);

    $url = logoUpload($owner, UploadedFile::fake()->image($name, 128, 128))
        ->assertValidRequest()
        ->assertValidResponse(200)
        ->json(logoUrlPath($owner));

    expect($url)->toStartWith(config('filesystems.disks.public.url').'/')
        ->and(dirname(logoStoredPath($url)))->toBe(logoDirectory($owner));
    Storage::disk('public')->assertExists(logoStoredPath($url));
})->with('logo')->with(['logo.png', 'logo.jpg', 'logo.webp']);

function expectLogoRejected(TestResponse $response, string $message): void
{
    $response->assertValidResponse(422)
        ->assertJsonPath('errors.logo', [$message]);

    expect(Storage::disk('public')->allFiles())->toBe([]);
}

it('odrzuca GIF komunikatem formatu i niczego nie zapisuje', function (string $kind) {
    $owner = logoOwner($kind);

    expectLogoRejected(
        logoUpload($owner, UploadedFile::fake()->image('logo.gif', 128, 128))->assertValidRequest(),
        LOGO_MESSAGES[$kind]['format'],
    );
})->with('logo');

// `UploadedFile::fake()` bierze MIME z nazwy (research §3.6), więc treść SVG
// sprawdza dopiero prawdziwy plik z `$test = true`, który idzie przez finfo.
it('rozpoznaje SVG po treści, mimo nazwy logo.png', function (string $kind) {
    $owner = logoOwner($kind);
    $path = tempnam(sys_get_temp_dir(), 'logo');
    file_put_contents($path, '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128"/></svg>');

    expectLogoRejected(
        logoUpload($owner, new UploadedFile($path, 'logo.png', 'image/png', null, true)),
        LOGO_MESSAGES[$kind]['format'],
    );
})->with('logo');

it('przyjmuje plik 2048 KB, a 2049 KB odrzuca komunikatem rozmiaru', function (string $kind) {
    $owner = logoOwner($kind);

    expectLogoRejected(
        logoUpload($owner, UploadedFile::fake()->image('logo.png', 64, 64)->size(2049)),
        LOGO_MESSAGES[$kind]['max'],
    );

    logoUpload($owner, UploadedFile::fake()->image('logo.png', 64, 64)->size(2048))
        ->assertValidResponse(200);
})->with('logo');

it('przyjmuje wymiary na granicach', function (string $kind, int $width, int $height) {
    logoUpload(logoOwner($kind), UploadedFile::fake()->image('logo.png', $width, $height))
        ->assertValidResponse(200);
})->with('logo')->with([
    '64×64' => [64, 64],
    '4096×64' => [4096, 64],
    '64×4096' => [64, 4096],
]);

it('odrzuca wymiary za granicami komunikatem wymiarów', function (string $kind, int $width, int $height) {
    expectLogoRejected(
        logoUpload(logoOwner($kind), UploadedFile::fake()->image('logo.png', $width, $height)),
        LOGO_MESSAGES[$kind]['dimensions'],
    );
})->with('logo')->with([
    '63×64' => [63, 64],
    '64×63' => [64, 63],
    '4097×64' => [4097, 64],
    '64×4097' => [64, 4097],
]);

// Plik tekstowy nie spełnia ani formatu, ani wymiarów — `bail` zostawia
// jeden komunikat.
it('daje pod logo dokładnie jeden komunikat dla pliku, który nie jest obrazem', function (string $kind) {
    expectLogoRejected(
        logoUpload(logoOwner($kind), UploadedFile::fake()->createWithContent('logo.txt', 'to nie jest obraz')),
        LOGO_MESSAGES[$kind]['format'],
    );
})->with('logo');

it('odrzuca żądanie bez pliku', function (string $kind) {
    expectLogoRejected(logoUpload(logoOwner($kind), null), LOGO_MESSAGES[$kind]['required']);
})->with('logo');

it('podmienia plik: drugi upload daje nowy adres, a stary plik znika', function (string $kind) {
    $owner = logoOwner($kind);
    $first = logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))->json(logoUrlPath($owner));

    $second = logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))
        ->assertValidResponse(200)
        ->json(logoUrlPath($owner));

    expect($second)->not->toBe($first);
    Storage::disk('public')->assertMissing(logoStoredPath($first));
    Storage::disk('public')->assertExists(logoStoredPath($second));
})->with('logo');

// Listener `saving` rzuca dopiero przy drugim zapisie, żeby pierwszy upload
// zostawił stary plik do sprawdzenia.
it('przy nieudanym zapisie wiersza kasuje nowy plik, a stary zostaje', function (string $kind) {
    $owner = logoOwner($kind);
    $first = logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))->json(logoUrlPath($owner));
    $owner::saving(fn () => throw new RuntimeException('Zapis wiersza nie przeszedł.'));

    logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))->assertServerError();

    expect(Storage::disk('public')->allFiles())->toBe([logoStoredPath($first)])
        ->and($owner->fresh()->logo_path)->toBe(logoStoredPath($first));
})->with('logo');

it('zgłasza nieudane skasowanie starego pliku do report() i oddaje 200', function (string $kind) {
    Exceptions::fake();
    $owner = logoOwner($kind);
    $first = logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))->json(logoUrlPath($owner));
    failDeletionsOnPublicDisk();

    logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))
        ->assertValidResponse(200);

    Exceptions::assertReported(fn (PublicFileCleanupException $e): bool => str_contains($e->getMessage(), logoStoredPath($first)));
})->with('logo');

it('usuwa logo: oddaje 200 z pustym adresem, plik znika, a drugie usunięcie też daje 200', function (string $kind) {
    $owner = logoOwner($kind);
    $url = logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))->json(logoUrlPath($owner));

    foreach ([1, 2] as $attempt) {
        actingAsOrganizer(logoOrganizer($owner))
            ->deleteJson(logoEndpoint($owner))
            ->assertValidRequest()
            ->assertValidResponse(200)
            ->assertJsonPath(logoUrlPath($owner), null)
            ->assertJsonPath('data.id', $owner->id);
    }

    Storage::disk('public')->assertMissing(logoStoredPath($url));
    expect($owner->fresh()->logo_path)->toBeNull();
})->with('logo');

it('zgłasza nieudane skasowanie usuwanego logo do report() i oddaje 200', function (string $kind) {
    Exceptions::fake();
    $owner = logoOwner($kind);
    $url = logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))->json(logoUrlPath($owner));
    failDeletionsOnPublicDisk();

    actingAsOrganizer(logoOrganizer($owner))
        ->deleteJson(logoEndpoint($owner))
        ->assertValidResponse(200)
        ->assertJsonPath(logoUrlPath($owner), null);

    Exceptions::assertReported(fn (PublicFileCleanupException $e): bool => str_contains($e->getMessage(), logoStoredPath($url)));
})->with('logo');

// Herb drużyny usuniętej miękko zostaje, bo turniej dalej ją pamięta;
// znika dopiero z katalogiem turnieju (#111, pkt 8).
it('zostawia herb drużyny usuniętej miękko, a upload dla niej daje 404', function () {
    $team = logoOwner('team');
    $url = logoUpload($team, UploadedFile::fake()->image('logo.png', 128, 128))->json('data.logoUrl');

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(204);

    Storage::disk('public')->assertExists(logoStoredPath($url));

    logoUpload($team, UploadedFile::fake()->image('logo.png', 128, 128))
        ->assertValidResponse(404);
});
