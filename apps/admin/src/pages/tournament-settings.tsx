import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  firstFieldErrors,
  isValidationError,
  type Sport,
  type Tournament,
  type TournamentStatus,
} from '@tournament/api-client';
import {
  BrandColorPicker,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  ConfirmDeleteDialog,
  EmptyState,
  FormDialog,
  Heading,
  ImageFileField,
  Input,
  isHexColor,
  Label,
  Separator,
  Skeleton,
  TiebreakerList,
  TournamentLogo,
  TournamentStatusCard,
  toast,
} from '@tournament/ui';
import { AlertTriangle, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { SKIP_UNSAVED_GUARD, UnsavedChangesGuard } from '../components/unsaved-changes-guard';
import { api } from '../lib/api';
import { apiErrorMessage, applyApiError } from '../lib/form-errors';
import { LOGO_FILE_HINT, logoFileError, TOURNAMENT_LOGO } from '../lib/logo-file';
import { publicTournamentUrl } from '../lib/public-url';
import {
  tournamentSettingsUpdate,
  tournamentSettingsValues,
  tournamentSettingsSchema,
  type TournamentSettingsValues,
} from '../lib/tournament-settings-schema';
import { useSports } from '../lib/use-sports';
import { useTournament } from './tournament-layout';

/**
 * Ustawienia turnieju (#91, #119). Trzy miejsca zapisu: status od razu
 * z karty, logo w oknie (#120), reszta jednym „Zapisz zmiany" na końcu
 * formularza.
 *
 * `Tournament.sport` to tylko `SportSummary`, więc remisy, punktacja domyślna
 * i etykiety tiebreaków przychodzą z `GET /sports`. Bez nich formularza nie da
 * się złożyć, więc do czasu ich wczytania stoi szkielet — karta statusu nie
 * czeka, bo ich nie potrzebuje.
 */
export function TournamentSettingsPage() {
  const tournament = useTournament();
  const sports = useSports();
  const sport = sports.data?.find((candidate) => candidate.id === tournament.sport.id);

  let form;
  if (sport) {
    form = <SettingsForm tournament={tournament} sport={sport} />;
  } else if (sports.isError || sports.data) {
    // Sport turnieju spoza listy to ten sam kłopot co padnięte żądanie:
    // formularza nie ma z czego złożyć.
    form = (
      <>
        <LogoCard tournament={tournament} color={tournament.branding.primaryColor} />
        <EmptyState
          variant="error"
          icon={<AlertTriangle />}
          title="Nie udało się wczytać ustawień sportu"
          description={sports.error?.message}
          action={
            <Button variant="outline" onClick={() => void sports.refetch()}>
              Spróbuj ponownie
            </Button>
          }
        />
      </>
    );
  } else {
    form = (
      <>
        <LogoCard tournament={tournament} color={tournament.branding.primaryColor} />
        <Skeleton role="status" aria-label="Wczytywanie ustawień" className="h-96 w-full" />
      </>
    );
  }

  return (
    <AdminPage tournament={tournament} section="settings">
      <div className="max-w-2xl space-y-6">
        <StatusSection tournament={tournament} />
        {form}
        <DangerZone tournament={tournament} />
      </div>
    </AdminPage>
  );
}

/**
 * Usuwanie turnieju (#83, #103). Przycisk jest zawsze aktywny: `Tournament`
 * nie mówi, czy rozegrano mecze, więc odmowę (`422`) pokazuje dopiero okno.
 */
function DangerZone({ tournament }: { tournament: Tournament }) {
  const [deleting, setDeleting] = useState(false);

  return (
    <Card className="ring-destructive/40">
      <CardHeader>
        <CardTitle>Strefa zagrożenia</CardTitle>
        <CardDescription>
          Usunięcie turnieju kasuje drużyny, mecze i wyniki. Tego nie da się cofnąć.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setDeleting(true)}>
          <Trash2 className="size-4" /> Usuń turniej
        </Button>
      </CardContent>
      {deleting && <DeleteTournamentDialog tournament={tournament} onClose={() => setDeleting(false)} />}
    </Card>
  );
}

const DELETE_FAILED = 'Nie udało się usunąć turnieju. Spróbuj ponownie.';

/** Odmowa w oknie: `final`, gdy ponowienie nic nie zmieni i przycisk gaśnie. */
type DeleteRefusal = { message: string; final: boolean };

/**
 * Okno potwierdzenia z przepisaniem nazwy. Odpowiedzi (#103):
 *
 * | Odpowiedź           | Skutek                                                  |
 * |---------------------|---------------------------------------------------------|
 * | `2xx`, `404`        | wyjście na listę, toast, odświeżenie listy              |
 * | `422`               | okno zostaje, `message` w alercie, przycisk gaśnie       |
 * | sieć, `5xx`, reszta | okno zostaje, komunikat ogólny, można ponowić           |
 *
 * Nie idzie przez `useListMutation`, bo ten pokazuje przy `422` komunikat pola
 * `id` i chowa przycisk, a przy `403` tekst serwera; ekran usuwania turnieju
 * ma w obu miejscach inne zachowanie.
 *
 * `['tournament', id]` znika z cache'u dopiero po wyjściu z ekranu: wcześniej
 * trasa turnieju dopytałaby o niego od nowa i dostała `404`.
 */
function DeleteTournamentDialog({ tournament, onClose }: { tournament: Tournament; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<DeleteRefusal | null>(null);

  async function leave(message: string) {
    // Niezapisane zmiany w formularzu nie mają już czego dotyczyć.
    await navigate('/', { state: SKIP_UNSAVED_GUARD });
    queryClient.removeQueries({ queryKey: ['tournament', tournament.id], exact: true });
    toast.success(message);
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
  }

  async function remove() {
    setPending(true);
    // Ponowienie zaczyna od czystego okna; nowy błąd wróci z odpowiedzią.
    setRefusal(null);
    try {
      let result;
      try {
        result = await api.DELETE('/tournaments/{tournament}', {
          params: { path: { tournament: tournament.id } },
        });
      } catch (cause) {
        // `fetch` bez odpowiedzi (sieć) odrzuca `TypeError`; inne wyjątki lecą dalej.
        if (cause instanceof TypeError) {
          setRefusal({ message: DELETE_FAILED, final: false });
          return;
        }
        throw cause;
      }

      const { error, response } = result;
      // `404`: ktoś usunął turniej wcześniej, więc cel organizera jest osiągnięty.
      if (response.ok || response.status === 404) {
        await leave(response.ok ? `Usunięto turniej „${tournament.name}”.` : 'Turniej został już usunięty.');
        return;
      }
      if (response.status === 422) {
        setRefusal({ message: apiErrorMessage(error) || DELETE_FAILED, final: true });
        return;
      }
      setRefusal({ message: DELETE_FAILED, final: false });
    } finally {
      setPending(false);
    }
  }

  return (
    <ConfirmDeleteDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() => void remove()}
      entity="turniej"
      name={tournament.name}
      description={
        <>
          Znikną drużyny, zawodnicy, obiekty, mecze i wgrane pliki. Tego nie da się cofnąć. Adres
          /t/{tournament.slug} od razu się zwolni.
        </>
      }
      confirmByName
      confirmDisabled={refusal?.final}
      error={refusal?.message}
      pending={pending}
    />
  );
}

/** Komunikat, gdy API nie przysłało żadnego albo padła sieć lub serwer. */
const STATUS_FAILED = 'Nie udało się zmienić statusu. Spróbuj ponownie.';
const SAVE_FAILED = 'Nie udało się zapisać zmian. Spróbuj ponownie.';

type StatusChange = { from: TournamentStatus; to: TournamentStatus };

function statusToast({ from, to }: StatusChange): string {
  if (to === 'draft') return 'Cofnięto turniej do szkicu.';
  if (to === 'finished') return 'Zakończono turniej.';
  return from === 'draft' ? 'Opublikowano turniej.' : 'Wznowiono turniej.';
}

/**
 * Błąd zmiany statusu do pokazania organizerowi. `422` z serwera niesie powód
 * pod `status` (np. zakończone mecze przy powrocie do szkicu). Wyjątek z
 * `fetch` (sieć) i odpowiedź bez treści dostają komunikat ogólny, bo tekst
 * przeglądarki byłby po angielsku.
 */
function statusErrorMessage(error: unknown): string {
  if (isValidationError(error)) return firstFieldErrors(error).status || error.message;
  if (error instanceof Error) return STATUS_FAILED;
  return apiErrorMessage(error) || STATUS_FAILED;
}

/**
 * Karta statusu: przejście zapisuje się od razu samym `{status}`, bez
 * formularza, więc niezapisane pola zostają, jak były. Powrót do szkicu zdejmuje
 * stronę publiczną, więc najpierw pyta.
 */
function StatusSection({ tournament }: { tournament: Tournament }) {
  const queryClient = useQueryClient();
  const [confirmingDraft, setConfirmingDraft] = useState(false);
  const publicUrl = publicTournamentUrl(tournament.slug);

  const change = useMutation({
    mutationFn: async ({ to }: StatusChange) => {
      const { error, response } = await api.PATCH('/tournaments/{tournament}', {
        params: { path: { tournament: tournament.id } },
        body: { status: to },
      });
      // Po statusie, nie po `error`: odpowiedź błędu bez ciała daje pusty `error`.
      if (!response.ok) throw error || { message: '' };
    },
    onSuccess: async (_, variables) => {
      // Karta pokazuje status z turnieju, więc czeka na odświeżony.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] }),
        queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
      ]);
      setConfirmingDraft(false);
      const message = statusToast(variables);
      if (variables.from === 'draft' && variables.to === 'active') {
        toast.success(message, {
          action: {
            label: 'Otwórz stronę',
            onClick: () => window.open(publicUrl, '_blank', 'noopener,noreferrer'),
          },
        });
      } else {
        toast.success(message);
      }
    },
    // Błąd powrotu do szkicu zostaje w oknie potwierdzenia, reszta idzie toastem.
    onError: (error, variables) => {
      if (variables.to !== 'draft') toast.error(statusErrorMessage(error));
    },
  });

  return (
    <>
      <TournamentStatusCard
        status={tournament.status}
        publicUrl={publicUrl}
        pending={change.isPending}
        onChange={(to) => {
          if (to === 'draft') {
            change.reset();
            setConfirmingDraft(true);
            return;
          }
          change.mutate({ from: tournament.status, to });
        }}
      />
      <FormDialog
        open={confirmingDraft}
        onOpenChange={setConfirmingDraft}
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate({ from: tournament.status, to: 'draft' });
        }}
        title="Cofnąć turniej do szkicu?"
        description={`Strona /t/${tournament.slug} przestanie być widoczna.`}
        submitLabel="Cofnij do szkicu"
        pending={change.isPending}
        error={change.isError ? statusErrorMessage(change.error) : undefined}
      >
        {null}
      </FormDialog>
    </>
  );
}

/**
 * Logo w kolorze z formularza, z wgrywaniem i usuwaniem w oknach (#120). Oba
 * zapisy kładą odpowiedź do `['tournament', id]`, a formularz ustawień bierze
 * z niej tylko pola, których organizer nie ruszył (`keepDirtyValues`).
 *
 * Jak w `ImageWithFallback`: pamiętamy adres, który zawiódł, a nie flagę, więc
 * nowy adres po wgraniu logo zaczyna bez komunikatu.
 */
function LogoCard({ tournament, color }: { tournament: Tournament; color: string }) {
  const { logoUrl } = tournament.branding;
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'upload' | 'delete' | null>(null);
  const close = () => setDialog(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <CardDescription>PNG, JPG lub WebP, do 2 MB, od 64×64 do 4096×4096 px.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <TournamentLogo
          logoUrl={logoUrl}
          color={color}
          onError={() => setFailedLogoUrl(logoUrl)}
          className="size-16"
        />
        <div className="grid gap-2">
          {logoUrl !== null && failedLogoUrl === logoUrl && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AlertTriangle className="size-4" /> Nie udało się wczytać logo
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialog('upload')}>
              <Upload className="size-4" /> {logoUrl ? 'Zmień logo' : 'Wgraj logo'}
            </Button>
            {logoUrl && (
              <Button variant="ghost" onClick={() => setDialog('delete')}>
                <Trash2 className="size-4" /> Usuń logo
              </Button>
            )}
          </div>
        </div>
      </CardContent>
      {/* Okna renderowane warunkowo: wybrany plik i błąd żyją tyle co okno. */}
      {dialog === 'upload' && <LogoUploadDialog tournament={tournament} color={color} onClose={close} />}
      {dialog === 'delete' && <LogoDeleteDialog tournament={tournament} onClose={close} />}
    </Card>
  );
}

const UPLOAD_FAILED = 'Nie udało się wgrać logo. Spróbuj ponownie.';
const DELETE_LOGO_FAILED = 'Nie udało się usunąć logo. Spróbuj ponownie.';

/**
 * Okno wgrywania. Wybór pliku niczego nie wysyła; `POST` idzie dopiero po
 * „Zapisz" i po walidacji klienta (`logoFileError`), więc GIF czy plik 3 MB
 * nie robią żądania. `422` pod `logo` (np. wymiary, które sprawdza tylko
 * serwer) siada przy polu, a okno zostaje otwarte.
 */
function LogoUploadDialog({
  tournament,
  color,
  onClose,
}: {
  tournament: Tournament;
  color: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ logo: File | null }>({ defaultValues: { logo: null } });

  async function onSubmit({ logo }: { logo: File | null }) {
    // `validate` w `Controller` przepuszcza tylko plik.
    if (!logo) return;

    let result;
    try {
      result = await api.POST('/tournaments/{tournament}/logo', {
        params: { path: { tournament: tournament.id } },
        body: { logo },
        // `FormData` bez ręcznego `Content-Type`: granicę dokłada przeglądarka.
        bodySerializer: (body) => {
          const data = new FormData();
          data.append('logo', body.logo);
          return data;
        },
      });
    } catch (cause) {
      if (cause instanceof TypeError) {
        setError('root', { message: UPLOAD_FAILED });
        return;
      }
      throw cause;
    }

    const { data, error, response } = result;
    if (!data) {
      applyApiError(response.status >= 500 ? undefined : error, ['logo'], setError, UPLOAD_FAILED);
      return;
    }

    queryClient.setQueryData(['tournament', tournament.id], data.data);
    toast.success('Zapisano logo.');
    onClose();
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      title={tournament.branding.logoUrl ? 'Zmień logo' : 'Wgraj logo'}
      submitLabel="Zapisz"
      error={errors.root?.message}
      pending={isSubmitting}
    >
      <Controller
        control={control}
        name="logo"
        rules={{ validate: (file) => logoFileError(file, TOURNAMENT_LOGO) ?? true }}
        render={({ field, fieldState }) => (
          <ImageFileField
            label="Plik z logo"
            value={field.value}
            onChange={field.onChange}
            currentUrl={tournament.branding.logoUrl}
            hint={LOGO_FILE_HINT}
            error={fieldState.error?.message}
            fallback={<TournamentLogo logoUrl={null} color={color} className="size-full" />}
            disabled={isSubmitting}
          />
        )}
      />
    </FormDialog>
  );
}

/** Usunięcie logo. Operacja jest idempotentna, więc `200` przychodzi też wtedy, gdy logo już zniknęło. */
function LogoDeleteDialog({ tournament, onClose }: { tournament: Tournament; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setFailure(null);
    try {
      let result;
      try {
        result = await api.DELETE('/tournaments/{tournament}/logo', {
          params: { path: { tournament: tournament.id } },
        });
      } catch (cause) {
        if (cause instanceof TypeError) {
          setFailure(DELETE_LOGO_FAILED);
          return;
        }
        throw cause;
      }

      const { data, error, response } = result;
      if (!data) {
        setFailure((response.status < 500 && apiErrorMessage(error)) || DELETE_LOGO_FAILED);
        return;
      }

      queryClient.setQueryData(['tournament', tournament.id], data.data);
      toast.success('Usunięto logo.');
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    } finally {
      setPending(false);
    }
  }

  return (
    <ConfirmDeleteDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={() => void remove()}
      entity="logo turnieju"
      name={tournament.name}
      description="Plik zostanie skasowany, a w jego miejsce wejdzie domyślne logo w kolorze turnieju."
      error={failure ?? undefined}
      pending={pending}
    />
  );
}

const POINT_FIELDS = [
  { key: 'win', label: 'Wygrana' },
  { key: 'draw', label: 'Remis' },
  { key: 'loss', label: 'Porażka' },
] as const;

/**
 * Formularz ustawień z jednym „Zapisz zmiany". `PATCH` niesie tylko zmienione
 * pola (`tournamentSettingsUpdate`), a odpowiedź wraca do `['tournament', id]`, więc
 * nagłówek od razu pokazuje nową nazwę i adres.
 *
 * Turniej odświeżony z zewnątrz (status, logo, refetch) przychodzi przez
 * `values` i nadpisuje tylko pola, których organizer nie ruszył
 * (`keepDirtyValues`).
 */
function SettingsForm({ tournament, sport }: { tournament: Tournament; sport: Sport }) {
  const queryClient = useQueryClient();
  const { allowsDraw, defaultPoints, tiebreakerLabels } = sport.config;
  const schema = useMemo(() => tournamentSettingsSchema(allowsDraw), [allowsDraw]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TournamentSettingsValues>({
    resolver: zodResolver(schema),
    values: tournamentSettingsValues(tournament),
    resetOptions: { keepDirtyValues: true },
  });

  // W sporcie bez remisów pola „Remis" nie ma. Jego błąd z serwera nie
  // miałby gdzie usiąść, więc nie ma go też w `errorFields`: idzie nad przycisk.
  const pointFields = POINT_FIELDS.filter(({ key }) => allowsDraw || key !== 'draw');
  const errorFields = [
    'name',
    'slug',
    'branding.primaryColor',
    'points',
    ...pointFields.map(({ key }) => `points.${key}` as const),
  ] as const;

  async function onSubmit(values: TournamentSettingsValues) {
    const body = tournamentSettingsUpdate(values, tournament, allowsDraw);
    // Formularz bywa „brudny" bez zmiany, np. przez spację na końcu nazwy,
    // którą schemat przycina. Nie ma czego wysyłać.
    if (Object.keys(body).length === 0) {
      reset(tournamentSettingsValues(tournament));
      return;
    }

    let result;
    try {
      result = await api.PATCH('/tournaments/{tournament}', {
        params: { path: { tournament: tournament.id } },
        body,
      });
    } catch (cause) {
      // `fetch` bez odpowiedzi (sieć) odrzuca `TypeError`; komunikat przeglądarki
      // byłby po angielsku.
      if (cause instanceof TypeError) {
        setError('root', { message: SAVE_FAILED });
        return;
      }
      throw cause;
    }

    const { data, error, response } = result;
    if (!data) {
      applyApiError(response.status >= 500 ? undefined : error, errorFields, setError, SAVE_FAILED);
      return;
    }

    // Najpierw formularz, potem cache: nowy turniej przychodzi wtedy przez
    // `values` do formularza, który nie ma już brudnych pól.
    reset(tournamentSettingsValues(data.data));
    queryClient.setQueryData(['tournament', tournament.id], data.data);
    toast.success('Zapisano zmiany.');
    await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
  }

  function restoreDefaultPoints() {
    for (const { key } of POINT_FIELDS) {
      setValue(`points.${key}`, defaultPoints[key], { shouldDirty: true, shouldValidate: false });
    }
  }

  const color = watch('branding.primaryColor');
  const slug = watch('slug');
  // W szkicu strona i tak daje `404`, więc stary adres nie ma czego stracić.
  const slugWarning = tournament.status !== 'draft' && slug !== tournament.slug;
  const pointsError = errors.points?.message;

  return (
    <>
      <LogoCard
        tournament={tournament}
        color={isHexColor(color) ? color : tournament.branding.primaryColor}
      />

      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
        <Card>
          <CardContent className="space-y-6">
            <section className="space-y-4">
              <Heading level="card">Dane</Heading>
              <div className="space-y-2">
                <Label htmlFor="name">Nazwa</Label>
                <Input
                  id="name"
                  maxLength={160}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                  {...register('name')}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Adres strony</Label>
                <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <span className="px-2.5 text-sm text-muted-foreground select-none">/t/</span>
                  <Input
                    id="slug"
                    maxLength={80}
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={errors.slug ? true : undefined}
                    aria-describedby={
                      [errors.slug && 'slug-error', slugWarning && 'slug-warning', 'slug-preview']
                        .filter(Boolean)
                        .join(' ')
                    }
                    className="rounded-l-none border-0 pl-0 focus-visible:ring-0"
                    {...register('slug')}
                  />
                </div>
                <p id="slug-preview" className="text-xs text-muted-foreground">
                  {publicTournamentUrl(slug)}
                </p>
                {errors.slug && (
                  <p id="slug-error" className="text-sm text-destructive">
                    {errors.slug.message}
                  </p>
                )}
                {slugWarning && (
                  <div
                    id="slug-warning"
                    role="status"
                    className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p>
                      Dotychczasowy adres /t/{tournament.slug} przestanie działać. Przekierowania nie będzie.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <Heading level="card">Wygląd</Heading>
              <Controller
                control={control}
                name="branding.primaryColor"
                render={({ field, fieldState }) => (
                  <BrandColorPicker
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </section>

            <Separator />

            <section className="space-y-4">
              <Heading level="card">Punktacja</Heading>
              <div className="flex flex-wrap items-start gap-4">
                {pointFields.map(({ key, label }) => {
                  const fieldError = errors.points?.[key];
                  const describedBy = [fieldError && `points-${key}-error`, pointsError && 'points-error']
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <div key={key} className="w-24 space-y-2">
                      <Label htmlFor={`points-${key}`}>{label}</Label>
                      <Input
                        id={`points-${key}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={10}
                        aria-invalid={fieldError || pointsError ? true : undefined}
                        aria-describedby={describedBy || undefined}
                        {...register(`points.${key}`, { valueAsNumber: true })}
                      />
                      {fieldError && (
                        <p id={`points-${key}-error`} className="text-sm text-destructive">
                          {fieldError.message}
                        </p>
                      )}
                    </div>
                  );
                })}
                {/* Ustawia pola i niczego nie zapisuje. */}
                <Button type="button" variant="link" className="mt-6" onClick={restoreDefaultPoints}>
                  Przywróć domyślne dla sportu
                </Button>
              </div>
              {/* Porządek punktacji dotyczy trzech pól naraz, więc stoi przy karcie. */}
              {pointsError && (
                <p id="points-error" className="text-sm text-destructive">
                  {pointsError}
                </p>
              )}
              <div role="group" aria-labelledby="tiebreakers-label" className="space-y-2">
                <p id="tiebreakers-label" className="text-sm font-medium">
                  Kolejność rozstrzygania remisów w tabeli
                </p>
                <TiebreakerList
                  items={tournament.tiebreakers.map((code) => ({
                    code,
                    // Kolejność z turnieju, z mapy tylko etykieta: MySQL oddaje
                    // klucze `tiebreakerLabels` posortowane po długości.
                    label: tiebreakerLabels[code] ?? code,
                  }))}
                />
              </div>
            </section>

            {/* Błąd, którego nie da się przypiąć do pola. */}
            {errors.root && (
              <p role="alert" className="text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={!isDirty || isSubmitting}>
              {isSubmitting ? 'Zapisywanie…' : 'Zapisz zmiany'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <UnsavedChangesGuard when={isDirty} />
    </>
  );
}
