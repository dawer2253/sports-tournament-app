import { SOCIAL_GRAPHIC_SCALE } from '@tournament/ui/public';
import { domToBlob } from 'modern-screenshot';

/*
  Plik grafiki (#321, #333): PNG renderowany w przeglądarce panelu z węzła
  szablonu, w skali `SOCIAL_GRAPHIC_SCALE` (1440 × 1800 albo 1440 × 2560).
  Osobny moduł, żeby testy ekranu podmieniały render: jsdom nie rysuje.
*/

/**
 * PNG z węzła grafiki jako `File` (`image/png`, rozszerzenie `.png`, #321
 * §6.2). Czeka na kroje: bez Barlow PNG wyszedłby krojem zapasowym (#324).
 */
export async function renderGraphicFile(node: HTMLElement, name: string): Promise<File> {
  await document.fonts?.ready;
  const blob = await domToBlob(node, { scale: SOCIAL_GRAPHIC_SCALE, type: 'image/png' });
  return new File([blob], name, { type: 'image/png' });
}

/** Czy przeglądarka udostępnia pliki PNG systemowym arkuszem (Web Share z plikiem). */
export function canSharePng(): boolean {
  if (typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], 'grafika.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/** Pobranie pliku pod jego nazwą. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  // Przeglądarka czyta adres przy kliknięciu; zwalniamy go po chwili, nie od razu.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
