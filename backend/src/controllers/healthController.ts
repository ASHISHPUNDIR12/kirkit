import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '../services/database.js';

export async function getHealth(_request: Request, response: Response) {
  try {
    await checkDatabaseConnection();
    response.json({ status: 'ok', database: 'connected' });
  } catch {
    response.status(503).json({ status: 'error', database: 'unavailable' });
  }
}
