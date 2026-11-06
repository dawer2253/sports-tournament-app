# ADR-0014: Serwer MCP to cienka warstwa narzędzi nad kontraktem

Status: przyjęte
Data: 2026-11-06

## Kontekst

[#335](https://github.com/dawer2253/sports-tournament-app/issues/335) dał
lokalny serwer MCP z trzema narzędziami do nagrania demo: załóż ligę, dodaj
drużyny, ułóż terminarz. Turniej zostawał szkicem, a publikował go organizator
w panelu („akceptacja przez szkic”). Do prowadzenia ligi to za mało: nie da się
dodać zawodnika, poprawić nazwy, wpisać wyniku ani niczego usunąć.

[#338](https://github.com/dawer2253/sports-tournament-app/issues/338) rozszerza
serwer na cały turniej, we wszystkich formatach. Poprzeczka to wymagania
katalogu konektorów Claude (podpowiedzi, opisy, schematy, błędy), choć serwera
nie zgłaszamy. Fakty o katalogu i specyfikacji zebrał research
[`docs/research/mcp-serwer.md`](../research/mcp-serwer.md), a resztę sprawdziła
sesja grillingu.

## Decyzja

Serwer jest cienką warstwą nad kontraktem: każde narzędzie woła trasy, z których
korzysta panel, a walidację zostawia API. Nie ma własnego modelu domeny ani
pamięci między wywołaniami. Reguły:

1. **Jedno narzędzie na encję i czynność** (`update_team`, `delete_player`,
   `set_match_result`), a nie ogólne `update_entity(type, id, fields)`. Każde ma
   wtedy własny schemat i opis, a klient może pytać o zgodę narzędzie po narzędziu.
   Katalog odrzuca narzędzie, które naraz czyta i zapisuje.
2. **Tylko id.** Narzędzia zapisu przyjmują id, a narzędzia odczytu
   (`list_tournaments`, `get_tournament`, `list_players`, `list_matches`…)
   je dają. Serwer nie dopasowuje nazw: „Orły” w dwóch turniejach to dwie różne
   drużyny, a pomyłka przy usuwaniu kosztuje dane.
3. **Dodawanie paczką, usuwanie pojedynczo.** Paczka idzie po kolei. Pozycję
   odrzuconą przez `422` pomija z powodem, a przy innym błędzie przerywa i mówi,
   co już weszło, żeby agent nie dublował wpisów. Usuwania hurtowego nie ma,
   bo najłatwiej nim przez pomyłkę wyczyścić turniej.
4. **Podpowiedzi ściśle według specyfikacji.**
   - Odczyt: `readOnlyHint: true`.
   - Dodawanie: jawne `destructiveHint: false`, bo domyślnie jest `true`.
   - Edycja, generowanie i usuwanie: `destructiveHint: true`, także przy zmianie
     nazwy, bo nadpisanie wartości to zmiana destrukcyjna.
   - `idempotentHint` tylko tam, gdzie ponowienie niczego nie zmienia. Losowanie
     i generowanie par go nie mają.
   - `openWorldHint: false` wszędzie, bo to zamknięta domena naszego API.

   Ceną jest pytanie o zgodę przy każdej edycji. Organizator może zezwolić na
   stałe narzędzie po narzędziu.
5. **Publikuje także agent.** Osobne `set_tournament_status`, a nie pole
   w `update_tournament`, bo status zmienia, co widzi publiczność. Odwraca to
   „akceptację przez szkic” z #335. Szkic dalej jest domyślny po założeniu, ale
   publikacja przestaje wymagać panelu.
6. **Losowanie robi serwer MCP** (`draw_groups`, `generate_bracket` z
   `seeding: random`). Backend nie losuje, bo panel tasuje u siebie, a model
   językowy losuje źle.
7. **Opisy bez poleceń.** Opis mówi, co narzędzie robi, kiedy API odmawia i jakie
   są skutki („usuwa też mecze zaplanowane drużyny”). Nie mówi „wywołaj potem X”,
   bo katalog tego zabrania. Parametr może powiedzieć, skąd wziąć id.
8. **Odpowiedź w dwóch postaciach.** `structuredContent` zgodny z `outputSchema`
   oraz polskie zdania z każdym id potrzebnym do dalszej pracy, na wypadek
   klienta, który `structuredContent` ignoruje. Długie wyniki są stronicowane
   (`list_matches` po 50) albo skracane do liczb (terminarz powyżej 120 meczów).

Poza zakresem zostają loga, bo wysyłanie pliku multipart nie zadziała w serwerze
zdalnym, który lokalnych plików nie widzi. Poza zakresem jest też zegar meczu na
żywo, bo to obsługa przy linii bocznej, a nie rozmowa.

## Konsekwencje

- 37 narzędzi w `apps/mcp-server/src/tools/`, po pliku na obszar. Katalog
  i konwencje są w [`docs/MCP.md`](../MCP.md).
- Zmiana reguły w API (np. nowy powód `422`) nie wymaga zmian w serwerze:
  komunikat przechodzi do agenta bez zmian. Zmiana kształtu kontraktu wymaga,
  bo serwer mapuje odpowiedzi na `outputSchema`, a typy pilnują tego przy
  `npm run typecheck`.
- Tam, gdzie API nie mówi wprost, czego chce, serwer zgaduje i ponawia.
  `clear_match_result` nie zna sportu meczu, więc najpierw wysyła wersję
  setową, a po odmowie pod kluczem `sets` wersję z wynikiem. Gdyby takich
  miejsc przybyło, lepiej dodać pole do kontraktu, niż mnożyć zgadywanie.
- Klasyfikacja zawodników jest tylko w API publicznym, więc `get_leaderboard`
  działa dla turnieju opublikowanego, a dla szkicu zwraca błąd z wyjaśnieniem.
