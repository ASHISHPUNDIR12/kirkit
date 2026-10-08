import type { Request, Response } from 'express';
import * as matchService from '../services/matchService.js';
import * as scoringService from '../services/scoringService.js';
import { validateMatch } from '../utils/validateMatch.js';
import { validateStartMatch } from '../utils/validateMatch.js';
import { validateSecondInnings } from '../utils/validateSecondInnings.js';

export async function createMatch(request: Request, response: Response) {
  const validated = validateMatch(request.body);
  if (!validated.valid) {
    response.status(400).json({ error: validated.error });
    return;
  }
  try {
    response.status(201).json(await matchService.createMatch(validated.data, response.locals.user.id));
  } catch {
    console.error('Database request failed while creating a match.');
    response.status(503).json({ error: 'Unable to save the match. Please try again shortly.' });
  }
}

export async function listMatches(_request: Request, response: Response) {
  try {
    response.json(await matchService.listMatches(response.locals.user.id));
  } catch {
    console.error('Database request failed while listing matches.');
    response.status(503).json({ error: 'Unable to load matches. Please try again shortly.' });
  }
}

export async function getMatch(request: Request, response: Response) {
  const matchId = Array.isArray(request.params.matchId) ? request.params.matchId[0] : request.params.matchId;
  try {
    const match = await matchService.getMatch(matchId);
    if (!match) {
      response.status(404).json({ error: 'Match not found.' });
      return;
    }
    response.json(match);
  } catch {
    console.error('Database request failed while loading a match.');
    response.status(503).json({ error: 'Unable to load the match. Please try again shortly.' });
  }
}

export async function startMatch(request: Request, response: Response) {
  const validated = validateStartMatch(request.body);
  if (!validated.valid) {
    response.status(400).json({ error: validated.error });
    return;
  }
  try {
    const matchId = Array.isArray(request.params.matchId) ? request.params.matchId[0] : request.params.matchId;
    response.status(200).json(await matchService.startMatch(matchId, validated.data));
  } catch (error) {
    if (error instanceof matchService.MatchNotFoundError) {
      response.status(404).json({ error: 'Match not found.' });
    } else if (error instanceof matchService.MatchAlreadyStartedError) {
      response.status(409).json({ error: 'This match has already been started.' });
    } else if (error instanceof matchService.InvalidBattingFirstTeamError) {
      response.status(400).json({ error: 'Choose one of the teams in this match to bat first.' });
    } else {
      console.error('Database request failed while starting a match.');
      response.status(503).json({ error: 'Unable to start the match. Please try again shortly.' });
    }
  }
}

export async function startSecondInnings(request: Request, response: Response) {
  const validated = validateSecondInnings(request.body);
  if (!validated.valid) {
    response.status(400).json({ error: validated.error });
    return;
  }
  const matchId = Array.isArray(request.params.matchId) ? request.params.matchId[0] : request.params.matchId;
  try {
    response.status(201).json(await scoringService.startSecondInnings(matchId, validated.data));
  } catch (error) {
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: 'Match not found.' });
    } else if (error instanceof scoringService.MatchSetupStateError) {
      response.status(409).json({ error: 'The first innings must end before the second innings starts.' });
    } else {
      console.error('Database request failed while starting the second innings.');
      response.status(503).json({ error: 'Unable to start the second innings. Please try again shortly.' });
    }
  }
}

export async function finishMatch(request: Request, response: Response) {
  const matchId = Array.isArray(request.params.matchId) ? request.params.matchId[0] : request.params.matchId;
  try {
    response.json(await scoringService.finishMatch(matchId));
  } catch (error) {
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: 'Match not found.' });
    } else if (error instanceof scoringService.MatchSetupStateError) {
      response.status(409).json({ error: 'The second innings must start before the match can be finished.' });
    } else {
      console.error('Database request failed while finishing a match.');
      response.status(503).json({ error: 'Unable to finish the match. Please try again shortly.' });
    }
  }
}
