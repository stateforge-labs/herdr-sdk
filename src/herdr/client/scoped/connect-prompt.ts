// Role: connectPrompt(): R-meta plus agent.prompt, for the hub voice path; no call(), no streams, no writes beyond the entry.
// Informs HERDR-ADR-0005 (prompt client = R-meta + agent.prompt), plan 3.4 and 10.1 step 2 (imports only its own list); contract in client/types.ts (ConnectPrompt).
import { EntryKey } from '../../../constants.ts';
import { PROMPT_METHODS } from '../../generated/entries/prompt.ts';
import { connectCore } from '../connect-core.ts';
import type { ConnectPrompt, PromptClient } from '../types.ts';
import { allowedMethods } from './allowed-methods.ts';
import { composeOrClose, ENTRY_MEMBERS } from './compose.ts';

export const connectPrompt: ConnectPrompt = async function connectPrompt(options = {}) {
  const core = await connectCore(options);
  return composeOrClose<PromptClient>(core, allowedMethods(PROMPT_METHODS), ENTRY_MEMBERS[EntryKey.prompt]);
};
