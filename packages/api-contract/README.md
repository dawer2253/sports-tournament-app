# Kontrakt API

`openapi.yaml` jest jedynym źródłem prawdy o kształcie API. Nie opisuje tego, co
backend robi: opisuje to, co backend **ma robić**, i jest pisany zanim powstanie kod.

Uzasadnienie decyzji: [`docs/adr/0001`](../../docs/adr/0001-kontrakt-openapi-jako-zrodlo-prawdy.md).

## Co z niego wynika

| Odbiorca | Jak korzysta |
|---|---|
| `packages/api-client` | generowane typy i klient TS (`npm run contract:generate`) |
| `apps/*` | mock na `:4010`, dopóki backend nie stoi |
| `backend` | asercje zgodności w testach (Spectator) |

## Praca ze specyfikacją

```bash
npm run contract:validate     # walidacja (redocly)
npm run mock                  # mock na http://127.0.0.1:4010
npm run contract:generate     # regeneracja klienta TS
```

Po każdej zmianie `openapi.yaml` **przegeneruj klienta i zacommituj go razem ze
zmianą specyfikacji**. CI odrzuca pull requesty, w których te dwie rzeczy się
rozjeżdżają.

### Mock

Prism odpowiada przykładami zapisanymi w spec (pole `example` przy odpowiedzi).
Wynika z tego kilka rzeczy, które zaskakują przy pierwszym użyciu:

- Endpointy z autoryzacją zwracają `401`, dopóki nie wyślesz nagłówka
  `Authorization`. Wystarczy dowolna wartość: mock sprawdza obecność, nie treść.
- Odpowiedź jest zawsze ta sama. Chcesz innych danych na ekranie? Dopisz je jako
  przykład w `openapi.yaml`, nie obok niego.
- `npm run mock:strict` dokłada walidację żądań: mock odrzuca to, co nie zgadza
  się z kontraktem. Przydatne przy sprawdzaniu formularzy.

## Zakres

**v0.1 (obecne):** konta, sporty, turnieje, drużyny, zawodnicy, obiekty, odczyt
faz, meczów i tabel, strona publiczna.

**v0.2 (przed pracami nad ligą):** generowanie terminarza, wpisywanie wyniku
i zmiana stanu meczu, zdarzenia meczowe, drabinka.

Kształty `Match`, `Round` i `StandingRow` są zamrożone już w v0.1, żeby v0.2 nie
było zmianą łamiącą dla nikogo.
