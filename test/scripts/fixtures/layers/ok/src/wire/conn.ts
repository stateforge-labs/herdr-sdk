import { createConnection } from 'node:net';
import { A } from '../constants.ts';
export const open = (): unknown => [createConnection, A];
