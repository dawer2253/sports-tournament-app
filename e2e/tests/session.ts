import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ADMIN_URL, AUTH_FILE, TOKEN_KEY } from './env';

interface StorageState {
  cookies: [];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/**
 * Zapisuje sesję organizera jako `storageState` Playwrighta. Panel trzyma token
 * Bearer w `localStorage`, a `storageState` go obejmuje, więc przeglądarka
 * startuje zalogowana. `request.storageState()` tu nie pomoże — zbiera
 * ciasteczka, a Sanctum w trybie tokenowym żadnych nie stawia.
 */
export async function saveSession(token: string): Promise<void> {
  const state: StorageState = {
    cookies: [],
    origins: [{ origin: ADMIN_URL, localStorage: [{ name: TOKEN_KEY, value: token }] }],
  };
  await mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await writeFile(AUTH_FILE, JSON.stringify(state));
}

/** Token z sesji zapisanej przez `saveSession`, dla klienta API w fixture'ach. */
export async function readToken(): Promise<string> {
  const state = JSON.parse(await readFile(AUTH_FILE, 'utf8')) as StorageState;
  const token = state.origins[0]?.localStorage.find((item) => item.name === TOKEN_KEY)?.value;
  if (!token) throw new Error(`Brak tokenu w ${AUTH_FILE} — czy przeszedł projekt setup?`);
  return token;
}
