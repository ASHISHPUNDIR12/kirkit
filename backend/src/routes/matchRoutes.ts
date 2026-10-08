import { requireMatchOwner } from "../middleware/auth.js";
import { Router } from "express";
import {
  createMatch,
  finishMatch,
  getMatch,
  listMatches,
  startMatch,
  startSecondInnings,
} from "../controllers/matchController.js";

export const matchRouter = Router();
matchRouter.param("matchId", (request, response, next) => {
  void requireMatchOwner(request, response, next);
});
matchRouter.post("/", createMatch);
matchRouter.get("/", listMatches);
matchRouter.get("/:matchId", getMatch);
matchRouter.post("/:matchId/start", startMatch);
matchRouter.post("/:matchId/start-second-innings", startSecondInnings);
matchRouter.post("/:matchId/finish", finishMatch);
