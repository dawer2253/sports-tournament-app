import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSession } from './api.ts';
import { type Config, readConfig } from './config.ts';
import { createServer } from './server.ts';

// stdout należy do protokołu MCP, więc każdy log idzie na stderr; Claude Desktop
// zbiera go w pliku mcp-server-<nazwa>.log.
function log(message: string): void {
  console.error(`[tournament-mcp] ${message}`);
}

let config: Config;
try {
  config = readConfig(process.env);
} catch (error) {
  log((error as Error).message);
  process.exit(1);
}

const session = createSession(config);
try {
  await session.login();
  log(`Zalogowano jako ${config.email} w ${config.apiUrl}.`);
} catch (error) {
  // Bez wyjścia z procesu: Desktop pokazałby wtedy tylko „serwer się rozłączył”.
  // Narzędzie spróbuje zalogować się przy pierwszym wywołaniu i powie agentowi, co nie gra.
  log(`Logowanie przy starcie nie powiodło się: ${(error as Error).message}`);
}

await createServer(config, session).connect(new StdioServerTransport());
log('Serwer MCP nasłuchuje na stdio.');
