// Generuje `src/schema.d.ts` z kontraktu.
//
// Idzie przez API Node, nie przez CLI, bo tylko API ma `transform`: bez niego
// `format: binary` staje się w typach `string`, a upload logo wysyła plik
// (`Blob`/`File`). Nagłówek pliku i reszta wyjścia są takie same jak z CLI.
// Uzasadnienie: docs/research/upload-obrazow-laravel.md §6.
//
// Tego skryptu używa też bramka CI („Klient zgodny ze specyfikacją").

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const input = pathToFileURL(path.join(root, '../api-contract/openapi.yaml'));
const output = path.join(root, 'src/schema.d.ts');

const BLOB_TYPE = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('Blob'));

const ast = await openapiTS(input, {
  transform(schemaObject) {
    return schemaObject.format === 'binary' ? BLOB_TYPE : undefined;
  },
});

writeFileSync(output, `${COMMENT_HEADER}${astToString(ast)}`, 'utf8');
console.info(`openapi.yaml → ${path.relative(root, output)}`);
