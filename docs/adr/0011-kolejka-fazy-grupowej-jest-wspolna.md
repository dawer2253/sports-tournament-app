# ADR-0011: Kolejka fazy grupowej jest wspólna dla wszystkich grup

Status: przyjęte
Data: 2026-10-16

## Kontekst

Faza `group` ma kilka grup, a każda gra „każdy z każdym” w swoim gronie.
Trzeba było rozstrzygnąć, do czego należy kolejka (`Round`): do fazy czy do
grupy.

Schemat z [ADR-0002](0002-faza-istnieje-zawsze.md) wiesza `Round` pod `Stage`
(`rounds.stage_id`, unikat `stage_id, order`, bez `group_id`), a grupę niesie
mecz (`matches.group_id`). ADR-0002 nie rozstrzygał jednak, jak terminarz
grup ma się w ten schemat układać.

Research [#248](https://github.com/dawer2253/sports-tournament-app/issues/248)
([`docs/research/grupy-i-przydzial-druzyn.md`](../research/grupy-i-przydzial-druzyn.md),
§4.1) pokazał, że we wszystkich zbadanych modelach danych kolejka należy do
grupy: Toornament, brackets-model i start.gg. Wspólnej „Kolejki 1” dla
wszystkich grup nie opisuje żadne źródło.

## Decyzja

Kolejka należy do fazy także w fazie `group`. „Kolejka k” zawiera mecze k-tej
kolejki każdej grupy. Przy nierównych grupach ostatnie kolejki mają mecze
tylko większych grup: grupa 5 drużyn ma 5 kolejek, grupa 4 drużyn 3.
W kolejce najpierw idą mecze pierwszej grupy, potem drugiej, a wewnątrz grupy
obowiązuje kolejność Bergera.

Rozstrzygnięte w grillingu
[#249](https://github.com/dawer2253/sports-tournament-app/issues/249).

## Uzasadnienie

- Amatorski turniej grupowy gra „dzień meczowy” wszystkich grup naraz. Jedna
  data na kolejkę to dokładnie to, co już robi `schedule/dates` w trybie
  `interval`.
- Bez zmian zostają schemat `rounds`, `DateDistributor`, kształt
  `Match.round` w kontrakcie i grupowanie po `round.id` na stronie publicznej.
- Widok jednej grupy to filtr po `Match.groupId`, więc kolejka per grupa nic by
  tu nie dodała.

Odrzucona kolejka per grupa (`rounds.group_id`, unikat
`stage_id, group_id, order`). Wymagałaby zmiany hasła `Round` w `CONTEXT.md`,
reguły dat dla kilku „Kolejek 1” jednej fazy i rozróżnienia ich na listach
meczów.

## Konsekwencje

Gdy grupy mają grać w różnych terminach (np. grupa A w soboty, B w niedziele),
daty ustawia się per mecz albo trybem `continuous`. Kolejka nie ma własnej daty
w żadnym z dwóch modeli, więc nie tracimy niczego, co dziś istnieje.

Gdyby kiedyś grupa miała mieć własną numerację kolejek albo własny rytm dat,
trzeba będzie dodać `rounds.group_id` i przepisać generator, rozkład dat
i grupowanie na listach.
