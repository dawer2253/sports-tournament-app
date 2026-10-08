import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { firstFieldErrors, isValidationError } from '@tournament/api-client';
import { toast } from '@tournament/ui';
import { useState } from 'react';
import { apiErrorMessage, applyApiError, type SetFieldError } from './form-errors';

/**
 * Teksty jednego rodzaju bytu listy. Toasty sukcesu hook składa sam z biernika,
 * bo „Dodano”, „Zapisano” i „Usunięto” nie odmieniają się przez rodzaj. Teksty
 * po `404` są całymi zdaniami: „Tej drużyny” i „Tego obiektu” różnią się
 * rodzajem, nie samą końcówką.
 */
export type ListTexts = {
  /**
   * Biernik, małą literą: „obiekt”, „drużynę”, „zawodnika”. Ten sam, który
   * dostaje `entity` w `ConfirmDeleteDialog`.
   */
  accusative: string;
  /** Toast po `404` przy usuwaniu, np. „Obiekt został już usunięty.” */
  alreadyDeleted: string;
  /** Toast po `404` przy edycji, np. „Tego obiektu już nie ma.” */
  gone: string;
};

/** Wywołanie klienta API, np. `() => api.PATCH('/venues/{venue}', …)`. */
type ApiCall = () => Promise<{ error?: unknown; response: Response }>;

/** Jedna zmiana: żądanie i nazwa bytu do toastu. */
type Change = { name: string; request: ApiCall };

/**
 * Błąd okna potwierdzenia w kształcie propsów `ConfirmDeleteDialog`, więc
 * rozkłada się na nie wprost: `{...mutation.removeError}`.
 */
type RemoveError = { blocked: true; error: string } | { blocked?: false; error?: string };

type Options = {
  texts: ListTexts;
  /**
   * Klucze zapytań do unieważnienia po zmianie: lista, a przy drużynach także
   * `['tournament', id]`, bo z niego idzie `teamsCount`.
   */
  invalidate: readonly QueryKey[];
  /** Zamyka okno; przy usunięciu drużyny z ekranu składu wraca też na listę drużyn. */
  onDone: () => void;
};

/** Formularz okna, w którym siadają błędy `422` — to, co dostaje `applyApiError`. */
type FormTarget<TField extends string> = {
  fields: readonly TField[];
  setError: SetFieldError<TField>;
};

type ListSave = {
  /** Żądanie w drodze; idzie do `pending` okna, które wtedy nie daje się zamknąć. */
  pending: boolean;
  create: (change: Change) => Promise<void>;
  update: (change: Change) => Promise<void>;
};

type ListRemove = {
  /** Jak w `ListSave`. */
  pending: boolean;
  remove: (change: Change) => Promise<void>;
  removeError: RemoveError;
};

const SAVE_FAILED = 'Nie udało się zapisać. Spróbuj ponownie.';
const REMOVE_FAILED = 'Nie udało się usunąć. Spróbuj ponownie.';

/** Status odpowiedzi; `0`, gdy odpowiedzi nie było, bo `fetch` odrzucił obietnicę (sieć). */
async function send(request: ApiCall): Promise<{ status: number; error?: unknown }> {
  try {
    const { response, error } = await request();
    return { status: response.status, error };
  } catch {
    return { status: 0 };
  }
}

// Po statusie, a nie po `error`: odpowiedź błędu bez ciała daje w `openapi-fetch`
// `error` równe `undefined` albo pustemu napisowi, a `if (error)` wziąłby ją za sukces.
function isOk(status: number) {
  return status >= 200 && status < 300;
}

/**
 * Sieć i `5xx` dostają komunikat ogólny z „Spróbuj ponownie”. Tekst serwera
 * („Wewnętrzny błąd serwera.”) nie mówi organizerowi, co dalej, a przy sieci
 * byłby to angielski komunikat przeglądarki.
 */
function isOutage(status: number) {
  return status === 0 || status >= 500;
}

/**
 * Zapis i usuwanie bytu listy w panelu (obiekty, drużyny, zawodnicy) — wzorzec
 * z #86, opisany w `apps/admin/AGENTS.md`, sekcja „Edycja list”.
 *
 * Zapis jest po odpowiedzi, nie optymistyczny: okno czeka na serwer i zamyka
 * się dopiero po sukcesie, bo tylko w otwartym oknie błąd pola ma gdzie usiąść.
 *
 * Hook wywołuje komponent okna, a nie ekran: stan (`pending`, błąd, blokada) ma
 * żyć tyle co okno, żeby błąd z jednego otwarcia nie wrócił przy następnym.
 * Okno formularza podaje `form` i woła `create` albo `update`; okno potwierdzenia
 * nie podaje `form` i woła `remove`.
 *
 * | Odpowiedź   | `create` / `update`                          | `remove`                           |
 * |-------------|----------------------------------------------|------------------------------------|
 * | `2xx`       | odświeżenie, zamknięcie, toast               | zamknięcie, toast, odświeżenie     |
 * | `422`       | `applyApiError`: pole albo `root`            | pod `id` (guard): tryb zablokowany |
 * | `404`       | `update`: jak `2xx`, ostrzeżenie `gone`      | jak `2xx`, toast `alreadyDeleted`  |
 * | `5xx`, sieć | komunikat ogólny w `root`                    | komunikat ogólny, „Usuń” zostaje   |
 * | inne `4xx`  | tekst serwera w `root`                       | tekst serwera, „Usuń” zostaje      |
 *
 * `404` przy `create` nie znaczy „tego bytu już nie ma”: bytu jeszcze nie było,
 * a zniknął turniej. Idzie więc jak inne `4xx`.
 *
 * Kolejność zamknięcia i odświeżenia jest różna celowo. Zapis zamyka okno na
 * już odświeżonej liście, żeby organizer nie zobaczył jej na chwilę bez bytu,
 * który właśnie dodał. Usunięcie najpierw zamyka, bo `onDone` może zdejmować
 * cały ekran usuniętego bytu (drużyna na ekranie składu). Gdyby jego klucz
 * wpadł mimo wszystko pod `invalidate`, odświeżenie przed wyjściem dopytałoby
 * o byt, którego już nie ma, i mignęło stanem „Nie ma takiej drużyny”.
 */
export function useListMutation<TField extends string>(
  options: Options & { form: FormTarget<TField> },
): ListSave;
export function useListMutation(options: Options): ListRemove;
export function useListMutation<TField extends string>({
  texts,
  invalidate,
  onDone,
  form,
}: Options & { form?: FormTarget<TField> }): ListSave & ListRemove {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [removeError, setRemoveError] = useState<RemoveError>({});

  async function refresh() {
    await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  }

  async function save(mode: 'create' | 'update', { name, request }: Change) {
    setPending(true);
    try {
      const { status, error } = await send(request);

      if (isOk(status)) {
        await refresh();
        onDone();
        const verb = mode === 'create' ? 'Dodano' : 'Zapisano';
        toast.success(`${verb} ${texts.accusative} „${name}”.`);
        return;
      }

      // Zmiany nie zapisano, więc to ostrzeżenie, nie sukces. Okno i tak się
      // zamyka: poprawiać nie ma czego, a odświeżona lista pokaże, czemu.
      if (status === 404 && mode === 'update') {
        await refresh();
        onDone();
        toast.warning(texts.gone);
        return;
      }

      // Przeciążenia gwarantują `form` przy `create` i `update`.
      if (form) {
        const reported = isOutage(status) ? undefined : error;
        applyApiError(reported, form.fields, form.setError, SAVE_FAILED);
      }
    } finally {
      setPending(false);
    }
  }

  async function remove({ name, request }: Change) {
    setPending(true);
    // Ponowienie zaczyna od czystego okna; nowy błąd i tak wróci z odpowiedzią.
    setRemoveError({});
    try {
      const { status, error } = await send(request);

      // `404`: ktoś usunął byt wcześniej, więc cel organizera jest osiągnięty.
      if (isOk(status) || status === 404) {
        onDone();
        toast.success(isOk(status) ? `Usunięto ${texts.accusative} „${name}”.` : texts.alreadyDeleted);
        await refresh();
        return;
      }

      // Guard (np. rozegrane mecze) pod `id`: ponowienie nic nie zmieni, więc
      // okno zostaje z powodem i samym „Zamknij”.
      if (status === 422 && isValidationError(error) && 'id' in error.errors) {
        setRemoveError({ blocked: true, error: firstFieldErrors(error).id || error.message });
        return;
      }

      setRemoveError({ error: (!isOutage(status) && apiErrorMessage(error)) || REMOVE_FAILED });
    } finally {
      setPending(false);
    }
  }

  return {
    pending,
    create: (change) => save('create', change),
    update: (change) => save('update', change),
    remove,
    removeError,
  };
}
