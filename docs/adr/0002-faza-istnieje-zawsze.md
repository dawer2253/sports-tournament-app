# ADR-0002: Faza (`Stage`) istnieje zawsze, także w zwykłej lidze

Status: przyjęte
Data: 2026-08-24

## Kontekst

Pierwotny model zakładał, że `Stage` ma jeden z dwóch rodzajów: faza grupowa albo
drabinka. Zwykła liga nie jest ani jednym, ani drugim, więc w tym modelu liga
musiałaby obyć się bez fazy, a kolejki wisiałyby bezpośrednio pod turniejem.

Dawało to dwie różne ścieżki odczytu tego samego: inną dla ligi, inną dla
pozostałych formatów.

Drugi problem: `Group` i `Round` wisiały równolegle pod `Stage`, więc kolejka
fazy grupowej obejmowała mecze ze wszystkich grup naraz, a sam mecz nie wiedział,
do której grupy się liczy. Tabelę grupy dało się policzyć tylko przez sprawdzanie,
czy obie drużyny należą do tej grupy, co przestaje działać przy pierwszym meczu
międzygrupowym.

Rozstrzygnięcie było potrzebne przed napisaniem kontraktu, bo dotyczy kształtu
`Match`, czyli bytu wspólnego dla wszystkich trzech wycinków pracy.

## Rozważane warianty

**Odłożyć fazy do czasu prac nad grupami.** Kolejki pod turniejem, `Stage`
dokładany później. Odrzucone: zmieniałoby to kształt `Match` w połowie semestru,
a `Match` jest jedynym bytem, którego dotykają wszystkie trzy wycinki naraz.

**Zostawić model bez zmian i rozstrzygnąć przy grupach.** Odrzucone z tego samego
powodu, dodatkowo bez rozstrzygnięcia nie dało się napisać kontraktu.

**Faza zawsze obecna, z trzecim rodzajem.** Wybrane.

## Decyzja

Turniej ma zawsze co najmniej jedną fazę. `Stage.type` przyjmuje trzy wartości:
`league`, `group`, `knockout`.

`Match` niesie `stageId` oraz nullowalne `groupId`. Mecz należy do dokładnie
jednej grupy albo do żadnej: mecz międzygrupowy nie istnieje.

`format` podawany przy zakładaniu turnieju (`league`, `groups_playoff`,
`knockout`) nie jest polem turnieju. Służy wyłącznie do utworzenia właściwych faz.
Po utworzeniu prawdą o strukturze turnieju są wyłącznie jego fazy.

## Konsekwencje

Kupujemy: jedną ścieżkę odczytu dla wszystkich formatów, stabilny kształt `Match`
od pierwszego dnia, jednoznaczne liczenie tabeli grupowej.

Płacimy: przy zakładaniu zwykłej ligi trzeba utworzyć fazę, której organizer nigdy
nie zobaczy. W interfejsie słowo "faza" nie pojawia się dla lig. Ktoś czytający
bazę zobaczy byt, który dla najprostszego turnieju wygląda na nadmiarowy, i to jest
powód, dla którego ten dokument istnieje.

Zapisane w [`CONTEXT.md`](../../CONTEXT.md) pod hasłami `Stage`, `Group`, `Round`.
