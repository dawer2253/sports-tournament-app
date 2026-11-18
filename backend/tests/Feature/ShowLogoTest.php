<?php

use App\Models\Team;
use App\Models\Tournament;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spectator\Spectator;

/*
|--------------------------------------------------------------------------
| Odczyt logo turnieju i herbu drużyny: GET …/logo (#333)
|--------------------------------------------------------------------------
|
| Panel czyta tędy obrazy do grafiki turnieju, bo `/storage` omija Laravela,
| a z nim CORS. Plik idzie prosto z dysku `public`, więc trasa nie zależy od
| `storage:link`. 401 i 404 po miękkim usunięciu pilnuje
| `SubtreeAuthorizationTest`.
|
| Funkcje lądują w globalnej przestrzeni nazw Pesta, stąd prefiks
| `showLogo` w każdej nazwie.
|
*/

beforeEach(function () {
    Spectator::using('openapi.yaml');
    fakePublicDisk();
});

dataset('owner', [
    'logo turnieju' => [fn (): Tournament => Tournament::factory()->create()],
    'herb drużyny' => [fn (): Team => Team::factory()->create()],
]);

function showLogoEndpoint(Tournament|Team $owner): string
{
    return $owner instanceof Tournament
        ? "/api/v1/tournaments/{$owner->id}/logo"
        : "/api/v1/teams/{$owner->id}/logo";
}

function showLogoOrganizer(Tournament|Team $owner): User
{
    return $owner instanceof Tournament ? $owner->user : $owner->tournament->user;
}

it('oddaje wgrany plik z typem z jego treści', function (Tournament|Team $owner, string $name, string $type) {
    $owner->replaceLogo(UploadedFile::fake()->image($name, 128, 128));
    $stored = Storage::disk('public')->get($owner->logo_path);

    $response = actingAsOrganizer(showLogoOrganizer($owner))->get(showLogoEndpoint($owner));

    $response->assertOk()->assertHeader('Content-Type', $type);
    expect($response->streamedContent())->toBe($stored);
})->with('owner')->with([
    'PNG' => ['logo.png', 'image/png'],
    'JPG' => ['logo.jpg', 'image/jpeg'],
    'WebP' => ['logo.webp', 'image/webp'],
]);

it('bez wgranego logo daje 404', function (Tournament|Team $owner) {
    actingAsOrganizer(showLogoOrganizer($owner))
        ->getJson(showLogoEndpoint($owner))
        ->assertValidResponse(404);
})->with('owner');

it('daje 404, gdy pliku z logo_path nie ma na dysku', function (Tournament|Team $owner) {
    $owner->forceFill(['logo_path' => 'tournaments/1/logo/zniknal.png'])->save();

    actingAsOrganizer(showLogoOrganizer($owner))
        ->getJson(showLogoEndpoint($owner))
        ->assertValidResponse(404);
})->with('owner');

it('cudzy turniej daje 403, także z wgranym logo', function (Tournament|Team $owner) {
    $owner->replaceLogo(UploadedFile::fake()->image('logo.png', 128, 128));

    actingAsOrganizer(User::factory()->create())
        ->getJson(showLogoEndpoint($owner))
        ->assertValidResponse(403);
})->with('owner');
