# apps/admin — panel organizera

Obowiązują [zasady globalne z rootu](../AGENTS.md), w tym „Testy frontendu”
(vitest + msw, pułapka z `server.listen()`).

## Formularze i okna

Zasada całego panelu: list, ustawień, terminarza i każdego przyszłego ekranu.
Wzorzec okien rozstrzygnął
[#86](https://github.com/dawer2253/sports-tournament-app/issues/86) dla list,
a [#162](https://github.com/dawer2253/sports-tournament-app/issues/162) (pkt 6
i 7) rozciągnął go na cały panel. Ten plik jest ich jedynym opisem dla kodu.

- **Każdy formularz i każde potwierdzenie to okno na środku**: `FormDialog`
  albo `ConfirmDeleteDialog` z design systemu. Dotyczy to też terminarza:
  generowanie, rozkład dat i mecz idą w oknach.
- **Bez paneli bocznych, dymków z formularzem i osobnych stron formularzy.**
  Dwa wzorce z regułą, kiedy który, trzeba by tłumaczyć, więc nie ujednolicają.
- **Pola w kilku kolumnach równają się do góry**, więc podpis pod jednym polem
  (np. „Zmieni długość meczu w całym turnieju”) nie przesuwa pola obok. Pole
  w siatce ma `content-start`, jak `TextField`.
- **Listy wyboru idą przez `Select` z design systemu**, a nie przez natywny
  `<select>`, który ma inną wysokość i ramkę niż `Input` obok.
- **Toasty** rysuje jeden `Toaster` w `main.tsx`. `toast` bierz z
  `@tournament/ui`: do tego `Toaster` dociera tylko `toast` z tej samej kopii
  `sonner`. Test ekranu montuje własny `<Toaster />` obok strony.

### Edycja list

Dotyczy bytów turnieju, które organizer dodaje, zmienia i usuwa na liście:
obiektów, drużyn i zawodników. Okna są te z zasady wyżej, a lista dokłada do
nich miejsce akcji, walidację i zapis.

- **Miejsce akcji.** Ołówek i kosz stoją w wierszu, a „Dodaj …” w akcjach
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
    `update`; potwierdzenie podaje tylko `texts`, `invalidate` i `onDone`, woła
    `remove` i rozkłada `removeError` na propsy `ConfirmDeleteDialog`;
  - `invalidate` to lista, a przy drużynach także `['tournament', id]`, bo
    stamtąd idzie `teamsCount`. Dotyczy to dodania i usunięcia drużyny:
    zmiana nazwy liczby drużyn nie zmienia, więc unieważnia drużynę i listę.
    Klucze pasują po prefiksie, więc `['tournament', id]` odświeża też
    wszystko, co leży pod nim;
  - przy usuwaniu `invalidate` obejmuje tylko to, co zostaje: listę i turniej.
    Klucze usuniętego bytu (drużyna i jej skład na ekranie składu) leżą poza
    tymi prefiksami, bo odświeżone dostałyby `404`, a ich ekran i tak znika
    w `onDone`;
  - `texts` (`ListTexts`) to biernik do toastów sukcesu i dwa całe zdania na
    `404`, bo w nich rodzaj gramatyczny zmienia więcej niż końcówkę.

  Oba okna złożone tak, jak złoży je ekran, są w `use-list-mutation.test.tsx`.

Odrzucone w #86 i dlaczego (#162 potwierdził to samo dla całego panelu):

- **Zapis optymistyczny.** Okno zamknięte przed odpowiedzią nie ma gdzie
  pokazać błędu pola, więc zostałby tylko toast z cofnięciem. Kolejność listy
  ustala backend, więc wstawianie wpisu do cache'u musiałoby ją powtarzać.
- **Edycja w wierszu.** Nie zmieści formularza zawodnika i jest słaba na
  telefonie.
- **Panel boczny.** Dwa pola nie potrzebują pół ekranu.
- **Osobna trasa formularza.** Przeładowanie kontekstu dla dwóch pól.
