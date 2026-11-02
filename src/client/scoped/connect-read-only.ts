// Role: connectReadOnly(): structure reads and long-poll by default; terminal content with { content: true }; a named preset, or a method list, narrows at runtime.
// Informs HERDR-ADR-0005 (read-only defaults to structure), plan 3.4 (presets, methods) and HERDR-ADR-0017; contract in client/types.ts (ConnectReadOnly).
import { EntryKey, type Preset } from '../../constants.ts';
import { connectCore } from '../connect-core.ts';
import type {
  ConnectReadOnly,
  ReadOnlyClient,
  ReadOnlyContentClient,
  ReadOnlyOptions,
  SessionsReaderClient,
} from '../types.ts';
import { allowedMethods } from './allowed-methods.ts';
import { composeOrClose, ENTRY_MEMBERS, PRESET_MEMBERS } from './compose.ts';

// The three overloads of ConnectReadOnly share this one implementation; the options a caller passes pick the overload.
type ReadOnlyFormOptions = ReadOnlyOptions & { readonly preset?: Preset | undefined };
type ReadOnlyAnyClient = ReadOnlyClient | ReadOnlyContentClient | SessionsReaderClient;

async function connectReadOnlyForm(options: ReadOnlyFormOptions = {}): Promise<ReadOnlyAnyClient> {
  const core = await connectCore(options);
  if (options.preset !== undefined) {
    return composeOrClose<SessionsReaderClient>(
      core,
      allowedMethods(EntryKey.readOnly, { preset: options.preset }),
      PRESET_MEMBERS,
    );
  }
  const entry = options.content === true ? EntryKey.readOnlyContent : EntryKey.readOnly;
  const allowed =
    options.methods === undefined ? allowedMethods(entry) : allowedMethods(entry, { methods: options.methods });
  return composeOrClose<ReadOnlyClient | ReadOnlyContentClient>(core, allowed, ENTRY_MEMBERS[entry]);
}

// One implementation for the three overloads: the union return is narrowed by the overload the caller's options match.
export const connectReadOnly: ConnectReadOnly = connectReadOnlyForm as ConnectReadOnly;
