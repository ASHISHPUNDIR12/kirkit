import { requireInningsOwner } from '../middleware/auth.js';
import { Router } from 'express';
import { addNewBatsman, changeBowler, endInnings, getInnings, recordExtra, recordScore, recordWicket } from '../controllers/inningsController.js';

export const inningsRouter = Router();
inningsRouter.param('inningsId', (request, response, next) => { void requireInningsOwner(request, response, next); });
inningsRouter.get('/:inningsId', getInnings);
inningsRouter.post('/:inningsId/score', recordScore);
inningsRouter.post('/:inningsId/change-bowler', changeBowler);
inningsRouter.post('/:inningsId/wicket', recordWicket);
inningsRouter.post('/:inningsId/new-batsman', addNewBatsman);
inningsRouter.post('/:inningsId/extra', recordExtra);
inningsRouter.post('/:inningsId/end', endInnings);
