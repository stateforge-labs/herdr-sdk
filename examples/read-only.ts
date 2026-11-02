// Role: README section 3 as a compiled example: a read-only client from the SessionsReader preset, and the write that does not compile on it.
// Informs HERDR-ADR-0014 (executable docs) and plan 8; the read-only entry is /read-only.
import { connectReadOnly, Presets } from '../src/read-only.ts';

const herdr = await connectReadOnly({ preset: Presets.SessionsReader }); // session.snapshot, agent.list, agent.get, pane.get, pane.list
const snapshot = await herdr.session.snapshot({});
console.log(snapshot);
// @ts-expect-error a read-only client has no write methods and no generic call()
await herdr.agent.prompt({ target: 'x', text: 'y' });
