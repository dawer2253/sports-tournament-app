// PROTOTYP (#86) — lista obiektów w pamięci i zaślepka API z opóźnieniem.
// Mock kontraktu (Prism) nie pamięta zapisów, więc zapisy idą tutaj. Reguły
// 422 odwzorowują #80 (unikalna nazwa bez względu na wielkość liter) i guard
// usuwania (#83, `422` pod `id`). Nie do main.
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';

export type Venue = { id: number; tournamentId: number; name: string; address: string | null };
export type VenueInput = { name: string; address: string };
type ApiErr = { message: string; errors?: Record<string, string[]> };

type State = {
  venues: Venue[];
  seededFor: number | null;
  log: string[];
  optimistic: boolean;
  guardOnDelete: boolean;
  failNext: boolean;
  latencyMs: number;
};

let state: State = {
  venues: [],
  seededFor: null,
  log: [],
  optimistic: false,
  guardOnDelete: false,
  failNext: false,
  latencyMs: 700,
};
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function log(line: string) {
  set({ log: [`${new Date().toLocaleTimeString()} ${line}`, ...state.log].slice(0, 8) });
}

export function useVenuesState() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}
export const sim = {
  toggle(key: 'optimistic' | 'guardOnDelete' | 'failNext') {
    set({ [key]: !state[key] } as Partial<State>);
  },
};

export async function seed(tournamentId: number) {
  if (state.seededFor === tournamentId) return;
  set({ seededFor: tournamentId });
  const { data } = await api.GET('/tournaments/{tournament}/venues', {
    params: { path: { tournament: tournamentId } },
  });
  set({ venues: data?.data ?? [] });
  log(`GET /tournaments/${tournamentId}/venues → 200 (mock)`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Zaślepka POST/PATCH: 422 jak w backendzie, 500 na żądanie. */
async function fakeSave(input: VenueInput, id: number | null, tournamentId: number): Promise<Venue> {
  await sleep(state.latencyMs);
  const label = id ? `PATCH /venues/${id}` : `POST /tournaments/${tournamentId}/venues`;
  if (state.failNext) {
    set({ failNext: false });
    log(`${label} → 500`);
    throw { message: 'Serwer nie odpowiada. Spróbuj ponownie.' } satisfies ApiErr;
  }
  const name = input.name.trim();
  const address = input.address.trim() || null;
  const errors: Record<string, string[]> = {};
  if (!name) errors.name = ['Pole nazwa jest wymagane.'];
  else if (name.length > 120) errors.name = ['Nazwa może mieć najwyżej 120 znaków.'];
  else if (state.venues.some((v) => v.id !== id && v.id > 0 && v.name.toLocaleLowerCase('pl') === name.toLocaleLowerCase('pl')))
    errors.name = ['W tym turnieju jest już obiekt o tej nazwie.'];
  if (address && address.length > 255) errors.address = ['Adres może mieć najwyżej 255 znaków.'];
  if (Object.keys(errors).length) {
    log(`${label} → 422 ${Object.keys(errors).join(', ')}`);
    throw { message: Object.values(errors)[0][0], errors } satisfies ApiErr;
  }
  log(`${label} → ${id ? 200 : 201}`);
  return { id: id ?? Math.max(0, ...state.venues.map((v) => v.id)) + 1, tournamentId, name, address };
}

async function fakeDelete(venue: Venue): Promise<void> {
  await sleep(state.latencyMs);
  if (state.failNext) {
    set({ failNext: false });
    log(`DELETE /venues/${venue.id} → 500`);
    throw { message: 'Serwer nie odpowiada. Spróbuj ponownie.' } satisfies ApiErr;
  }
  if (state.guardOnDelete) {
    const msg = `Nie można usunąć: obiekt „${venue.name}” ma powiązane rozegrane mecze.`;
    log(`DELETE /venues/${venue.id} → 422 id`);
    throw { message: msg, errors: { id: [msg] } } satisfies ApiErr;
  }
  log(`DELETE /venues/${venue.id} → 204`);
}

const byName = (a: Venue, b: Venue) => a.name.localeCompare(b.name, 'pl') || a.id - b.id;

/**
 * Zapis w jednym z dwóch trybów, przełączanych w panelu stanu:
 * - po odpowiedzi: formularz czeka, 422 siada przy polu, dopiero sukces zamyka;
 * - optymistycznie: formularz zamyka się od razu, porażka cofa zmianę i idzie toastem.
 */
export async function saveVenue(opts: {
  input: VenueInput;
  id: number | null;
  tournamentId: number;
  close: () => void;
  onError: (error: ApiErr) => void;
}) {
  const { input, id, tournamentId, close, onError } = opts;
  if (!state.optimistic) {
    try {
      const saved = await fakeSave(input, id, tournamentId);
      set({ venues: [...state.venues.filter((v) => v.id !== saved.id), saved].sort(byName) });
      toast.success(id ? 'Zapisano zmiany.' : `Dodano obiekt „${saved.name}”.`);
      close();
    } catch (e) {
      onError(e as ApiErr);
    }
    return;
  }
  const before = state.venues;
  const tempId = id ?? -Date.now();
  const draft: Venue = { id: tempId, tournamentId, name: input.name.trim(), address: input.address.trim() || null };
  set({ venues: [...before.filter((v) => v.id !== tempId), draft].sort(byName) });
  close();
  try {
    const saved = await fakeSave(input, id, tournamentId);
    set({ venues: [...state.venues.filter((v) => v.id !== tempId), saved].sort(byName) });
  } catch (e) {
    set({ venues: before });
    toast.error(`${(e as ApiErr).message} Zmianę cofnięto.`);
  }
}

export async function deleteVenue(opts: { venue: Venue; close: () => void; onError: (error: ApiErr) => void }) {
  const { venue, close, onError } = opts;
  if (!state.optimistic) {
    try {
      await fakeDelete(venue);
      set({ venues: state.venues.filter((v) => v.id !== venue.id) });
      toast.success(`Usunięto obiekt „${venue.name}”.`);
      close();
    } catch (e) {
      onError(e as ApiErr);
    }
    return;
  }
  const before = state.venues;
  set({ venues: before.filter((v) => v.id !== venue.id) });
  close();
  try {
    await fakeDelete(venue);
  } catch (e) {
    set({ venues: before });
    toast.error(`${(e as ApiErr).message} Obiekt wrócił na listę.`);
  }
}
