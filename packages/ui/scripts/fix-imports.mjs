// Zamienia importy `@/...` na ścieżki względne wewnątrz pakietu.
//
// Alias `@/` należy do aplikacji i wskazuje ich własne `src`. Gdyby został
// w `packages/ui`, ten sam zapis oznaczałby dwa różne katalogi w jednym
// procesie Vite. Generator shadcn nadal wypisuje `@/`, więc po każdym
// `npx shadcn add ...` uruchom `npm run fix-imports`.

import { globSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'src');

const files = globSync('src/**/*.{ts,tsx,mdx}', { cwd: root }).map((f) => path.join(root, f));

let changed = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const fromDir = path.dirname(file);
  const after = before.replace(/(['"])@\/([^'"]+)\1/g, (_match, quote, rest) => {
    let rel = path.relative(fromDir, path.join(srcDir, rest));
    if (!rel.startsWith('.')) rel = './' + rel;
    return `${quote}${rel}${quote}`;
  });
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}

console.log(`fix-imports: zmienione pliki ${changed} / ${files.length}`);
