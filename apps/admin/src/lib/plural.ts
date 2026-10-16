/**
 * Odmiana i wspólne liczebniki idą z design systemu, żeby reguła miała jedno
 * źródło (`packages/ui/src/lib/plural.ts`); tu zostają tylko zestawy zdań,
 * których używa panel.
 */
export { GROUPS, MATCHES, TEAMS, plural } from '@tournament/ui';

/** Mecze `scheduled` w oknach usuwania drużyny i obiektu (#171). */
export const SCHEDULED_MATCHES = ['zaplanowany mecz', 'zaplanowane mecze', 'zaplanowanych meczów'] as const;

/** Kolejki w opisie opcji generowania: „19 kolejek” (#174). */
export const ROUNDS = ['kolejka', 'kolejki', 'kolejek'] as const;

/** Kolejki w toaście po generowaniu: „Wygenerowano 1 kolejkę” (#174). */
export const ROUNDS_ACCUSATIVE = ['kolejkę', 'kolejki', 'kolejek'] as const;

/** Rundy drabinki w toaście po generowaniu: „Wygenerowano drabinkę: 3 rundy” (#227). */
export const BRACKET_ROUNDS_ACCUSATIVE = ['rundę', 'rundy', 'rund'] as const;

/** Kolizje w toaście rozkładu dat: „2 kolizje”, „5 kolizji” (#175). */
export const COLLISIONS = ['kolizja', 'kolizje', 'kolizji'] as const;

/** Pusty stan terminarza: „2 drużyny grają każdy z każdym” (#174). */
export const TEAMS_PLAYING = ['drużyna gra', 'drużyny grają', 'drużyn gra'] as const;

/** Podgląd kolejności przy tabeli: „2 drużyny zmieniają miejsce” (#173). */
/** Orzeczenie przed liczbą wychodzących z grupy: „wychodzą 2 drużyny”. */
export const QUALIFY = ['wychodzi', 'wychodzą', 'wychodzi'] as const;

export const TEAMS_CHANGING_PLACE = ['drużyna zmienia', 'drużyny zmieniają', 'drużyn zmienia'] as const;
