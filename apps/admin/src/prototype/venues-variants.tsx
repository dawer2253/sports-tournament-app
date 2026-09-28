// PROTOTYP (#86) — trzy wzorce edycji listy na ekranie obiektów. Nie do main.
//
// A: dialog na dodawanie i edycję, osobny dialog potwierdzenia usunięcia.
// B: panel boczny (sheet): klik w wiersz otwiera edycję, usuwanie w stopce panelu.
// C: edycja w wierszu tabeli, dodawanie pustym wierszem, potwierdzenie w wierszu.
import type { Tournament } from '@tournament/api-client';
import {
  Button, Card, CardContent, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, EmptyState, Input, Label, Sheet, SheetContent,
  SheetDescription, SheetFooter, SheetHeader, SheetTitle, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow, cn,
} from '@tournament/ui';
import { Check, ChevronRight, Loader2, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Toaster } from '@tournament/ui';
import { AdminPage } from '../components/admin-page';
import { applyApiError } from '../lib/form-errors';
import { deleteVenue, saveVenue, seed, sim, useVenuesState, type Venue, type VenueInput } from './venues-store';
import { useEditVariant } from './variant';

const FIELDS = ['name', 'address'] as const;

export function VenuesPrototype({ tournament }: { tournament: Tournament }) {
  const variant = useEditVariant();
  const { venues } = useVenuesState();
  useEffect(() => void seed(tournament.id), [tournament.id]);
  const [adding, setAdding] = useState(false);

  const add = (
    <Button onClick={() => setAdding(true)}>
      <Plus className="size-4" /> Dodaj obiekt
    </Button>
  );

  const props = { tournament, venues, adding, setAdding };
  return (
    <AdminPage active="dashboard" section="venues" tournament={tournament} title="Obiekty" subtitle={tournament.name} actions={add}>
      {variant === 'A' && <VariantA {...props} />}
      {variant === 'B' && <VariantB {...props} />}
      {variant === 'C' && <VariantC {...props} />}
      <StatePanel />
      <Toaster position="top-center" richColors />
    </AdminPage>
  );
}

type VariantProps = {
  tournament: Tournament;
  venues: Venue[];
  adding: boolean;
  setAdding: (v: boolean) => void;
};

// ---------------------------------------------------------------- wspólny formularz

function useVenueForm(venue: Venue | null) {
  return useForm<VenueInput>({ defaultValues: { name: venue?.name ?? '', address: venue?.address ?? '' } });
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;
}

function RootError({ message }: { message?: string }) {
  return message ? (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </div>
  ) : null;
}

function VenueFields({ form }: { form: ReturnType<typeof useVenueForm> }) {
  const { register, formState } = form;
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="venue-name">Nazwa</Label>
        <Input id="venue-name" autoFocus aria-invalid={!!formState.errors.name} {...register('name')} className="mt-1.5" />
        <FieldError message={formState.errors.name?.message} />
      </div>
      <div>
        <Label htmlFor="venue-address">Adres (opcjonalnie)</Label>
        <Input id="venue-address" aria-invalid={!!formState.errors.address} {...register('address')} className="mt-1.5" />
        <FieldError message={formState.errors.address?.message} />
      </div>
    </div>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      title="Nie ma jeszcze obiektów"
      description="Dodaj boiska i hale, na których odbywają się mecze."
      action={<Button onClick={onAdd}><Plus className="size-4" /> Dodaj obiekt</Button>}
    />
  );
}

// ---------------------------------------------------------------- A: dialog

function VariantA({ tournament, venues, adding, setAdding }: VariantProps) {
  const [editing, setEditing] = useState<Venue | null>(null);
  const [deleting, setDeleting] = useState<Venue | null>(null);
  return (
    <Card>
      <CardContent className="p-0">
        {venues.length === 0 ? (
          <Empty onAdd={() => setAdding(true)} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nazwa</TableHead>
                <TableHead>Adres</TableHead>
                <TableHead className="w-24 pr-6 text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {venues.map((v) => (
                <TableRow key={v.id} className={cn(v.id < 0 && 'opacity-50')}>
                  <TableCell className="pl-6 font-medium">{v.name}</TableCell>
                  <TableCell className="text-muted-foreground">{v.address ?? '—'}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edytuj ${v.name}`} onClick={() => setEditing(v)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Usuń ${v.name}`} onClick={() => setDeleting(v)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {(adding || editing) && (
        <FormDialog
          key={editing?.id ?? 'new'}
          tournament={tournament}
          venue={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
      {deleting && <DeleteDialog venue={deleting} onClose={() => setDeleting(null)} />}
    </Card>
  );
}

function FormDialog({ tournament, venue, onClose }: { tournament: Tournament; venue: Venue | null; onClose: () => void }) {
  const form = useVenueForm(venue);
  const submit = form.handleSubmit((input) =>
    saveVenue({ input, id: venue?.id ?? null, tournamentId: tournament.id, close: onClose, onError: (e) => applyApiError(e, FIELDS, form.setError) }),
  );
  return (
    <Dialog open onOpenChange={(o) => !o && !form.formState.isSubmitting && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{venue ? 'Edytuj obiekt' : 'Nowy obiekt'}</DialogTitle>
            <DialogDescription>Miejsce rozgrywania meczów w turnieju.</DialogDescription>
          </DialogHeader>
          <RootError message={form.formState.errors.root?.message} />
          <VenueFields form={form} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>Anuluj</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {venue ? 'Zapisz' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; blocked: boolean } | null>(null);
  async function confirm() {
    setPending(true);
    await deleteVenue({
      venue,
      close: onClose,
      onError: (e) => setError({ message: e.message, blocked: !!e.errors?.id }),
    });
    setPending(false);
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usunąć obiekt „{venue.name}”?</DialogTitle>
          <DialogDescription>Obiekt zniknie z listy i z wyboru przy meczach.</DialogDescription>
        </DialogHeader>
        <RootError message={error?.message} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>{error?.blocked ? 'Zamknij' : 'Anuluj'}</Button>
          {!error?.blocked && (
            <Button variant="destructive" onClick={() => void confirm()} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Usuń obiekt
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- B: sheet

function VariantB({ tournament, venues, adding, setAdding }: VariantProps) {
  const [editing, setEditing] = useState<Venue | null>(null);
  const open = adding || !!editing;
  const close = () => {
    setAdding(false);
    setEditing(null);
  };
  return (
    <>
      {venues.length === 0 ? (
        <Card><CardContent><Empty onAdd={() => setAdding(true)} /></CardContent></Card>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {venues.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setEditing(v)}
                disabled={v.id < 0}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 disabled:opacity-50"
              >
                <MapPin className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{v.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">{v.address ?? 'Bez adresu'}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={open} onOpenChange={(o) => !o && close()}>
        <SheetContent className="flex flex-col">
          {open && <SheetBody key={editing?.id ?? 'new'} tournament={tournament} venue={editing} onClose={close} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function SheetBody({ tournament, venue, onClose }: { tournament: Tournament; venue: Venue | null; onClose: () => void }) {
  const form = useVenueForm(venue);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<{ message: string; blocked: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const submit = form.handleSubmit((input) =>
    saveVenue({ input, id: venue?.id ?? null, tournamentId: tournament.id, close: onClose, onError: (e) => applyApiError(e, FIELDS, form.setError) }),
  );
  async function remove() {
    if (!venue) return;
    setDeleting(true);
    await deleteVenue({ venue, close: onClose, onError: (e) => setDeleteError({ message: e.message, blocked: !!e.errors?.id }) });
    setDeleting(false);
  }
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col">
      <SheetHeader>
        <SheetTitle>{venue ? venue.name : 'Nowy obiekt'}</SheetTitle>
        <SheetDescription>Miejsce rozgrywania meczów w turnieju.</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-4 px-4">
        <RootError message={form.formState.errors.root?.message} />
        <VenueFields form={form} />
      </div>
      {venue && (
        <div className="mx-4 mb-2 rounded-md border border-destructive/30 p-3">
          {!confirming ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
              <Trash2 className="size-4" /> Usuń obiekt
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">Usunąć „{venue.name}”? Obiekt zniknie z wyboru przy meczach.</p>
              <RootError message={deleteError?.message} />
              {!deleteError?.blocked && (
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" size="sm" onClick={() => void remove()} disabled={deleting}>
                    {deleting && <Loader2 className="size-4 animate-spin" />} Tak, usuń
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>Nie</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <SheetFooter>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {venue ? 'Zapisz zmiany' : 'Dodaj obiekt'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
      </SheetFooter>
    </form>
  );
}

// ---------------------------------------------------------------- C: w wierszu

function VariantC({ tournament, venues, adding, setAdding }: VariantProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Nazwa</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead className="w-28 pr-6 text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adding && <EditRow tournament={tournament} venue={null} onClose={() => setAdding(false)} />}
            {venues.map((v) =>
              editingId === v.id ? (
                <EditRow key={v.id} tournament={tournament} venue={v} onClose={() => setEditingId(null)} />
              ) : deletingId === v.id ? (
                <DeleteRow key={v.id} venue={v} onClose={() => setDeletingId(null)} />
              ) : (
                <TableRow key={v.id} className={cn(v.id < 0 && 'opacity-50')} onDoubleClick={() => setEditingId(v.id)}>
                  <TableCell className="pl-6 font-medium">{v.name}</TableCell>
                  <TableCell className="text-muted-foreground">{v.address ?? '—'}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button variant="ghost" size="icon" aria-label={`Edytuj ${v.name}`} onClick={() => setEditingId(v.id)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Usuń ${v.name}`} onClick={() => setDeletingId(v.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ),
            )}
            {venues.length === 0 && !adding && (
              <TableRow>
                <TableCell colSpan={3}><Empty onAdd={() => setAdding(true)} /></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EditRow({ tournament, venue, onClose }: { tournament: Tournament; venue: Venue | null; onClose: () => void }) {
  const form = useVenueForm(venue);
  const { register, formState } = form;
  const submit = form.handleSubmit((input) =>
    saveVenue({ input, id: venue?.id ?? null, tournamentId: tournament.id, close: onClose, onError: (e) => applyApiError(e, FIELDS, form.setError) }),
  );
  return (
    <TableRow className="bg-muted/40 align-top" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <TableCell className="pl-6">
        <form id={`row-${venue?.id ?? 'new'}`} onSubmit={submit} />
        <Input form={`row-${venue?.id ?? 'new'}`} autoFocus placeholder="Nazwa" aria-label="Nazwa" aria-invalid={!!formState.errors.name} {...register('name')} />
        <FieldError message={formState.errors.name?.message} />
        <FieldError message={formState.errors.root?.message} />
      </TableCell>
      <TableCell>
        <Input form={`row-${venue?.id ?? 'new'}`} placeholder="Adres (opcjonalnie)" aria-label="Adres" aria-invalid={!!formState.errors.address} {...register('address')} />
        <FieldError message={formState.errors.address?.message} />
      </TableCell>
      <TableCell className="pr-6 text-right">
        <Button type="submit" form={`row-${venue?.id ?? 'new'}`} variant="ghost" size="icon" aria-label="Zapisz" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-primary" />}
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Anuluj" onClick={onClose} disabled={formState.isSubmitting}>
          <X className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function DeleteRow({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; blocked: boolean } | null>(null);
  async function confirm() {
    setPending(true);
    await deleteVenue({ venue, close: onClose, onError: (e) => setError({ message: e.message, blocked: !!e.errors?.id }) });
    setPending(false);
  }
  return (
    <TableRow className="bg-destructive/5">
      <TableCell colSpan={2} className="pl-6 text-sm">
        {error ? <span className="text-destructive">{error.message}</span> : <>Usunąć „{venue.name}”?</>}
      </TableCell>
      <TableCell className="pr-6 text-right whitespace-nowrap">
        {!error?.blocked && (
          <Button variant="destructive" size="sm" onClick={() => void confirm()} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />} Usuń
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>{error?.blocked ? 'Zamknij' : 'Anuluj'}</Button>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------- panel stanu

function StatePanel() {
  const s = useVenuesState();
  return (
    <aside className="fixed bottom-24 right-4 z-40 w-80 rounded-xl bg-zinc-900 p-3 font-mono text-[11px] text-zinc-100 shadow-2xl ring-2 ring-fuchsia-500">
      <div className="mb-2 font-sans text-xs font-semibold">PROTOTYP · stan i symulacja</div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={s.optimistic} onChange={() => sim.toggle('optimistic')} /> zapis optymistyczny
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={s.guardOnDelete} onChange={() => sim.toggle('guardOnDelete')} /> DELETE → 422 (guard)
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={s.failNext} onChange={() => sim.toggle('failNext')} /> następne żądanie → 500
      </label>
      <div className="mt-2 text-zinc-400">obiekty ({s.venues.length}):</div>
      {s.venues.map((v) => (
        <div key={v.id} className={cn(v.id < 0 && 'text-amber-300')}>
          {v.id < 0 ? 'tmp' : `#${v.id}`} {v.name}
        </div>
      ))}
      <div className="mt-2 text-zinc-400">żądania:</div>
      {s.log.length === 0 ? <div>—</div> : s.log.map((l, i) => <div key={i}>{l}</div>)}
    </aside>
  );
}
