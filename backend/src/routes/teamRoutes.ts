import { Router } from 'express';
import { addPlayer, createTeam, listTeams, RosterError } from '../services/rosterService.js';
import type { Response } from 'express';
export const teamRouter = Router();
function fail(error: unknown, response: Response) {
  if (error instanceof RosterError) response.status(error.message === 'Team not found.' ? 404 : 400).json({ error: error.message });
  else if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') response.status(409).json({ error: 'That name is already saved. Choose a different name.' });
  else response.status(503).json({ error: 'Unable to access your teams. Please try again.' });
}
teamRouter.get('/', async (_request, response) => {
  try { response.json(await listTeams(response.locals.user.id)); } catch (error) { fail(error, response); }
});
teamRouter.post('/', async (request, response) => {
  try { response.status(201).json(await createTeam(response.locals.user.id, request.body?.name)); } catch (error) { fail(error, response); }
});
teamRouter.post('/:teamId/players', async (request, response) => {
  try { response.status(201).json(await addPlayer(response.locals.user.id, String(request.params.teamId), request.body?.name)); } catch (error) { fail(error, response); }
});
