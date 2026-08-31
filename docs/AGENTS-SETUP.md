# Praca z agentem AI w tym repo

Repo jest przygotowane pod pracę z agentem, ale **narzędzie jest twoim wyborem**.
Claude Code, Cursor, Antigravity, Codex: każde zadziała, o ile zrobisz dwie rzeczy
z tego dokumentu.

## Podział: co wspólne, co twoje

Rozróżnienie, które tłumaczy resztę tego pliku.

**Wspólne, jest w repo, commitujemy.** To opis *naszego* projektu i nikt tego
u siebie nie odtwarza:

| Plik | Co zawiera |
|---|---|
| [`AGENTS.md`](../AGENTS.md) | konwencje repo, struktura, jak uruchamiać, zasada kontraktu |
| [`CONTEXT.md`](../CONTEXT.md) | słownik domeny: `Stage`, `Round`, `Standing`, `Tiebreaker` |
| [`docs/adr/`](adr/) | decyzje trudne do odwrócenia i powody, dla których zapadły |
| [`docs/agents/`](agents/) | konfiguracja skilli: gdzie żyją issues, jakich etykiet używamy, gdzie zapisywać dokumenty |
| [`packages/ui/AGENTS.md`](../packages/ui/AGENTS.md) | zasady design systemu |
| [`.mcp.json`](../.mcp.json) | serwery MCP projektu (dziś Laravel Boost, patrz [`docs/BACKEND.md`](BACKEND.md)) |

**Twoje, instalujesz u siebie, nie commitujemy.** Skille to twój warsztat, nie
część projektu. Gdyby trafiły do repo, każda aktualizacja u jednej osoby byłaby
pull requestem dla pozostałych.

## Krok 1: zainstaluj skille

Używamy zestawu [mattpocock/skills](https://github.com/mattpocock/skills).
**Wybierz jedną drogę**, nie obie: instalacja obiema naraz da ci każdy skill
podwójnie.

### Claude Code

```bash
claude plugins install mattpocock-skills
```

Albo z wnętrza sesji: `/plugin install mattpocock-skills`. Wtyczka jest
w oficjalnym marketplace, aktualizacje przychodzą same.

### Cursor, Antigravity, Codex i reszta

```bash
npx skills@latest add mattpocock/skills
```

Instalator zapyta, **które skille** chcesz wziąć i **do którego narzędzia** je
zainstalować. Zapisuje je jako zwykłe pliki Markdown, które możesz czytać
i edytować. Aktualizacja na żądanie: `npx skills update`.

Jeśli twojego narzędzia nie ma na liście instalatora, przejdź do sekcji
"Narzędzie bez wsparcia dla skilli" na końcu.

> **Po instalacji sprawdź `git status`.** Jeżeli instalator zapisał cokolwiek
> wewnątrz repo, dopisz tę ścieżkę do `.gitignore` zamiast commitować.

## Krok 2: nie uruchamiaj `/setup-matt-pocock-skills`

Ten skill konfiguruje repo pod resztę zestawu: pyta o issue tracker, o etykiety
triage i o to, gdzie zapisywać dokumenty. **U nas jest to już zrobione i leży
w [`docs/agents/`](agents/)**, a wyniki są zacommitowane.

Uruchomienie go ponownie nadpisze tę konfigurację twoimi odpowiedziami i wygeneruje
pull requesta, który zmienia ustalenia zespołu. Skill możesz zainstalować, po
prostu go nie odpalaj.

## Krok 3: upewnij się, że agent czyta `AGENTS.md`

Konwencje repo trzymamy w [`AGENTS.md`](../AGENTS.md) w katalogu głównym. Nazwa
jest neutralna celowo: `CLAUDE.md` obok niego to jedna linijka wskazująca na ten
sam plik, żeby Claude Code trafił tam, gdzie wszyscy inni.

Większość narzędzi ładuje `AGENTS.md` automatycznie na starcie sesji. Sprawdzisz to
w dziesięć sekund, pytając agenta na czystej sesji:

> Jakiej kolejności trzymamy się przy zmianie API w tym repo?

Poprawna odpowiedź mówi, że **najpierw zmienia się `openapi.yaml`**, potem
regeneruje klienta, a dopiero na końcu pisze kod. Jeżeli agent tego nie wie, nie
załadował pliku: zacznij sesję od "przeczytaj AGENTS.md i CONTEXT.md" albo dodaj te
pliki do kontekstu ręcznie, zależnie od tego, co twoje narzędzie oferuje.

## Które skille realnie przydają się w tym projekcie

Nie musisz znać całego zestawu. Te mają u nas konkretne zastosowanie:

| Skill | Kiedy po niego sięgnąć |
|---|---|
| `/grill-with-docs` | **Zanim** zaczniesz większy kawałek. Agent przepytuje cię rundami, aż wyjdą decyzje, których nie przemyślałeś, i zapisuje ustalenia do `CONTEXT.md` oraz ADR-ów. Tym powstał cały fundament tego repo. |
| `/domain-modeling` | Gdy dodajesz albo doprecyzowujesz pojęcie domenowe. Pilnuje, żeby `CONTEXT.md` nie rozjechał się z kodem. |
| `/tdd` | Silnik rozgrywek: generator terminarza, tabela, tiebreaki, kaskada w drabince. To logika z jednoznacznym oczekiwanym wynikiem, czyli dokładnie ten przypadek, w którym test-first się opłaca. |
| `/diagnosing-bugs` | Gdy coś nie działa i nie wiesz dlaczego. Pętla diagnostyczna zamiast zgadywania. |
| `/code-review` | Przed wystawieniem pull requesta. U nas każdy PR czyta ktoś inny, ten skill jest pierwszym przebiegiem. |
| `/research` | Gdy trzeba sprawdzić, jak coś działa w Laravelu albo w bibliotece, i zapisać wnioski, żeby nie szukać drugi raz. |
| `/triage`, `/to-tickets` | Praca z issues. Etykiety, których używamy, opisuje [`docs/agents/triage-labels.md`](agents/triage-labels.md). |
| `/prototype` | Gdy nie wiesz, czy model danych albo ekran ma sens. Kod na wyrzucenie, żeby odpowiedzieć na jedno pytanie. |

Pełna lista i opisy: [README zestawu](https://github.com/mattpocock/skills).

## Narzędzie bez wsparcia dla skilli

Skill to zwykły plik Markdown z instrukcją. Jeżeli twoje narzędzie nie zna komend
ze slashem, użycie sprowadza się do wskazania pliku:

> Przeczytaj `<ścieżka>/grill-with-docs/SKILL.md` i zastosuj go do: chcę dodać
> generowanie terminarza.

Działa to gorzej niż natywne wsparcie, bo nic nie przypomni agentowi o skillu
w odpowiednim momencie, ale sama treść jest ta sama.

## Zanim pierwszy raz coś napiszesz

Trzy rzeczy oszczędzą ci powtórki:

1. **Nazwy bierz z [`CONTEXT.md`](../CONTEXT.md).** Jeżeli pojęcia tam nie ma, to
   sygnał: albo wymyślasz język, którego projekt nie używa, albo słownik ma lukę
   i trzeba ją uzupełnić, a nie obejść.
2. **Kontrakt przed kodem.** Zmiana API zaczyna się od `openapi.yaml`. Agent
   poproszony o "dodaj endpoint" chętnie napisze kontroler i pominie spec: przypilnuj.
3. **Sprawdź [`docs/adr/`](adr/), zanim podważysz jakąś decyzję.** Jeżeli coś
   wygląda na dziwne, możliwe, że powód jest zapisany. Jeżeli powodu nie ma,
   podważaj śmiało.
