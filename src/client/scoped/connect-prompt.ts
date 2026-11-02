// Role: connectPrompt(): R-meta plus agent.prompt, for the hub voice path; no call(), no streams, no writes beyond the entry.
// Informs HERDR-ADR-0005 (prompt client = R-meta + agent.prompt) and plan 3.4; contract in client/types.ts (ConnectPrompt).
import { EntryKey } from '../../constants.ts';
import { connectCore } from '../connect-core.ts';
import type { ConnectPrompt, PromptClient } from '../types.ts';
import { allowedMethods } from './allowed-methods.ts';
import { composeOrClose, ENTRY_MEMBERS } from './compose.ts';

export const connectPrompt: ConnectPrompt = async function connectPrompt(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<PromptClient>(core, allowedMethods(EntryKey.prompt), ENTRY_MEMBERS[EntryKey.prompt]);
};
