import type { Group } from '@tournament/api-client';
import { cn } from '@tournament/ui';

/**
 * Chipy filtra grup nad kolejką fazy grupowej (#258). „Wszystkie grupy" gasi
 * filtr, pojedynczy chip zwęża kolejkę do meczów jednej grupy.
 */
export function GroupFilterChips({
  groups,
  value,
  onChange,
}: {
  groups: Group[];
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const chip = (active: boolean) =>
    cn(
      'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors',
      active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
    );

  return (
    <div role="group" aria-label="Filtr grup" className="flex flex-wrap gap-1.5">
      <button type="button" aria-pressed={value === null} className={chip(value === null)} onClick={() => onChange(null)}>
        Wszystkie grupy
      </button>
      {groups.map((group) => (
        <button
          key={group.id}
          type="button"
          aria-pressed={value === group.id}
          className={chip(value === group.id)}
          onClick={() => onChange(group.id)}
        >
          {group.name}
        </button>
      ))}
    </div>
  );
}
