import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createSession, type Session } from './api.ts';
import type { Config } from './config.ts';
import { registerMatchTools } from './tools/matches.ts';
import { registerRegistrationTools } from './tools/registrations.ts';
import { registerStageTools } from './tools/stages.ts';
import { registerTeamTools } from './tools/teams.ts';
import { registerTournamentTools } from './tools/tournaments.ts';
import { registerVenueTools } from './tools/venues.ts';

/**
 * Serwer MCP do prowadzenia turniejów organizatora. Narzędzia leżą w `tools/`
 * po obszarach; konwencje (podpowiedzi, paczki, odpowiedzi) opisuje
 * `docs/MCP.md`. Sesję API można podać z zewnątrz, żeby zalogować się przed startem.
 */
export function createServer(config: Config, session: Session = createSession(config)): McpServer {
  const server = new McpServer({ name: 'tournament', version: '0.1.0' });
  const kit = { server, session, config };

  registerTournamentTools(kit);
  registerTeamTools(kit);
  registerVenueTools(kit);
  registerStageTools(kit);
  registerMatchTools(kit);
  registerRegistrationTools(kit);

  return server;
}
