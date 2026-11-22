# Film demo aplikacji (Remotion)

Niespełna trzyminutowe przejście po aplikacji: panel organizatora, nowy turniej,
drużyny i zawodnicy, terminarz z wynikiem, edycja i kolor, strona publiczna
(komputer i telefon), grafiki do social mediów, mecz na żywo i turniej założony
przez agenta przez MCP.

Ujęcia to prawdziwe nagrania aplikacji, a nie makiety.

## 1. Nagranie ujęć

Wymaga działającego Laravela (`make up`, port 8000), panelu (`npm run dev:admin`)
i strony publicznej (`npm run dev:public`). Konto: „Administrator” z seeda
(`TeamAdminsSeeder`).

```bash
node demo-video/record/record.mjs            # sceny domyślne (bez „mecz” i „mcp”)
node demo-video/record/record.mjs mecz mcp   # wybrane sceny
```

Skrypt usuwa „Ligę Podwórkową 2026” i „Turniej Szkół 2026” z poprzedniego
przebiegu, nagrywa każdą scenę w osobnej przeglądarce (1280×720 przy DPR 1,5,
czyli ostre 1920×1080) i składa ją w `public/clips/<scena>.mp4`. Znaczniki
kroków lądują w `public/clips/markers.json` — z nich `src/Demo.tsx` liczy
początek, koniec i długość każdej sceny.

Kliknięcia przejścia na inny ekran (zakładka, otwarcie turnieju, meczu) skrypt
zapisuje osobno, pod `navs`. Film przyspiesza wpisywanie i zaznaczanie, ale
od 0,6 s przed takim kliknięciem do 1,4 s po nim gra w zwykłym tempie, żeby
widz zdążył zobaczyć, co kliknięto i dokąd to prowadzi.

Czekanie na API nie trafia do nagrania: przy żądaniach do backendu nagranie
stoi, a w filmie zostaje cięcie. Laravel w Sailu na dysku Windows potrafi
pod obciążeniem odpowiadać po kilkanaście sekund.

Scena `mcp` nagrywa panel turnieju, który najpierw trzeba założyć przez serwer
MCP (`apps/mcp-server`) — rozmowa w filmie (`src/scenes/McpChat.tsx`) odtwarza
te same wywołania narzędzi.

## 2. Podgląd i render

```bash
cd demo-video
npm run dev                                                # Remotion Studio
npx remotion render DemoTurnieju out/demo-turnieju.mp4 --crf=18
```

## 3. Publikacja

Gotowy film nie trafia do repo (`out/` jest w `.gitignore`), tylko do wydania
na GitHubie:
[`film-demo-2026-11`](https://github.com/dawer2253/sports-tournament-app/releases/tag/film-demo-2026-11).
Nową wersję filmu wgrywa się do tego samego wydania, w miejsce starego pliku:

```bash
gh release upload film-demo-2026-11 demo-video/out/demo-turnieju.mp4 --clobber
```

Wydanie jest oznaczone jako wstępne (`--prerelease`), więc GitHub nie daje mu
etykiety „Latest”. Ta etykieta wskazuje najnowszą wersję aplikacji, a film nią
nie jest. Nie zaznaczaj „Set as the latest release” przy edycji wydania.
Nowe wydanie filmu też zakładaj z `--prerelease` albo z `--latest=false`.
