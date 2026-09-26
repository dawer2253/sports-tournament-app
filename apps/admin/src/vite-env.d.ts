/** Zmienne `VITE_*`, które czyta aplikacja. Bez tej deklaracji `vite/client` daje im typ `any`. */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
