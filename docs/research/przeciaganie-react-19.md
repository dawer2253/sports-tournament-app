# Przeciąganie list w React 19: kandydaci, dostępność i testy

Badanie na potrzeby ticketu
[#165 „S2: research — przeciąganie list w React 19"](https://github.com/dawer2253/sports-tournament-app/issues/165).
Odblokowuje [#163 „S2: ekran tabeli i kolejność tiebreaków"](https://github.com/dawer2253/sports-tournament-app/issues/163).
Data: 10 października 2026.

**Ten plik zbiera fakty i niczego nie rozstrzyga.** Wybór biblioteki (albo
rezygnacja z przeciągania na rzecz przycisków „w górę / w dół") należy do #163.
Tam, gdzie fakty prowadzą do kilku dróg, opisuję je obok siebie i żadnej nie
wskazuję.

## 0. Źródła i metoda

Korzystałem wyłącznie ze źródeł pierwotnych:

- rejestr npm, odczyt bez instalacji:
  `npm view <pakiet> version license peerDependencies dependencies deprecated dist.unpackedSize time dist-tags --json`.
  Daty wydań pochodzą z pola `time`;
- repozytoria GitHub (issues, PR-y, releases, pliki w gałęzi `main`), czytane
  przez publiczne API `api.github.com` i `raw.githubusercontent.com`;
- dokumentacja oficjalna: dndkit.com (w tym sekcja `/legacy`),
  atlassian.design (Pragmatic drag and drop), react-aria.adobe.com,
  ui.shadcn.com, vitest.dev, storybook.js.org;
- `CHANGELOG.md` z opublikowanej paczki `@atlaskit/pragmatic-drag-and-drop@4.0.0`
  (cdn.jsdelivr.net, czyli treść tarballa z npm).

**Niczego nie instalowałem ani nie uruchamiałem.** Zdania o tym, czy dane
przeciąganie da się przetestować, opierają się na dokumentacji, na
wypowiedziach opiekunów w issues i na lekturze testów samych bibliotek. Żadne
nie pochodzi z próby w naszym repo. Rzeczy, których nie sprawdziłem, zebrałem
w §8.

**Rozmiar.** Pole `dist.unpackedSize` z npm podaje rozmiar rozpakowanej paczki
razem z typami, mapami i wszystkimi formatami modułów. **Nie jest to rozmiar
w bundlu.** Rozmiary po minifikacji i gzipie podaję tylko wtedy, gdy deklaruje
je sam projekt, i oznaczam je jako deklarację.

## 1. Streszczenie

- **`@dnd-kit/core` + `@dnd-kit/sortable` to dziś „legacy".** Ostatnie wydania
  ukazały się w grudniu 2024: `core` 6.3.1 (5.12.2024) i `sortable` 10.0.0
  (4.12.2024). Peer `react >=16.8.0` przepuszcza React 19. Dokumentacja tych
  pakietów leży pod `dndkit.com/legacy` i poleca nową wersję. W lutym 2026
  autor zamykał zgłoszenia dotyczące starej linii, w tym „Support React 19"
  (#1511), odsyłając do przepisanej biblioteki. Obsługa klawiatury
  (`KeyboardSensor`) i komunikaty dla czytników ekranu są wbudowane.
- **`@dnd-kit/react` 0.5.0 (11.06.2026) to nowa linia**, nadal w wersji 0.x.
  Peer `react ^18 || ^19`. Klawiatura i wtyczka dostępności są włączone
  domyślnie. Otwarty błąd #2116: w React 19 z `StrictMode` (tryb
  deweloperski) `DragDropProvider` może trzymać już zniszczonego menedżera,
  a wtedy przeciąganie przestaje działać. Poprawka (#2117) czeka na merge.
  `apps/admin` renderuje się w `StrictMode`.
- **Pragmatic drag and drop (`@atlaskit/pragmatic-drag-and-drop` 4.0.0,
  24.09.2026)** stoi na natywnym HTML5 DnD i nie zależy od Reacta. **Rdzeń nie
  daje sterowania z klawiatury.** Atlassian zaleca zamiast niego widoczne
  kontrolki: menu przy uchwycie z akcjami „przenieś" oraz komunikaty w live
  region. Pakiet z gotowym uchwytem (`react-accessibility`) ciągnie zależności
  design systemu Atlassiana (`@emotion/react`, `@atlaskit/tokens` i inne),
  a jego dokumentacja przyznaje, że nie jest testowany bezpośrednio na
  React 19.
- **React Aria (`react-aria-components` 1.22.1, 9.10.2026)** daje
  przestawianie w `ListBox`, `GridList`, `Table` i `Tree` przez
  `useDragAndDrop` i `onReorder`. Obsługa klawiatury i czytników ekranu jest
  wbudowana. Własne testy biblioteki sprawdzają przeciąganie z klawiatury
  w jsdom przez `user-event`. To inny zestaw prymitywów niż Radix, na którym
  stoi nasz styl `radix-nova`.
- **jsdom a układ strony.** dnd-kit wylicza sąsiada z `getBoundingClientRect`,
  także przy sterowaniu klawiaturą, a jsdom zwraca same zera. Autor dnd-kit
  odradza testowanie samego przeciągania w jsdom. Pragmatic wymaga w jsdom
  polyfilli `DragEvent` i `DOMRect`. W Chromium (funkcje `play`) układ jest
  prawdziwy. `userEvent` ze `storybook/test` to jednak Testing Library i nie
  wywołuje natywnego HTML5 DnD. Natywne przeciąganie umie `userEvent.dragAndDrop`
  z Vitesta w trybie browser.
- **shadcn/ui ma gotowy wzorzec.** Blok `dashboard-01` (tabela z przestawianymi
  wierszami) w wariancie Radix i Base UI używa `@dnd-kit/core`, `sortable`,
  `modifiers` i `utilities` z `KeyboardSensor`. Od lipca 2026 shadcn ma też
  bazę React Aria, a w niej ten sam blok korzysta z `useDragAndDrop`.

## 2. Punkt wyjścia w repo

| Fakt | Polecenie |
|---|---|
| React w locku: 19.2.8 | `grep -A1 '"node_modules/react"' package-lock.json` |
| `radix-ui` w locku: 1.6.7 | `grep -A1 '"node_modules/radix-ui"' package-lock.json` |
| Styl shadcn: `radix-nova` | `grep style packages/ui/components.json` |
| Żadnej biblioteki DnD w zależnościach | `grep -nE 'dnd\|drag\|sortable' package-lock.json` (trafiają tylko sumy `integrity`) |
| `apps/admin` renderuje w `StrictMode` | `grep -n StrictMode apps/admin/src/main.tsx` |
| Testy aplikacji: vitest 4, Testing Library 16, `user-event` 14, jsdom 30 | `grep -nE '"(vitest\|jsdom\|@testing-library/[a-z-]+)"' apps/admin/package.json` |
| Funkcje `play` biorą `userEvent` ze `storybook/test` | `grep -rhoE "from ['\"]storybook/test['\"]" packages/ui/src \| sort \| uniq -c` |
| Stories chodzą w Vitest browser z Playwrightem (Chromium) | `grep -nE "provider\|browser:" packages/ui/vite.config.ts` |

## 3. Kandydaci

### 3.1. `@dnd-kit/core` + `@dnd-kit/sortable` (linia „legacy")

- **Wersje i daty** (npm `time`): `@dnd-kit/core` 6.3.1 z 5.12.2024,
  `@dnd-kit/sortable` 10.0.0 z 4.12.2024, `@dnd-kit/modifiers` 9.0.0
  z 4.12.2024, `@dnd-kit/utilities` 3.2.2 z 6.11.2023. Od tego czasu żadnych
  nowych wydań stabilnych.
- **React 19.** Peer `react >=16.8.0` i `react-dom >=16.8.0` (`core`), więc
  formalnie React 19 jest dopuszczony. Issue
  [#1511 „Support React 19 & Nextjs 15"](https://github.com/clauderic/dnd-kit/issues/1511)
  powstało 25.10.2024. Zamknięto je 16.02.2026 komentarzem autora, który
  odsyła do przepisanej biblioteki i przewodnika migracji, a w samej starej
  linii niczego nie poprawia.
- **Status.** Strona instalacji w dokumentacji legacy informuje, że jest nowa
  wersja, i ją poleca
  ([dndkit.com/legacy/introduction/installation](https://dndkit.com/legacy/introduction/installation)).
  Domyślna gałąź repo (`main`) zawiera już nowe pakiety. Nigdzie nie znalazłem
  formalnego oznaczenia `deprecated`: `npm view @dnd-kit/core deprecated`
  zwraca pusty wynik.
- **Klawiatura i czytniki ekranu**
  ([dndkit.com/legacy/guides/accessibility](https://dndkit.com/legacy/guides/accessibility)):
  - `KeyboardSensor`: Spacja lub Enter podnosi i upuszcza element, strzałki go
    przesuwają, Escape anuluje. Przy sortowalnej liście potrzebny jest
    `sortableKeyboardCoordinates`;
  - hook nadaje `role`, `aria-roledescription` i `aria-describedby`;
  - live region ogłasza start, przesunięcie, upuszczenie i anulowanie;
  - instrukcje i komunikaty podmienia się propsami `screenReaderInstructions`
    i `announcements` na `DndContext`. Domyślnie są po angielsku.
- **Licencja:** MIT.
- **Rozmiar** (`unpackedSize`): `core` ≈1,07 MB, `sortable` ≈234 kB.
  Rozmiaru w bundlu nie sprawdzałem.

### 3.2. `@dnd-kit/react` (nowa linia)

- **Wersje i daty:** `@dnd-kit/react`, `dom`, `abstract` i `helpers` mają
  jednocześnie 0.5.0 z 11.06.2026, wydane też jako GitHub Release. Wcześniej
  były 0.4.0 (13.04.2026) i 0.3.2 (19.02.2026). Tag `beta` wskazuje
  `0.5.1-beta-20260912195958` (12.09.2026). Nadal wersja 0.x.
- **React 19.** Peer `react ^18.0.0 || ^19.0.0`, `react-dom` tak samo.
- **Otwarte błędy związane z React 19:**
  - [#2116](https://github.com/clauderic/dnd-kit/issues/2116) (31.07.2026).
    W React 19 z `StrictMode` deweloperskie powtórzenie efektów niszczy
    menedżera w `DragDropProvider`, a provider zostaje z nieużywalną
    instancją, więc kolejne przeciągnięcia mogą zawieść. Komentarz z konta
    właściciela repo z 9.08.2026 potwierdza przyczynę w `useStableInstance`.
    Poprawka [#2117](https://github.com/clauderic/dnd-kit/pull/2117) jest
    otwarta i niezmergowana. Dotyczy wyłącznie trybu deweloperskiego, a nasza
    aplikacja używa `StrictMode` (§2);
  - [#2008](https://github.com/clauderic/dnd-kit/issues/2008) (13.04.2026):
    sortowanie przestaje działać po upuszczeniu elementu do zagnieżdżonego
    celu i usunięciu go z listy. Zgłoszono na 0.4.0-beta z React 19.2.0.
    Płaska lista jednego poziomu nie trafia w ten scenariusz, ale tego nie
    sprawdzałem.
- **Klawiatura i czytniki ekranu.** `PointerSensor` i `KeyboardSensor` są
  rejestrowane domyślnie
  ([dndkit.com/react/guides/sensors](https://dndkit.com/react/guides/sensors/)).
  Klawisze: start Spacja lub Enter, koniec Spacja, Enter albo Tab, anulowanie
  Escape, ruch strzałkami albo W/A/S/D. Wtyczka
  [Accessibility](https://dndkit.com/extend/plugins/accessibility/) jest
  włączona domyślnie: atrybuty ARIA, ukryte instrukcje i live region.
  Komunikaty zmienia się przez `Accessibility.configure()`.
- **API względem legacy**
  ([dndkit.com/react/migration](https://dndkit.com/react/migration)):
  - `DragDropProvider` zastępuje `DndContext`;
  - `useSortable` przechodzi do `@dnd-kit/react/sortable`, a `SortableContext`
    znika;
  - `move` z `@dnd-kit/helpers` zastępuje `arrayMove`;
  - `onDragCancel` wchodzi do `onDragEnd` (`event.canceled`).
- **Licencja:** MIT. **Rozmiar** (`unpackedSize`): `react` ≈240 kB i `dom`
  ≈1,2 MB, do tego `abstract`, `state`, `geometry` i `collision`.

### 3.3. Pragmatic drag and drop (Atlassian)

- **Wersje i daty:**
  - `@atlaskit/pragmatic-drag-and-drop` 4.0.0 z 24.09.2026; wcześniej 3.1.0
    (29.08.2026), 3.0.0 (14.08.2026) i 2.0.0 (16.06.2026);
  - `-hitbox` 3.0.0 z 24.09.2026;
  - `-react-accessibility` 3.2.4 z 24.09.2026;
  - `-live-region` 2.1.0 z 29.08.2026;
  - `-unit-testing` 2.1.0 z 29.08.2026.

  Paczki wychodzą z wewnętrznego monorepo Atlassiana na Bitbuckecie. GitHub
  [atlassian/pragmatic-drag-and-drop](https://github.com/atlassian/pragmatic-drag-and-drop)
  ma ostatni push 9.10.2026.
- **Co zmieniały wydania główne** (wg `CHANGELOG.md` paczki 4.0.0):
  - 3.0.0 dodało nowe ścieżki importu (np. `/utils/reorder` zamiast
    `/reorder`) i zostawiło stare jako przestarzałe;
  - 4.0.0 usunęło te stare ścieżki;
  - 2.0.2 wymienia porządki „w ramach migracji na React 19" w kodzie
    niepublikowanym (testy, dema).
- **React 19.** Rdzeń nie ma peerów Reacta, bo nie zależy od żadnego
  frameworka. Peer `react ^18.2.0 || ^19.0.0` mają
  `-react-accessibility` i `-react-drop-indicator`. Strona pakietu
  `react-accessibility` zaznacza, że nie jest on testowany bezpośrednio na
  React 19
  ([atlassian.design/…/react-accessibility/about](https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages/react-accessibility/about)).
- **Mechanizm.** Pakiet stoi na natywnym HTML5 drag and drop. README deklaruje
  „~4.7kB core" (deklaracja projektu, niezmierzona) oraz pełne wsparcie
  w Firefoksie, Safari, Chrome, na iOS i Androidzie. Według README biblioteka
  działa w Trello, Jirze i Confluence.
- **Klawiatura i czytniki ekranu**
  ([atlassian.design/…/accessibility-guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines)):
  - rdzeń celowo nie włącza sterowania z klawiatury;
  - wytyczne zalecają widoczne kontrolki (przyciski, menu) zamiast strzałek,
    bo nawigacja strzałkami zmusza użytkowników JAWS do zmiany trybu;
  - przy elemencie ma stać przycisk z menu akcji typu „przenieś na górę",
    a wynik ma trafić do live region;
  - gotowe klocki to `-react-accessibility` (przycisk uchwytu) i
    `-live-region`.
- **Zależności klocków React.**
  - `-react-accessibility` zależy od `@emotion/react`, `@atlaskit/tokens`,
    `@atlaskit/icon`, `@atlaskit/primitives`, `@atlaskit/focus-ring` i innych.
    Dokumentacja dopuszcza przepisanie tego małego pakietu we własnym stosie.
  - `-react-drop-indicator` zależy od `@compiled/react` i `@atlaskit/tokens`.
- **Licencja:** Apache-2.0 (npm). GitHub nie rozpoznaje licencji repo
  (`NOASSERTION`).

### 3.4. React Aria (`react-aria-components`, `useDragAndDrop`)

- **Wersje i daty:** `react-aria-components` 1.22.1 z 9.10.2026 (1.22.0 wyszło
  8.10.2026, 1.21.1 4.09.2026), `react-aria` 3.53.1 z 9.10.2026,
  `@react-aria/dnd` 3.12.1. Repo
  [adobe/react-spectrum](https://github.com/adobe/react-spectrum) miało push
  9.10.2026.
- **React 19.** Peer `react` i `react-dom`
  `^16.8.0 || ^17.0.0-rc.1 || ^18.0.0 || ^19.0.0-rc.1`.
- **Gdzie działa przestawianie**
  ([react-aria.adobe.com/dnd](https://react-aria.adobe.com/dnd),
  [/GridList](https://react-aria.adobe.com/GridList)): `ListBox`, `GridList`,
  `Tree` i `Table`. Hook `useDragAndDrop({ getItems, onReorder })` zwraca
  `dragAndDropHooks`, które przekazuje się kolekcji. Kolejność zmienia się
  przez `useListData().moveBefore()` i `moveAfter()`. Uchwyt to
  `<Button slot="drag">`, a znacznik miejsca upuszczenia rysuje
  `renderDropIndicator`.
- **Klawiatura i czytniki ekranu.**
  - Klawiatura: Enter na elemencie zaczyna przeciąganie, Tab przechodzi między
    celami, strzałki w kolekcji wybierają pozycję (na elemencie albo między
    elementami), Enter upuszcza, Escape anuluje.
  - Czytnik na urządzeniu dotykowym: dwukrotne stuknięcie podnosi, przesunięcie
    palcem wybiera cel, kolejne dwukrotne stuknięcie upuszcza.
  - Komunikaty są wbudowane. `react-aria` zależy od
    `@internationalized/string` (pole `dependencies` w npm). Jakie języki
    obejmują komunikaty i czy jest wśród nich polski, nie sprawdzałem.
- **Licencja:** Apache-2.0. **Rozmiar** (`unpackedSize`): `react-aria` ≈15,7 MB,
  a `react-aria-components` ≈6,9 MB. Obie liczby obejmują całą bibliotekę
  komponentów. Ile zostaje po tree-shakingu przy samym `GridList`
  z `useDragAndDrop`, nie sprawdzałem.
- **Związek z naszym stosem.** To osobny zestaw prymitywów, inny niż Radix.
  shadcn traktuje React Aria jako pełnoprawną „bazę" od lipca 2026 (§5).

### 3.5. Inne

| Pakiet | Wersja / data | Peer React | Licencja | Uwagi |
|---|---|---|---|---|
| `@hello-pangea/dnd` | 18.0.1 / 9.02.2025 | `^18 \|\| ^19` | Apache-2.0 | Fork `react-beautiful-dnd`. Tylko listy (pionowe i poziome, także między listami), siatek nie obsługuje. README deklaruje obsługę klawiatury i czytników ekranu z możliwością lokalizacji. Od lutego 2025 brak wydań, repo ma push z 9.10.2026. |
| `react-beautiful-dnd` | 13.1.1 / 30.08.2022 | do `^18` | Apache-2.0 | **Oznaczony `deprecated` w npm** (odsyła do issue atlassian/react-beautiful-dnd#2672). Peer nie obejmuje React 19. |
| `@formkit/drag-and-drop` | 0.6.1 / 15.06.2026 | brak peera React (adapter `./react`) | MIT | Jedyny peer to opcjonalny `@marko/runtime-tags`. Deklaruje ~4–5 kB po gzipie. Strona główna dokumentacji nie wspomina o klawiaturze ani czytnikach ekranu (dalszych podstron nie czytałem). |
| `react-sortablejs` + `sortablejs` | 6.1.4 / 31.05.2022; `sortablejs` 1.15.7 / 11.02.2026 | `>=16.9.0` | MIT | Adapter React od 2022 bez wydań. Dostępności nie sprawdzałem. |

## 4. Testowanie w naszym zestawie

### 4.1. vitest + Testing Library w jsdom

- **dnd-kit (legacy) potrzebuje układu.** W
  [#261](https://github.com/clauderic/dnd-kit/issues/261) autor wyjaśnia, że
  wszystkie sensory zależą od rozmiaru i położenia elementów. `KeyboardSensor`
  z `sortableKeyboardCoordinates` szuka najbliższego sąsiada w danym kierunku,
  a przy samych zerach z `getBoundingClientRect` w jsdom sąsiadem jest zawsze
  ten sam element. Autor zaleca w jsdom testować reakcję aplikacji na
  `onDragEnd` i pokrewne zdarzenia, a samo przeciąganie zostawić przeglądarce.
  Mockowanie `getBoundingClientRect` osobno dla każdego elementu nazywa
  uciążliwym, ale możliwym. Nowej linii (`@dnd-kit/react`) w jsdom nie
  sprawdzałem.
- **Pragmatic w jsdom.** jsdom nie ma `DragEvent` ani `DOMRect`. Po
  [#82](https://github.com/atlassian/pragmatic-drag-and-drop/issues/82)
  (zamkniętym 15.08.2024) Atlassian wydał polyfill `DOMRect` w pakiecie
  `@atlaskit/pragmatic-drag-and-drop-unit-testing` i zaktualizował przewodnik
  [Jest and jsdom](https://atlassian.design/components/pragmatic-drag-and-drop/core-package/testing/jest-and-jsdom).
  Przewodnik pokazuje przeciąganie sekwencją `fireEvent.dragStart`,
  `dragEnter`, `dragOver` i `drop`. Według dokumentacji biblioteka sama ma
  testy jednostkowe i przeglądarkowe, więc aplikacja powinna testować własną
  logikę, a nie mechanizm przeciągania.
- **React Aria w jsdom.** Biblioteka testuje DnD w jsdom (`jest.config.js`:
  `testEnvironment: 'jsdom'`). W `packages/react-aria/test/dnd/dnd.test.js`
  jest blok `describe('keyboard')`, który steruje przeciąganiem przez
  `user.keyboard('{Enter}')` i `{Escape}` z `@testing-library/user-event`.
  Natywne przeciąganie te testy symulują własnymi mockami `DataTransfer`
  i `DragEvent` (`test/dnd/mocks.js`), a `getBoundingClientRect` mockują.
  Osobny pakiet
  [`@react-aria/test-utils`](https://react-aria.adobe.com/testing) (dziś
  `1.0.0-rc.1`, peer `@testing-library/dom ^10` i `user-event ^14`) ma
  testery dla `GridList`, `ListBox`, `Table` i `Tree`. Czy obejmują
  przeciąganie, nie sprawdzałem.
- **`user-event` a natywne DnD.** W
  [testing-library/user-event#440](https://github.com/testing-library/user-event/issues/440)
  (2020) opiekunowie odradzali symulowanie drag and drop w jsdom, bo nie ma
  tam układu. Natywnego HTML5 DnD `user-event` 14 nie wywołuje. Szczegółów API
  `pointer` w wersji 14 nie sprawdzałem.

### 4.2. Funkcje `play` Storybooka (Vitest browser, Chromium)

- W Chromium układ jest prawdziwy, więc ograniczenie z §4.1 dotyczące
  `getBoundingClientRect` nie występuje.
- `userEvent` w naszych stories pochodzi ze `storybook/test` (§2), czyli
  z Testing Library, a nie z Vitesta.
- Vitest browser ma osobne `userEvent.dragAndDrop(source, target)`, które
  robi prawdziwe przeciągnięcie przez CDP albo WebDriver. Obsługują je
  providery Playwright i WebdriverIO, a `preview` nie. Element źródłowy musi
  mieć `draggable="true"`
  ([vitest.dev/guide/browser/interactivity-api](https://vitest.dev/guide/browser/interactivity-api)).
  To API celuje w natywne HTML5 DnD (Pragmatic, natywne ścieżki React Aria),
  a nie w sensory wskaźnika dnd-kit.
- Wariant z klawiatury (Enter lub Spacja, strzałki, Enter) korzysta
  z `userEvent.keyboard`, które jest w `storybook/test`. Że działa z każdą
  biblioteką w naszym Chromium, wynika z dokumentacji, nie z próby (§8).

## 5. Gotowe wzorce dla shadcn/ui

- **Oficjalny blok `dashboard-01`** (repo `shadcn-ui/ui`,
  `apps/v4/registry/bases/{radix,base}/blocks/dashboard-01/components/data-table.tsx`)
  układa tabelę TanStack z przeciąganymi wierszami. Importuje:
  - `DndContext`, `closestCenter`, `KeyboardSensor`, `MouseSensor`,
    `TouchSensor`, `useSensor` i `useSensors` z `@dnd-kit/core`;
  - `restrictToVerticalAxis` z `@dnd-kit/modifiers`;
  - `SortableContext`, `useSortable`, `arrayMove` i
    `verticalListSortingStrategy` z `@dnd-kit/sortable`;
  - `CSS` z `@dnd-kit/utilities`.

  Uchwyt to osobny komponent `DragHandle` w pierwszej kolumnie.
- **Wariant bazy React Aria** tego samego bloku
  (`apps/v4/registry/bases/aria/...`) używa `useDragAndDrop` z
  `react-aria-components`, a w `onReorder` woła `list.moveBefore` albo
  `list.moveAfter`. Ma też `DropIndicator`.
- **Bazy shadcn.** Od lipca 2026 shadcn ma trzy bazy: Base UI (domyślna dla
  nowych projektów), Radix (nadal w pełni wspierana, bez wymuszonej migracji)
  i React Aria
  ([changelog: React Aria](https://ui.shadcn.com/docs/changelog/2026-07-react-aria),
  [Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)).
  Katalog `registry/bases/aria/ui/` nie ma osobnych komponentów `list-box`
  ani `grid-list`, ma `table.tsx`. Czy da się mieszać bazy w jednym projekcie,
  changelog nie mówi.
- **Rejestr Dice UI**, komponent `sortable`
  ([diceui.com/r/sortable.json](https://diceui.com/r/sortable.json)), zależy
  od `@dnd-kit/core`, `modifiers`, `sortable`, `utilities` oraz od
  `@base-ui/react`. Używa `KeyboardSensor` i wystawia `announcements`
  i `screenReaderInstructions`. Wariantu dla Radix nie szukałem.

## 6. Tabela porównawcza

| | `@dnd-kit/core` + `sortable` | `@dnd-kit/react` | Pragmatic DnD | React Aria `useDragAndDrop` | `@hello-pangea/dnd` |
|---|---|---|---|---|---|
| Ostatnie wydanie stabilne | 6.3.1 / 10.0.0, grudzień 2024 | 0.5.0, 11.06.2026 (+ beta 12.09.2026) | 4.0.0, 24.09.2026 | RAC 1.22.1, 9.10.2026 | 18.0.1, 9.02.2025 |
| Peer React 19 | tak (`>=16.8.0`) | tak (`^18 \|\| ^19`) | rdzeń bez Reacta; klocki React `^18.2 \|\| ^19` | tak (`… \|\| ^19.0.0-rc.1`) | tak (`^18 \|\| ^19`) |
| Znane problemy z React 19 | #1511 zamknięte bez poprawki w tej linii | #2116 (`StrictMode`, otwarte) | `react-accessibility` nie jest testowany na 19 (wg dokumentacji) | nie znalazłem | nie szukałem |
| Status | „legacy", dokumentacja poleca nową wersję | 0.x, aktywny rozwój | aktywny, często wydania główne | aktywny | utrzymany fork, wydania rzadkie |
| Klawiatura | wbudowana (`KeyboardSensor`) | wbudowana, domyślnie włączona | brak w rdzeniu; zalecane menu akcji | wbudowana | wbudowana (wg README) |
| Czytniki ekranu | live region + instrukcje, konfigurowalne | wtyczka Accessibility, domyślnie włączona | `-live-region` + własne komunikaty | wbudowane | wbudowane, lokalizowalne (wg README) |
| Mechanizm | zdarzenia wskaźnika i klawiatury | zdarzenia wskaźnika i klawiatury | natywne HTML5 DnD | natywne DnD + własna obsługa klawiatury i czytników | własne zdarzenia |
| jsdom (vitest + RTL) | samo przeciąganie wymaga mockowania rectów; autor odradza | nie sprawdzone | polyfill `DOMRect` i `DragEvent`, `fireEvent.drag*` | klawiatura przez `user-event` w testach biblioteki | nie sprawdzone |
| Chromium (`play`) | prawdziwy układ; klawiatura przez `userEvent.keyboard` (nie sprawdzone) | jak obok (nie sprawdzone) | natywne DnD: `userEvent.dragAndDrop` z Vitesta, nie ze `storybook/test` | klawiatura przez `userEvent.keyboard` (nie sprawdzone) | nie sprawdzone |
| Wzorzec shadcn | blok `dashboard-01` (Radix, Base UI), Dice UI `sortable` | brak | brak | blok `dashboard-01` (baza Aria) | brak |
| Licencja | MIT | MIT | Apache-2.0 | Apache-2.0 | Apache-2.0 |
| `unpackedSize` (nie bundle) | ≈1,07 MB + ≈234 kB | ≈240 kB + `dom` ≈1,2 MB + reszta | rdzeń ≈486 kB (deklaracja: ~4.7 kB) | cała biblioteka (≈6,9 MB RAC + ≈15,7 MB `react-aria`) | ≈1,26 MB |

## 7. Co z faktów wynika dla #163 (bez wyboru)

To nie jest rekomendacja, tylko konsekwencje, które #163 będzie musiało
rozważyć:

- **Legacy dnd-kit.** Kod jest zgodny z gotowym blokiem shadcn w naszej bazie
  (Radix). Linia nie dostaje wydań od grudnia 2024, a jej dokumentacja kieruje
  do nowej. Test samego przeciągania z klawiatury w jsdom wymaga mockowania
  rectów.
- **Nowy dnd-kit.** Nie ma wzorca shadcn. Jest w wersji 0.x i ma otwarty błąd
  z `StrictMode`, którego używa `apps/admin`.
- **Pragmatic.** Dostępność trzeba zbudować samemu (menu akcji, live region)
  albo wziąć `react-accessibility` z zależnościami Atlassiana. Testy w jsdom
  wymagają polyfilli.
- **React Aria.** Dostępność i test klawiatury w jsdom są udokumentowane
  i używane przez samą bibliotekę. Do repo wchodzi jednak drugi zestaw
  prymitywów obok Radixa.
- **Przyciski „w górę / w dół" bez biblioteki** to wariant zgodny z kierunkiem
  wytycznych Pragmatic (widoczne kontrolki zamiast strzałek). Nie wymaga
  żadnej zależności. Ten research go nie bada.

## 8. Nie sprawdzone

- Rozmiary w bundlu (min+gzip) żadnego kandydata w naszym buildzie Vite.
- Czy `@dnd-kit/react` da się przetestować w jsdom (klawiatura, rect).
- Czy przeciąganie klawiaturą w dnd-kit (obu liniach) i w React Aria
  przechodzi w naszych funkcjach `play` w Chromium. Wynika to z dokumentacji,
  nie z próby.
- Czy w funkcji `play` da się użyć `userEvent` z `vitest/browser`, skoro ta
  sama story działa też w zwykłym UI Storybooka, gdzie Vitesta nie ma.
- Czy RTL `render` albo nasz Storybook owija komponenty w `StrictMode`, czyli
  czy #2116 dotknąłby testów, czy tylko `npm run dev:admin`.
- Czy komunikaty React Aria zawierają polski.
- Czy testery `@react-aria/test-utils` obejmują przeciąganie.
- Zachowanie `@hello-pangea/dnd` i `@formkit/drag-and-drop` w testach oraz
  dostępność FormKit poza stroną główną dokumentacji.
- Wariant Dice UI `sortable` dla Radix.
- Czy komponenty bazy React Aria i Radix da się mieszać w jednym projekcie
  shadcn.

## 9. Źródła

- npm registry (`npm view …`, 10.10.2026): `@dnd-kit/{core,sortable,modifiers,utilities,accessibility,react,dom,abstract,helpers}`,
  `@atlaskit/pragmatic-drag-and-drop{,-hitbox,-react-accessibility,-react-drop-indicator,-live-region,-unit-testing}`,
  `react-aria`, `react-aria-components`, `@react-aria/dnd`, `@react-aria/test-utils`,
  `@hello-pangea/dnd`, `react-beautiful-dnd`, `@formkit/drag-and-drop`,
  `sortablejs`, `react-sortablejs`.
- dnd-kit: <https://dndkit.com/legacy/introduction/installation>,
  <https://dndkit.com/legacy/guides/accessibility>,
  <https://dndkit.com/react/migration>,
  <https://dndkit.com/react/guides/sensors/>,
  <https://dndkit.com/extend/plugins/accessibility/>; issues
  [#261](https://github.com/clauderic/dnd-kit/issues/261),
  [#1511](https://github.com/clauderic/dnd-kit/issues/1511),
  [#2008](https://github.com/clauderic/dnd-kit/issues/2008),
  [#2116](https://github.com/clauderic/dnd-kit/issues/2116),
  PR [#2117](https://github.com/clauderic/dnd-kit/pull/2117); releases
  <https://github.com/clauderic/dnd-kit/releases>.
- Pragmatic drag and drop: README
  <https://github.com/atlassian/pragmatic-drag-and-drop>,
  <https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines>,
  <https://atlassian.design/components/pragmatic-drag-and-drop/core-package/testing/about>,
  <https://atlassian.design/components/pragmatic-drag-and-drop/core-package/testing/jest-and-jsdom>,
  <https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages/react-accessibility/about>,
  issue [#82](https://github.com/atlassian/pragmatic-drag-and-drop/issues/82),
  `CHANGELOG.md` z <https://cdn.jsdelivr.net/npm/@atlaskit/pragmatic-drag-and-drop@4.0.0/CHANGELOG.md>.
- React Aria: <https://react-aria.adobe.com/dnd>,
  <https://react-aria.adobe.com/GridList>, <https://react-aria.adobe.com/testing>;
  kod testów `packages/react-aria/test/dnd/{dnd.test.js,mocks.js,useDraggableCollection.test.js}`
  i `jest.config.js` w <https://github.com/adobe/react-spectrum> (gałąź `main`).
- shadcn/ui: `apps/v4/registry/bases/{radix,base,aria}/blocks/dashboard-01/components/data-table.tsx`
  w <https://github.com/shadcn-ui/ui> (gałąź `main`),
  <https://ui.shadcn.com/docs/changelog/2026-07-react-aria>,
  <https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default>.
- Dice UI: <https://diceui.com/r/sortable.json>.
- `@hello-pangea/dnd`: README <https://github.com/hello-pangea/dnd>, releases.
- FormKit: <https://drag-and-drop.formkit.com/>.
- Vitest: <https://vitest.dev/guide/browser/interactivity-api>.
- Storybook: <https://storybook.js.org/docs/writing-tests/interaction-testing>.
- Testing Library: [user-event#440](https://github.com/testing-library/user-event/issues/440).
