import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Miejsce w nagłówku shella, do którego sekcja wstawia swoje akcje.
 *
 * Shell stoi w trasie-rodzicu turnieju, a nie w ekranie sekcji (#263), więc
 * przyciski nie mogą iść zwykłym propsem `actions`: powstają w sekcji, a shell
 * rysuje je wcześniej. Sekcja oddaje je portalem do węzła z nagłówka, więc
 * zmiana trasy wymienia tylko treść portalu — sidebar i nagłówek zostają
 * zamontowane.
 *
 * `null` znaczy „nie ma gdzie wstawić”: ekran poza trasą turnieju albo
 * opakowanie w Storybooku. Wtedy `SectionActions` nie rysuje nic.
 */
export const SectionActionsSlot = createContext<HTMLElement | null>(null);

/** Akcje nagłówka dla bieżącej sekcji turnieju. */
export function SectionActions({ children }: { children?: ReactNode }) {
  const slot = useContext(SectionActionsSlot);
  return slot ? createPortal(children, slot) : null;
}
