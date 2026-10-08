# apps/admin — panel organizera

Obowiązują [zasady globalne z rootu](../AGENTS.md), w tym „Testy frontendu”
(vitest + msw, pułapka z `server.listen()`).

## Edycja list

Dotyczy bytów turnieju, które organizer dodaje, zmienia i usuwa na liście:
obiektów, drużyn i zawodników. Wzorzec rozstrzygnął
[#86](https://github.com/dawer2253/sports-tournament-app/issues/86), a ten plik
jest jego jedynym opisem dla kodu.

- **Okna z design systemu.** Dodawanie i edycja idą w `FormDialog`, usuwanie
  w `ConfirmDeleteDialog`. Ołówek i kosz stoją w wierszu, a „Dodaj …” w akcjach
  nagłówka i w pustym stanie. Wyjątkiem są drużyny: wiersz prowadzi do składu,
  więc ich akcje siedzą w nagłówku ekranu składu
  ([#89](https://github.com/dawer2253/sports-tournament-app/issues/89)).
- **Walidacja w dwóch miejscach.** `zod` w kliencie sprawdza to, co widać
  w samym polu: wymagane, długość, format. Schemat leży w `src/lib/`, tak jak
  `tournament-create-schema.ts`. Unikalność i limity sprawdza tylko serwer,
  bo tylko on zna resztę listy. Odpowiada `422`, a hook sadza błąd przy polu
  albo, gdy klucz jest formularzowi nieznany (limit pod `venues`), nad nim.
- **Zapis przez `useListMutation`** (`src/lib/use-list-mutation.ts`), jeden
  hook dla wszystkich ekranów list. Co robi z każdą odpowiedzią (`2xx`, `422`,
  `404`, `5xx`, sieć), opisuje tabela w komentarzu przy hooku. Przy wpinaniu:
  - woła go komponent okna, renderowany warunkowo, nie ekran — stan błędu żyje
    tyle co okno;
  - okno formularza podaje `form: { fields, setError }` i woła `create` albo
    `update`; potwierdzenie podaje samo `entity`, `invalidate` i `onDone`, woła
    `remove` i rozkłada `removeError` na propsy `ConfirmDeleteDialog`;
  - `invalidate` to lista, a przy drużynach także `['tournament', id]`, bo
    stamtąd idzie `teamsCount`;
  - teksty bytu (`ListEntity`) są całymi zdaniami, bo rodzaj gramatyczny
    zmienia więcej niż końcówkę.

  Oba okna złożone tak, jak złoży je ekran, są w `use-list-mutation.test.tsx`.
- **Toasty** rysuje jeden `Toaster` w `main.tsx`. `toast` bierz z
  `@tournament/ui`, bo tylko ta sama kopia `sonner` trafia do tego `Toaster`.
  Test ekranu montuje własny `<Toaster />` obok strony.

Odrzucone w #86 i dlaczego:

- **Zapis optymistyczny.** Okno zamknięte przed odpowiedzią nie ma gdzie
  pokazać błędu pola, więc zostaje toast z cofnięciem. Kolejność listy ustala
  backend, więc wstawianie wpisu do cache'u musiałoby ją powtarzać.
- **Edycja w wierszu.** Nie zmieści formularza zawodnika i jest słaba na
  telefonie.
- **Panel boczny.** Dwa pola nie potrzebują pół ekranu.
- **Osobna trasa formularza.** Przeładowanie kontekstu dla dwóch pól.
