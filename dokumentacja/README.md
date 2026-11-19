# Dokumentacja projektu inżynierskiego

Dokumenty do oddania na przedmiocie „Projekt inżynierski” (UKEN, semestr VII).

## Zawartość

| Katalog / plik | Co to jest |
|---|---|
| `latex/wybor_projektu/` | Wybór projektu |
| `latex/dokumentacja_projektowa/` | Dokumentacja projektowa |
| `latex/dokumentacja_uzytkowa/` | Dokumentacja użytkowa (zrzuty ekranu w `images/`) |
| `latex/dokumentacja_instalacyjno_konfiguracyjna/` | Dokumentacja instalacyjno-konfiguracyjna |
| `latex/sprawozdanie_koncowe/` | Sprawozdanie końcowe |
| `latex/Readme.pdf` | Instrukcja do szablonów od prowadzących |
| `Aplikacja - co i jak.*` | Ściąga na spotkanie z promotorami |
| `Uruchomienie aplikacji.*` | Ściąga: jak uruchomić i pokazać aplikację |

Każdy katalog w `latex/` zawiera plik `.tex` (źródło), gotowy `.pdf` i katalog `images/`.

## Jak edytować

**Overleaf:** spakuj wybrany katalog (np. `latex/sprawozdanie_koncowe/`) do ZIP,
w Overleaf wybierz *New Project → Upload Project* i wgraj archiwum. Kompilator: pdfLaTeX.

**Lokalnie:** w katalogu dokumentu uruchom `pdflatex` trzy razy (spis treści i odnośniki):

```
pdflatex sprawozdanie_koncowe.tex
```

Zasady szablonu (z `Readme.pdf`):

- dane wspólne (tytuł, skład zespołu, daty) są na początku każdego `.tex` w `\newcommand`;
- miejsca do uzupełnienia oznacza `\pole{...}`: zamień całe wywołanie na treść,
  ale nie usuwaj definicji `\pole`;
- podpowiedzi włącza `\podpowiedzitrue`, wyłącza `\podpowiedzifalse`.

## Do uzupełnienia

- nazwa pliku z nagraniem demo (sprawozdanie końcowe, dokumentacja użytkowa);
- końcowy commit / tag wersji oddanej (sprawozdanie końcowe).

Po zmianie `.tex` przekompiluj PDF i wrzuć oba pliki, żeby wersje się zgadzały.
