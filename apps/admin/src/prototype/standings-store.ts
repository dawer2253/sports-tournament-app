// PROTOTYP (#163) — stan w pamięci i zaślepka `PATCH /tournaments/{id}` dla
// `tiebreakers`. Mock kontraktu (Prism) nie pamięta zapisów, więc zapisane
// kryteria trzyma ten moduł, osobno dla każdego sportu. Walidacja odwzorowuje
// opis `TournamentUpdate.tiebreakers` w `openapi.yaml`. Nie do main.
import { useSyncExternalStore } from 'react';
import { FIXTURES, type SportCode, type TiebreakerCode } from './standings-data';

type State = {
  sport: SportCode;
  saved: Record<SportCode, TiebreakerCode[]>;
  /** Pokazuj przy wierszu, które kryterium rozdzieliło go od wyższego. */
  showSeparators: boolean;
  failNext: boolean;
  latencyMs: number;
  log: string[];
};

let state: State = {
  sport: 'football',
  saved: { football: FIXTURES.football.defaultTiebreakers, basketball: FIXTURES.basketball.defaultTiebreakers },
  showSeparators: false,
  failNext: false,
  latencyMs: 600,
  log: [],
};

const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function log(line: string) {
  set({ log: [`${new Date().toLocaleTimeString()} ${line}`, ...state.log].slice(0, 6) });
}

export function useProto() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

export const sim = {
  setSport(sport: SportCode) {
    set({ sport });
  },
  toggle(key: 'showSeparators' | 'failNext') {
    set({ [key]: !state[key] } as Partial<State>);
  },
  reset() {
    set({
      saved: { football: FIXTURES.football.defaultTiebreakers, basketball: FIXTURES.basketball.defaultTiebreakers },
    });
    log('reset kryteriów do domyślnych sportu');
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SaveError extends Error {}

/** Zaślepka zapisu: `422` jak w kontrakcie, `500` na żądanie z panelu stanu. */
export async function saveTiebreakers(tiebreakers: TiebreakerCode[]): Promise<void> {
  const label = `PATCH /tournaments/1 {tiebreakers: [${tiebreakers.join(', ')}]}`;
  await sleep(state.latencyMs);
  if (state.failNext) {
    set({ failNext: false });
    log(`${label} → 500`);
    throw new SaveError('Nie udało się zapisać kolejności. Spróbuj ponownie.');
  }
  if (tiebreakers[0] !== 'points') {
    log(`${label} → 422 tiebreakers.0`);
    throw new SaveError('Pierwszym kryterium muszą być punkty.');
  }
  log(`${label} → 200`);
  set({ saved: { ...state.saved, [state.sport]: tiebreakers } });
}
