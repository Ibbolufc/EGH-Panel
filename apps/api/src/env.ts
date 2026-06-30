import 'dotenv/config';
import { parsePanelEnv } from '@egh/config';

export const env = parsePanelEnv(process.env);
