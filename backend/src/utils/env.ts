import 'dotenv/config';
import { parseEnv } from './config.js';

export const env = parseEnv(process.env);
