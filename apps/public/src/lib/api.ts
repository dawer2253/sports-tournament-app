import { createApiClient } from '@tournament/api-client';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:4010';

/** Strona publiczna nie zna tokenu: wszystkie jej endpointy są bez autoryzacji. */
export const api = createApiClient({ baseUrl });

export const POLL_INTERVAL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 15_000);
