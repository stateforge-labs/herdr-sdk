// Role: each connect function resolves to exactly the client type of its entry (connect, connectAdmin, the three connectReadOnly overloads, connectPrompt).
// Informs HERDR-ADR-0005 (capability-scoped clients), HERDR-ADR-0017 (locked signatures) and plan 10.1 step 7 (the public types do not change with the build). Compiled, never run.
import { connect, ErrorCode, type Client } from '../../../src/index.ts';
import { connectAdmin, type AdminClient } from '../../../src/admin.ts';
import {
  connectPrompt,
  connectReadOnly,
  Presets,
  type PromptClient,
  type ReadOnlyClient,
  type ReadOnlyContentClient,
  type SessionsReaderClient,
} from '../../../src/read-only.ts';

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// Each constant must be `true`: a resolved type that is not the entry's client type fails to compile.
// ConnectReadOnly has three overloads, so each one is checked by the call that selects it.
export async function connectResults(): Promise<void> {
  const client = await connect();
  const clientIsClient: Equal<typeof client, Client> = true;
  const admin = await connectAdmin();
  const adminIsAdmin: Equal<typeof admin, AdminClient> = true;
  const preset = await connectReadOnly({ preset: Presets.SessionsReader });
  const presetIsSessionsReader: Equal<typeof preset, SessionsReaderClient> = true;
  const content = await connectReadOnly({ content: true });
  const contentIsReadOnlyContent: Equal<typeof content, ReadOnlyContentClient> = true;
  const readOnly = await connectReadOnly();
  const readOnlyIsReadOnly: Equal<typeof readOnly, ReadOnlyClient> = true;
  const prompt = await connectPrompt();
  const promptIsPrompt: Equal<typeof prompt, PromptClient> = true;
  void [clientIsClient, adminIsAdmin, presetIsSessionsReader, contentIsReadOnlyContent, readOnlyIsReadOnly, promptIsPrompt];
}

// ErrorCode members are the literal wire codes, so a comparison with HerdrError.code type-checks.
const agentBlockedIsLiteral: Equal<typeof ErrorCode.AgentBlocked, 'agent_blocked'> = true;
void agentBlockedIsLiteral;
