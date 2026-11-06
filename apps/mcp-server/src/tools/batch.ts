import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { ToolFailure, unwrap } from '../api.ts';
import { failure, rejection, success } from './kit.ts';

interface Batch<Item, Saved, Added> {
  items: Item[];
  /** Jak pozycję nazwać w raporcie odrzuceń, np. nazwa drużyny albo „gol, 12'”. */
  label: (item: Item) => string;
  /** Zapis jednej pozycji; `422` trafia do odrzuconych, inny błąd przerywa paczkę. */
  send: (item: Item) => Promise<{ data?: { data: Saved }; error?: unknown; response: Response }>;
  /** Zapisana pozycja w kształcie z `outputSchema`. */
  view: (saved: Saved) => Added;
  /** Zapisana pozycja jednym wierszem raportu, z id do dalszej pracy. */
  line: (added: Added) => string;
  /** Nagłówek raportu w mianowniku liczby mnogiej: „Drużyny”, „Zawodnicy”. */
  noun: string;
}

/**
 * Dodaje pozycje po kolei, nie równolegle: limity i unikalność sprawdza backend
 * przy każdym zapisie, a kolejność ma odpowiadać kolejności z czatu. Pozycję
 * odrzuconą przez walidację (`422`) pomija i idzie dalej. Inny błąd przerywa
 * paczkę i mówi, co już weszło, bo inaczej agent ponowi całość i zdubluje wpisy.
 */
export async function addEach<Item, Saved, Added>(batch: Batch<Item, Saved, Added>): Promise<CallToolResult> {
  const added: Added[] = [];
  const rejected: Array<{ name: string; message: string }> = [];

  for (const [index, item] of batch.items.entries()) {
    try {
      const result = await batch.send(item);
      const message = rejection(result);
      if (message !== null) {
        rejected.push({ name: batch.label(item), message });
        continue;
      }
      added.push(batch.view(unwrap(result).data));
    } catch (error) {
      if (!(error instanceof ToolFailure)) {
        throw error;
      }
      return failure(
        [
          `Przerwano dodawanie na pozycji „${batch.label(item)}”. ${error.message}`,
          `Dodane: ${added.map(batch.line).join('; ') || 'żadna'}.`,
          `Niedodane: ${batch.items.slice(index).map(batch.label).join('; ')}.`,
        ].join('\n'),
      );
    }
  }

  const rejectedLines = rejected.map((entry) => `- ${entry.name}: ${entry.message}`);
  if (added.length === 0) {
    return failure(['Nie dodano żadnej pozycji. API odrzuciło:', ...rejectedLines].join('\n'));
  }
  const lines = [
    `${batch.noun}: dodano ${added.length} z ${batch.items.length}.`,
    ...added.map((entry) => `- ${batch.line(entry)}`),
  ];
  if (rejected.length > 0) {
    lines.push('Odrzucone:', ...rejectedLines);
  }
  return success({ added, rejected }, lines.join('\n'));
}

export const rejectedSchema = z
  .array(z.object({ name: z.string(), message: z.string() }))
  .describe('Pozycje odrzucone przez walidację API, z powodem.');
