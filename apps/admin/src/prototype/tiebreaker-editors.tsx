// PROTOTYP (#163) — trzy edytory kryteriów rozstrzygających. Nie do main.
//
// Wspólna reguła z kontraktu: `points` zawsze pierwsze i zawsze włączone,
// reszta to dowolny podzbiór `availableTiebreakers` w dowolnej kolejności.
//
// - `ButtonsEditor` (A): lista z przyciskami ↑/↓ i przełącznikiem, bez biblioteki.
// - `DragEditor` (B): przeciąganie `@dnd-kit/core` + `sortable` (linia „legacy”,
//   jak blok shadcn `dashboard-01`), klawiatura przez `KeyboardSensor`.
// - `ChipsEditor` (C): zdanie z chipów nad tabelą, ‹ › przesuwają, × wyłącza,
//   „+ kryterium” dokłada na koniec.
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Switch,
  cn,
} from '@tournament/ui';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, Lock, Plus, X } from 'lucide-react';
import type { TiebreakerCode } from './standings-data';
import type { Labels } from './standings-table';

export type EditorProps = {
  value: TiebreakerCode[];
  onChange: (next: TiebreakerCode[]) => void;
  available: TiebreakerCode[];
  labels: Labels;
  disabled?: boolean;
};

const unused = (value: TiebreakerCode[], available: TiebreakerCode[]) => available.filter((c) => !value.includes(c));
const move = (value: TiebreakerCode[], from: number, to: number) => arrayMove(value, from, to);

function PinnedPoints({ labels }: { labels: Labels }) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 p-2.5">
      <span className="grid size-6 place-items-center rounded bg-muted text-xs font-medium tabular-nums">1</span>
      <span className="flex-1 text-sm font-medium">{labels.points}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" /> zawsze pierwsze
      </span>
    </li>
  );
}

function NameFooter() {
  return (
    <li className="flex items-center gap-3 px-2.5 text-xs text-muted-foreground">
      <span className="grid size-6 place-items-center">·</span>
      Na końcu zawsze nazwa drużyny, alfabetycznie.
    </li>
  );
}

// ---------------------------------------------------------------- A: przyciski

export function ButtonsEditor({ value, onChange, available, labels, disabled }: EditorProps) {
  const rest = value.slice(1);
  const off = unused(value, available);
  return (
    <div data-proto-keys className="grid gap-3">
      <ol className="grid gap-2">
        <PinnedPoints labels={labels} />
        {rest.map((code, i) => {
          const index = i + 1;
          return (
            <li key={code} className="flex items-center gap-3 rounded-md border border-border p-2.5">
              <span className="grid size-6 place-items-center rounded bg-muted text-xs font-medium tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{labels[code]}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Przesuń „${labels[code]}” wyżej`}
                disabled={disabled || index === 1}
                onClick={() => onChange(move(value, index, index - 1))}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Przesuń „${labels[code]}” niżej`}
                disabled={disabled || index === value.length - 1}
                onClick={() => onChange(move(value, index, index + 1))}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Switch
                checked
                disabled={disabled}
                aria-label={`Używaj kryterium „${labels[code]}”`}
                onCheckedChange={() => onChange(value.filter((c) => c !== code))}
              />
            </li>
          );
        })}
        <NameFooter />
      </ol>
      {off.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Nieużywane</p>
          <ul className="grid gap-2">
            {off.map((code) => (
              <li
                key={code}
                className="flex items-center gap-3 rounded-md border border-border p-2.5 text-muted-foreground"
              >
                <span className="size-6" />
                <span className="flex-1 text-sm">{labels[code]}</span>
                <Switch
                  checked={false}
                  disabled={disabled}
                  aria-label={`Używaj kryterium „${labels[code]}”`}
                  onCheckedChange={() => onChange([...value, code])}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- B: przeciąganie

function SortableItem({
  code,
  index,
  labels,
  onRemove,
  disabled,
}: {
  code: TiebreakerCode;
  index: number;
  labels: Labels;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: code,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-card p-2',
        isDragging && 'relative z-10 shadow-lg ring-2 ring-primary',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Przeciągnij „${labels[code]}”`}
        className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="grid size-6 place-items-center rounded bg-muted text-xs font-medium tabular-nums">
        {index + 1}
      </span>
      <span className="flex-1 text-sm font-medium">{labels[code]}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Wyłącz „${labels[code]}”`}
        disabled={disabled}
        onClick={onRemove}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}

export function DragEditor({ value, onChange, available, labels, disabled }: EditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const rest = value.slice(1);
  const off = unused(value, available);
  const name = (id: unknown) => labels[id as TiebreakerCode];
  const pos = (id: unknown) => value.indexOf(id as TiebreakerCode) + 1;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onChange(move(value, value.indexOf(active.id as TiebreakerCode), value.indexOf(over.id as TiebreakerCode)));
  }

  return (
    <div data-proto-keys className="grid gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Spacja lub Enter podnosi kryterium. Strzałki w górę i w dół przesuwają je, Spacja lub Enter upuszcza, Escape anuluje.',
          },
          announcements: {
            onDragStart: ({ active }) => `Podniesiono „${name(active.id)}”, pozycja ${pos(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over ? `„${name(active.id)}” nad pozycją ${pos(over.id)}.` : `„${name(active.id)}” poza listą.`,
            onDragEnd: ({ active, over }) =>
              over ? `Upuszczono „${name(active.id)}” na pozycji ${pos(over.id)}.` : `Upuszczono „${name(active.id)}”.`,
            onDragCancel: ({ active }) => `Anulowano. „${name(active.id)}” wraca na pozycję ${pos(active.id)}.`,
          },
        }}
      >
        <ol className="grid gap-2">
          <PinnedPoints labels={labels} />
          <SortableContext items={rest} strategy={verticalListSortingStrategy}>
            {rest.map((code, i) => (
              <SortableItem
                key={code}
                code={code}
                index={i + 1}
                labels={labels}
                disabled={disabled}
                onRemove={() => onChange(value.filter((c) => c !== code))}
              />
            ))}
          </SortableContext>
          <NameFooter />
        </ol>
      </DndContext>
      {off.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Dodaj:</span>
          {off.map((code) => (
            <Button
              key={code}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onChange([...value, code])}
            >
              <Plus className="size-3" /> {labels[code]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- C: chipy

export function ChipsEditor({ value, onChange, available, labels, disabled }: EditorProps) {
  const off = unused(value, available);
  return (
    <div data-proto-keys className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="mr-1 text-muted-foreground">Kolejność:</span>
      {value.map((code, index) => (
        <span key={code} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-muted-foreground">→</span>}
          <span
            className={cn(
              'inline-flex items-center rounded-full border border-border bg-card py-0.5 pl-1 pr-1',
              index === 0 && 'bg-muted pl-2.5',
            )}
          >
            {index > 1 && (
              <button
                type="button"
                disabled={disabled}
                aria-label={`Przesuń „${labels[code]}” wcześniej`}
                onClick={() => onChange(move(value, index, index - 1))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
              </button>
            )}
            <span className={cn('px-1', index === 1 && 'pl-2')}>{labels[code]}</span>
            {index > 0 && index < value.length - 1 && (
              <button
                type="button"
                disabled={disabled}
                aria-label={`Przesuń „${labels[code]}” później`}
                onClick={() => onChange(move(value, index, index + 1))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <ChevronRight className="size-3.5" />
              </button>
            )}
            {index > 0 ? (
              <button
                type="button"
                disabled={disabled}
                aria-label={`Wyłącz „${labels[code]}”`}
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <Lock className="mr-1.5 ml-0.5 size-3 text-muted-foreground" aria-label="zawsze pierwsze" />
            )}
          </span>
        </span>
      ))}
      <span className="text-muted-foreground">→ nazwa drużyny</span>
      {off.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" disabled={disabled}>
              <Plus className="size-3.5" /> kryterium
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {off.map((code) => (
              <DropdownMenuItem key={code} onSelect={() => onChange([...value, code])}>
                {labels[code]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
