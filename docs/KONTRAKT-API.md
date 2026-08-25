# Kontrakt API — co to jest i po co

Dokument wyjaśniający. Reguły pracy ze specyfikacją są w
[`packages/api-contract/README.md`](../packages/api-contract/README.md), a decyzja
i jej uzasadnienie w [ADR-0001](adr/0001-kontrakt-openapi-jako-zrodlo-prawdy.md).
Tutaj chodzi o to, żeby zrozumieć, skąd ta konstrukcja się wzięła.

## Problem, który rozwiązuje

Trzy osoby pracują równolegle na wertykalnych wycinkach — każdy obejmuje i backend,
i frontend. Prace zaczynają się w momencie, w którym backend jeszcze nie istnieje.

Bez wspólnego punktu odniesienia dzieje się to, co zwykle: backend zwraca
`goals_for`, panel spodziewa się `goalsFor`, strona publiczna czyta `goals`, a każdy
z tych wyborów jest sam w sobie sensowny. Nikt nie wie, że coś jest nie tak, dopóki
nie przyjdzie integracja — czyli najpóźniej, jak się da, i zwykle pod terminem.

Dochodzi drugi problem: frontend nie ma o co oprzeć pracy, dopóki nie stoi endpoint.
Trzy osoby stoją w kolejce do jednej.

## Co z tym robimy

Jeden plik, `packages/api-contract/openapi.yaml`, pisany ręcznie i **przed** kodem.
Opisuje nie to, co backend robi, tylko to, co ma robić. Jest jedynym źródłem prawdy
o kształcie API — jeżeli czegoś w nim nie ma, to tego nie ma.

Z tego jednego pliku wypadają trzy rzeczy, każda dla kogoś innego:

| Odbiorca | Co dostaje | Po co |
|---|---|---|
| `packages/api-client` | typy i klient TypeScript, generowane i commitowane | panel i strona publiczna nie zgadują kształtów — nie skompilują się, jeśli spudłują |
| `apps/admin`, `apps/public` | mock (Prism) na `:4010` | można pisać ekrany, zanim powstanie pierwszy kontroler w Laravelu |
| `backend` | asercje zgodności w testach (Spectator) | test backendu jest czerwony, gdy odpowiedź rozjedzie się ze specyfikacją |

Kluczowe jest to, że **wszystkie trzy są automatyczne**. Gdyby zgodność opierała się
na dyscyplinie i przeglądzie kodu, rozjazd i tak by wystąpił, tylko później.

## Co to zmienia w codziennej pracy

Zmiana API ma jedną, stałą kolejność:

1. edytujesz `openapi.yaml`,
2. `npm run contract:generate`,
3. dopiero teraz piszesz kod backendu i frontendu.

CI odrzuca pull requesta, w którym wygenerowany klient nie odpowiada specyfikacji.
Klient jest commitowany właśnie po to, żeby zmiana API była widoczna w diffie, a nie
chowała się w kroku instalacji.

Cena jest realna i warto ją nazwać: ktoś musi ręcznie utrzymywać plik YAML, a każda
zmiana API ma krok, którego przy zwykłym Laravelu by nie było. Przy pierwszych kilku
pull requestach czuć to jako tarcie. Kupujemy za to równoległą pracę od pierwszego
dnia i jeden opis API zamiast trzech rozjeżdżających się.

## Dlaczego akurat OpenAPI, a nie typy TypeScript

Rozważaliśmy trzy warianty, opisane w [ADR-0001](adr/0001-kontrakt-openapi-jako-zrodlo-prawdy.md):

- **Typy TS jako kontrakt** — odpada, bo backend nie dostaje niczego, czym mógłby
  udowodnić zgodność.
- **Generowanie OpenAPI z kodu Laravela** — odpada, bo odwraca kolejność: frontend
  znów czeka na endpoint.
- **Ręcznie pisany OpenAPI** — wybrane.

## Co jest w środku dziś

**v0.1:** konta i logowanie, sporty, turnieje, drużyny, zawodnicy, obiekty, odczyt
faz, meczów i tabel, strona publiczna po slugu.

**v0.2:** generowanie terminarza, wpisywanie wyniku i zmiana stanu meczu, zdarzenia
meczowe, drabinka.

Kształty `Match`, `Round` i `StandingRow` są **zamrożone już w v0.1**, mimo że
odpowiadające im endpointy zapisu wchodzą dopiero w v0.2. Powód: `Match` jest jedynym
bytem, którego dotykają wszystkie trzy wycinki pracy naraz, więc zmiana jego kształtu
w połowie semestru uderzyłaby we wszystkich jednocześnie.

## Gdzie czego szukać

| Czego szukasz | Gdzie |
|---|---|
| kształtu konkretnego endpointu | [`packages/api-contract/openapi.yaml`](../packages/api-contract/openapi.yaml) |
| jak uruchomić mock, jak przegenerować klienta | [`packages/api-contract/README.md`](../packages/api-contract/README.md) |
| co znaczy dane pojęcie domenowe | [`CONTEXT.md`](../CONTEXT.md) |
| dlaczego coś jest tak, a nie inaczej | [`docs/adr/`](adr/) |
| jak modelują to inni | [`docs/research/`](research/) |
