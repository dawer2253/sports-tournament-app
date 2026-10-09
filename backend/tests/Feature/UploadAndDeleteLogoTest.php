<?php

use App\Exceptions\PublicFileCleanupException;
use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Logo turnieju i herb drużyny: upload i usuwanie
|--------------------------------------------------------------------------
|
| Obie trasy działają tak samo (decyzje w #88), więc każdy test biegnie dla
| obu przez dataset `logo`. Różnią się adresem, katalogiem na dysku
| i rzeczownikiem w komunikatach — zbiera je jedno miejsce, `logoTarget()`.
| 401, 403 i 404 po miękkim usunięciu pilnuje `SubtreeAuthorizationTest`.
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
    'logo turnieju' => [fn (): Tournament => Tournament::factory()->create()],
    'herb drużyny' => [fn (): Team => Team::factory()->create()],
]);

/** Komunikaty przepisane dosłownie z tabeli w #111, pkt 5. */
const LOGO_MESSAGES = [
    'tournament' => [
        'required' => 'Wybierz plik z logo.',
        'format' => 'Logo musi być plikiem PNG, JPG albo WebP.',
        'max' => 'Logo może mieć najwyżej 2 MB.',
        'dimensions' => 'Logo musi mieć od 64×64 do 4096×4096 pikseli.',
        'uploaded' => 'Nie udało się wgrać logo. Sprawdź, czy plik ma najwyżej 2 MB.',
    ],
    'team' => [
        'required' => 'Wybierz plik z herbem.',
        'format' => 'Herb musi być plikiem PNG, JPG albo WebP.',
        'max' => 'Herb może mieć najwyżej 2 MB.',
        'dimensions' => 'Herb musi mieć od 64×64 do 4096×4096 pikseli.',
        'uploaded' => 'Nie udało się wgrać herbu. Sprawdź, czy plik ma najwyżej 2 MB.',
    ],
];

/**
 * Wszystko, czym różnią się logo i herb. Katalog z #111, pkt 3, jest złożony
 * z ręki, a nie wzięty z modelu.
 *
 * @return array{endpoint: string, directory: string, urlPath: string, organizer: User, messages: array<string, string>}
 */
function logoTarget(Tournament|Team $owner): array
{
    return $owner instanceof Tournament
        ? [
            'endpoint' => "/api/v1/tournaments/{$owner->id}/logo",
            'directory' => "tournaments/{$owner->id}/logo",
            'urlPath' => 'data.branding.logoUrl',
            'organizer' => $owner->user,
            'messages' => LOGO_MESSAGES['tournament'],
        ]
        : [
            'endpoint' => "/api/v1/teams/{$owner->id}/logo",
            'directory' => "tournaments/{$owner->tournament_id}/teams/{$owner->id}",
            'urlPath' => 'data.logoUrl',
            'organizer' => $owner->tournament->user,
            'messages' => LOGO_MESSAGES['team'],
        ];
}

/** Żądanie z plikiem ma być zgodne z kontraktem, cokolwiek odpowie serwer. */
function logoUpload(Tournament|Team $owner, UploadedFile $file): TestResponse
{
    return logoPost($owner, ['logo' => $file])->assertValidRequest();
}

/** Udany upload; zwraca `logoUrl` z odpowiedzi. */
function logoUploaded(Tournament|Team $owner, ?UploadedFile $file = null): string
{
    return logoUpload($owner, $file ?? UploadedFile::fake()->image('logo.png', 128, 128))
        ->assertValidResponse(200)
        ->json(logoTarget($owner)['urlPath']);
}

/** @param  array<string, mixed>  $data */
function logoPost(Tournament|Team $owner, array $data): TestResponse
{
    return actingAsOrganizer(logoTarget($owner)['organizer'])
        ->post(logoTarget($owner)['endpoint'], $data, multipartHeaders());
}

function logoDelete(Tournament|Team $owner): TestResponse
{
    return actingAsOrganizer(logoTarget($owner)['organizer'])
        ->deleteJson(logoTarget($owner)['endpoint'])
        ->assertValidRequest();
}

/** Ścieżka pliku na dysku `public`, odczytana z adresu w odpowiedzi. */
function logoStoredPath(string $url): string
{
    return ltrim(substr($url, strlen(config('filesystems.disks.public.url'))), '/');
}

function expectLogoRejected(TestResponse $response, string $message): void
{
    $response->assertValidResponse(422)
        ->assertJsonPath('errors.logo', [$message]);

    expect(Storage::disk('public')->allFiles())->toBe([]);
}

it('przyjmuje PNG, JPG i WebP i oddaje absolutny adres pliku w swoim katalogu', function (Tournament|Team $owner, string $name) {
    $url = logoUploaded($owner, UploadedFile::fake()->image($name, 128, 128));

    expect($url)->toStartWith(config('filesystems.disks.public.url').'/')
        ->and(dirname(logoStoredPath($url)))->toBe(logoTarget($owner)['directory']);
    Storage::disk('public')->assertExists(logoStoredPath($url));
})->with('logo')->with(['logo.png', 'logo.jpg', 'logo.webp']);

it('odrzuca GIF komunikatem formatu i niczego nie zapisuje', function (Tournament|Team $owner) {
    expectLogoRejected(
        logoUpload($owner, UploadedFile::fake()->image('logo.gif', 128, 128)),
        logoTarget($owner)['messages']['format'],
    );
})->with('logo');

// `UploadedFile::fake()` bierze MIME z nazwy (research §3.6), więc treść SVG
// sprawdza dopiero prawdziwy plik z `$test = true`, który idzie przez finfo.
it('rozpoznaje SVG po treści, mimo nazwy logo.png', function (Tournament|Team $owner) {
    $path = tempnam(sys_get_temp_dir(), 'logo');
    file_put_contents($path, '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128"/></svg>');

    try {
        expectLogoRejected(
            logoUpload($owner, new UploadedFile($path, 'logo.png', 'image/png', null, true)),
            logoTarget($owner)['messages']['format'],
        );
    } finally {
        unlink($path);
    }
})->with('logo');

it('przyjmuje plik 2048 KB, a 2049 KB odrzuca komunikatem rozmiaru', function (Tournament|Team $owner) {
    expectLogoRejected(
        logoUpload($owner, UploadedFile::fake()->image('logo.png', 64, 64)->size(2049)),
        logoTarget($owner)['messages']['max'],
    );

    logoUploaded($owner, UploadedFile::fake()->image('logo.png', 64, 64)->size(2048));
})->with('logo');

it('przyjmuje wymiary na granicach', function (Tournament|Team $owner, int $width, int $height) {
    logoUploaded($owner, UploadedFile::fake()->image('logo.png', $width, $height));
})->with('logo')->with([
    '64×64' => [64, 64],
    '4096×64' => [4096, 64],
    '64×4096' => [64, 4096],
]);

it('odrzuca wymiary za granicami komunikatem wymiarów', function (Tournament|Team $owner, int $width, int $height) {
    expectLogoRejected(
        logoUpload($owner, UploadedFile::fake()->image('logo.png', $width, $height)),
        logoTarget($owner)['messages']['dimensions'],
    );
})->with('logo')->with([
    '63×64' => [63, 64],
    '64×63' => [64, 63],
    '4097×64' => [4097, 64],
    '64×4097' => [64, 4097],
]);

// Plik tekstowy nie spełnia ani formatu, ani wymiarów — `bail` zostawia
// jeden komunikat.
it('daje pod logo dokładnie jeden komunikat dla pliku, który nie jest obrazem', function (Tournament|Team $owner) {
    expectLogoRejected(
        logoUpload($owner, UploadedFile::fake()->createWithContent('logo.txt', 'to nie jest obraz')),
        logoTarget($owner)['messages']['format'],
    );
})->with('logo');

// Bez `assertValidRequest()`: żądanie bez pliku łamie `required: [logo]`
// w kontrakcie, a test sprawdza właśnie odpowiedź na takie żądanie.
it('odrzuca żądanie bez pliku', function (Tournament|Team $owner) {
    expectLogoRejected(logoPost($owner, []), logoTarget($owner)['messages']['required']);
})->with('logo');

// Plik, którego PHP nie przyjął (tu: większy niż `upload_max_filesize`),
// walidator zgłasza regułą `uploaded` zamiast właściwej (research §3.4).
// Bez Spectatora: jego middleware czyta treść każdego pliku z żądania,
// a pliku z błędem uploadu nie da się przeczytać, więc kończyłby żądanie 500,
// zanim dotrze ono do walidacji. Poza testami tego middleware'u nie ma.
it('mówi o nieudanym uploadzie, gdy PHP odrzucił plik', function (Tournament|Team $owner) {
    Spectator::reset();
    $path = tempnam(sys_get_temp_dir(), 'logo');

    try {
        logoPost($owner, ['logo' => new UploadedFile($path, 'logo.png', 'image/png', UPLOAD_ERR_INI_SIZE, true)])
            ->assertUnprocessable()
            ->assertJsonPath('errors.logo', [logoTarget($owner)['messages']['uploaded']]);
    } finally {
        unlink($path);
    }

    expect(Storage::disk('public')->allFiles())->toBe([]);
})->with('logo');

it('podmienia plik: drugi upload daje nowy adres, a stary plik znika', function (Tournament|Team $owner) {
    $first = logoUploaded($owner);

    $second = logoUploaded($owner);

    expect($second)->not->toBe($first);
    Storage::disk('public')->assertMissing(logoStoredPath($first));
    Storage::disk('public')->assertExists(logoStoredPath($second));
})->with('logo');

// Listener `saving` rzuca dopiero przy drugim zapisie, żeby pierwszy upload
// zostawił stary plik do sprawdzenia.
it('przy nieudanym zapisie wiersza kasuje nowy plik, a stary zostaje', function (Tournament|Team $owner) {
    $first = logoUploaded($owner);
    $owner::saving(fn () => throw new RuntimeException('Zapis wiersza nie przeszedł.'));

    logoUpload($owner, UploadedFile::fake()->image('logo.png', 128, 128))->assertServerError();

    expect(Storage::disk('public')->allFiles())->toBe([logoStoredPath($first)])
        ->and($owner->fresh()->logo_path)->toBe(logoStoredPath($first));
})->with('logo');

it('zgłasza nieudane skasowanie starego pliku do report() i oddaje 200', function (Tournament|Team $owner) {
    Exceptions::fake();
    $first = logoUploaded($owner);
    failDeletionsOnPublicDisk();

    logoUploaded($owner);

    Exceptions::assertReported(fn (PublicFileCleanupException $e): bool => str_contains($e->getMessage(), logoStoredPath($first)));
})->with('logo');

it('usuwa logo: oddaje 200 z pustym adresem, plik znika, a drugie usunięcie też daje 200', function (Tournament|Team $owner) {
    $url = logoUploaded($owner);

    foreach ([1, 2] as $attempt) {
        logoDelete($owner)
            ->assertValidResponse(200)
            ->assertJsonPath(logoTarget($owner)['urlPath'], null)
            ->assertJsonPath('data.id', $owner->id);
    }

    Storage::disk('public')->assertMissing(logoStoredPath($url));
    expect($owner->fresh()->logo_path)->toBeNull();
})->with('logo');

it('zgłasza nieudane skasowanie usuwanego logo do report() i oddaje 200', function (Tournament|Team $owner) {
    Exceptions::fake();
    $url = logoUploaded($owner);
    failDeletionsOnPublicDisk();

    logoDelete($owner)
        ->assertValidResponse(200)
        ->assertJsonPath(logoTarget($owner)['urlPath'], null);

    Exceptions::assertReported(fn (PublicFileCleanupException $e): bool => str_contains($e->getMessage(), logoStoredPath($url)));
})->with('logo');

// Herb drużyny usuniętej miękko zostaje, bo turniej dalej ją pamięta;
// znika dopiero z katalogiem turnieju (#111, pkt 8).
it('zostawia herb drużyny usuniętej miękko, a upload dla niej daje 404', function () {
    $team = Team::factory()->create();
    $url = logoUploaded($team);

    actingAsOrganizer($team->tournament->user)
        ->deleteJson("/api/v1/teams/{$team->id}")
        ->assertValidResponse(204);

    Storage::disk('public')->assertExists(logoStoredPath($url));

    logoUpload($team, UploadedFile::fake()->image('logo.png', 128, 128))
        ->assertValidResponse(404);
});
