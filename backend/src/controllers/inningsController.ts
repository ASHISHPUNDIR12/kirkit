import { ActionConflict, undoAction } from '../services/actions.js';
import { commandFrom } from '../middleware/command.js';
import type { Request, Response } from "express";
import * as scoringService from "../services/scoringService.js";
import { validateScore } from "../utils/validateScore.js";
import { validateExtra } from "../utils/validateExtra.js";
import { validateSecondInnings } from "../utils/validateSecondInnings.js";
import { validatePlayerName } from "../utils/validatePlayerName.js";

function getInningsId(request: Request) {
  return Array.isArray(request.params.inningsId)
    ? request.params.inningsId[0]
    : request.params.inningsId;
}

export async function getInnings(request: Request, response: Response) {
  try {
    const innings = await scoringService.getInnings(getInningsId(request));
    if (!innings) {
      response.status(404).json({ error: "Innings not found." });
      return;
    }
    response.json(innings);
  } catch {
    console.error("Database request failed while loading an innings.");
    response
      .status(503)
      .json({ error: "Unable to load the innings. Please try again shortly." });
  }
}

export async function recordScore(request: Request, response: Response) {
  const validated = validateScore(request.body);
  if (!validated.valid) {
    response.status(400).json({ error: validated.error });
    return;
  }
  try {
    response.json(
      await scoringService.recordScore(getInningsId(request), validated.runs, commandFrom(request)),
    );
  } catch (error) {
    if (error instanceof ActionConflict) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: "Innings not found." });
    } else if (error instanceof scoringService.InningsNotScoringError) {
      response
        .status(409)
        .json({ error: "This innings is not accepting scores." });
    } else if (error instanceof scoringService.ActivePlayerMissingError) {
      response
        .status(409)
        .json({ error: "The innings is missing an active striker or bowler." });
    } else if (error instanceof scoringService.BowlerChangeRequiredError) {
      response.status(409).json({
        error: "Enter the next bowler before scoring another delivery.",
      });
    } else {
      console.error("Database request failed while recording a score.");
      response.status(503).json({
        error: "Unable to record the score. Please try again shortly.",
      });
    }
  }
}

export async function changeBowler(request: Request, response: Response) {
  const body = request.body as unknown;
  const playerName =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).playerName
      : undefined;
  const validated = validatePlayerName(playerName, "bowler");
  if (!validated.valid) {
    response.status(400).json({ error: validated.error });
    return;
  }
  try {
    response.json(
      await scoringService.changeBowler(getInningsId(request), validated.name, commandFrom(request)),
    );
  } catch (error) {
    if (error instanceof ActionConflict) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: "Innings not found." });
    } else if (error instanceof scoringService.InningsNotScoringError) {
      response
        .status(409)
        .json({ error: "This innings is not accepting changes." });
    } else if (error instanceof scoringService.BowlerChangeNotAllowedError) {
      response.status(409).json({
        error: "A bowler can be changed only after a completed over.",
      });
    } else {
      console.error("Database request failed while changing bowler.");
      response.status(503).json({
        error: "Unable to change the bowler. Please try again shortly.",
      });
    }
  }
}

export async function recordWicket(request: Request, response: Response) {
  try {
    response.json(await scoringService.recordWicket(getInningsId(request), commandFrom(request)));
  } catch (error) {
    if (error instanceof ActionConflict) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: "Innings not found." });
    } else if (error instanceof scoringService.InningsNotScoringError) {
      response
        .status(409)
        .json({ error: "This innings is not accepting scores." });
    } else if (error instanceof scoringService.BowlerChangeRequiredError) {
      response.status(409).json({
        error: "Enter the next bowler before scoring another delivery.",
      });
    } else if (error instanceof scoringService.ActivePlayerMissingError) {
      response
        .status(409)
        .json({ error: "The innings is missing an active striker or bowler." });
    } else {
      console.error("Database request failed while recording a wicket.");
      response.status(503).json({
        error: "Unable to record the wicket. Please try again shortly.",
      });
    }
  }
}

export async function addNewBatsman(request: Request, response: Response) {
  const body = request.body as unknown;
  const playerName =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).playerName
      : undefined;
  const validated = validatePlayerName(playerName, "batsman");
  if (!validated.valid) {
    response.status(400).json({ error: validated.error });
    return;
  }
  try {
    response.json(
      await scoringService.addNewBatsman(getInningsId(request), validated.name, commandFrom(request)),
    );
  } catch (error) {
    if (error instanceof ActionConflict) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: "Innings not found." });
    } else if (error instanceof scoringService.InningsNotScoringError) {
      response
        .status(409)
        .json({ error: "This innings is not accepting changes." });
    } else if (error instanceof scoringService.NewBatsmanNotExpectedError) {
      response
        .status(409)
        .json({ error: "A new batsman is not expected right now." });
    } else {
      console.error("Database request failed while adding a batsman.");
      response.status(503).json({
        error: "Unable to save the new batsman. Please try again shortly.",
      });
    }
  }
}

export async function recordExtra(request: Request, response: Response) {
  const validated = validateExtra(request.body);
  if (!validated.valid) {
    response.status(400).json({ error: validated.error });
    return;
  }
  try {
    response.json(
      await scoringService.recordExtra(
        getInningsId(request),
        validated.eventType, commandFrom(request),
      ),
    );
  } catch (error) {
    if (error instanceof ActionConflict) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: "Innings not found." });
    } else if (error instanceof scoringService.InningsNotScoringError) {
      response
        .status(409)
        .json({ error: "This innings is not accepting scores." });
    } else if (error instanceof scoringService.BowlerChangeRequiredError) {
      response.status(409).json({
        error: "Enter the next bowler before scoring another delivery.",
      });
    } else if (
      error instanceof scoringService.BatsmanReplacementRequiredError
    ) {
      response.status(409).json({
        error: "Enter the new batsman before scoring another delivery.",
      });
    } else if (error instanceof scoringService.ActivePlayerMissingError) {
      response
        .status(409)
        .json({ error: "The innings is missing an active striker or bowler." });
    } else {
      console.error("Database request failed while recording an extra.");
      response.status(503).json({
        error: "Unable to record the extra. Please try again shortly.",
      });
    }
  }
}

export async function endInnings(request: Request, response: Response) {
  try {
    response.json(await scoringService.endInnings(getInningsId(request), commandFrom(request)));
  } catch (error) {
    if (error instanceof ActionConflict) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: "Innings not found." });
    } else if (error instanceof scoringService.InningsNotScoringError) {
      response.status(409).json({ error: "This innings has already ended." });
    } else {
      console.error("Database request failed while ending an innings.");
      response.status(503).json({
        error: "Unable to end the innings. Please try again shortly.",
      });
    }
  }
}

export async function startSecondInnings(request: Request, response: Response) {
  const validated = validateSecondInnings(request.body);
  if (!validated.valid) {
    response.status(400).json({ error: validated.error });
    return;
  }
  const matchId = Array.isArray(request.params.matchId)
    ? request.params.matchId[0]
    : request.params.matchId;
  try {
    response
      .status(201)
      .json(await scoringService.startSecondInnings(matchId, validated.data));
  } catch (error) {
    if (error instanceof ActionConflict) { response.status(409).json({ error: error.message }); return; }
    if (error instanceof scoringService.InningsNotFoundError) {
      response.status(404).json({ error: "Match not found." });
    } else if (error instanceof scoringService.MatchSetupStateError) {
      response.status(409).json({
        error: "The first innings must end before the second innings starts.",
      });
    } else {
      console.error(
        "Database request failed while starting the second innings.",
      );
      response.status(503).json({
        error: "Unable to start the second innings. Please try again shortly.",
      });
    }
  }
}

export async function undo(request: Request, response: Response) {
  try { response.json(await undoAction(getInningsId(request), commandFrom(request))); }
  catch (error) {
    if (error instanceof ActionConflict) response.status(409).json({ error: error.message });
    else response.status(503).json({ error: 'Unable to undo. Please refresh and try again.' });
  }
}
