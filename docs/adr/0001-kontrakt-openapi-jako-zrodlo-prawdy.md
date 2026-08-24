# ADR-0001: Kontrakt API pisany ręcznie w OpenAPI jest źródłem prawdy

Status: przyjęte
Data: 2026-08-24

## Kontekst

Trzy osoby pracują równolegle na wertykalnych wycinkach, każdy obejmujący backend
i frontend. Prace zaczynają się w momencie, w którym backend jeszcze nie istnieje.
Ryzyko rozjazdu kontraktu między Laravelem a dwiema aplikacjami React zostało
w planie wdrożenia wskazane jako jedno z głównych.

Trzeba było rozstrzygnąć, co jest źródłem prawdy o kształcie API.

## Rozważane warianty

**Typy TypeScript jako kontrakt.** Ręcznie pisane typy i schematy Zod w pakiecie
klienta, backend dopasowuje się dyscypliną i przeglądem kodu. Odrzucone: backend
nie dostaje niczego, czym mógłby udowodnić zgodność, więc rozjazd wychodzi dopiero
przy integracji.

**Generowanie OpenAPI z kodu Laravela.** Odrzucone: odwraca kolejność pracy.
Frontend nie może ruszyć, dopóki endpoint nie stoi, a to jest dokładnie ta
blokada, której chcemy uniknąć na starcie.

**Ręcznie pisany OpenAPI jako źródło prawdy.** Wybrane.

## Decyzja

`packages/api-contract/openapi.yaml` jest jedynym źródłem prawdy o kształcie API.
Z niego wynikają trzy rzeczy:

- typy i klient TypeScript w `packages/api-client`, generowane i **commitowane**,
  żeby zmiana kontraktu była widoczna w diffie pull requesta,
- mock (Prism), na którym frontend pracuje, zanim backend istnieje,
- asercje zgodności w testach backendu (Spectator).

Kolejność pracy przy zmianie API jest zawsze taka sama: najpierw spec, potem
regeneracja klienta, potem kod. CI odrzuca pull requesty, w których wygenerowany
klient nie odpowiada specyfikacji.

## Konsekwencje

Kupujemy: równoległą pracę od pierwszego dnia, jeden opis API zamiast trzech
rozjeżdżających się, gotowy materiał do rozdziału o API w pracy inżynierskiej.

Płacimy: ktoś musi ręcznie utrzymywać plik YAML, a każda zmiana API wymaga
dodatkowego kroku, którego przy zwykłym Laravelu by nie było. Przy pierwszych
kilku pull requestach będzie to odczuwalne jako tarcie.

Zakres kontraktu jest fazowany. v0.1 obejmuje warstwę platformy i odczyt,
endpointy silnika rozgrywek wchodzą w v0.2. Kształty `Match`, `Round`
i `StandingRow` są zamrożone już w v0.1, żeby v0.2 nie było zmianą łamiącą.
