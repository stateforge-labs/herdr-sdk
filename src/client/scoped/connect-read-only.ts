// Role: connectReadOnly(): structure reads and long-poll by default; terminal content with { content: true }; a named preset, or a method list, narrows at runtime.
// Informs HERDR-ADR-0005 (read-only defaults to structure), plan 3.4 (presets, methods), plan 10.1 steps 2 and 3 (imports only the lists it needs) and HERDR-ADR-0017; contract in client/types.ts (ConnectReadOnly).
import { EntryKey, Presets, type Preset } from '../../constants.ts';
import type { Method } from '../../generated/index.ts';
import { READ_ONLY_CONTENT_METHODS } from '../../generated/entries/read-only-content.ts';
import { READ_ONLY_METHODS } from '../../generated/entries/read-only.ts';
import { SESSIONS_READER_METHODS } from '../../generated/presets/sessions-reader.ts';
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
import { lazyStreams } from './lazy-streams.ts';

// The preset lists this entry can name. Only the list of each preset is imported, not the table of every entry.
const PRESET_LISTS: Readonly<Record<Preset, readonly Method[]>> = {
  [Presets.SessionsReader]: SESSIONS_READER_METHODS,
};

// The three overloads of ConnectReadOnly share this one implementation; the options a caller passes pick the overload.
type ReadOnlyFormOptions = ReadOnlyOptions & { readonly preset?: Preset | undefined };
type ReadOnlyAnyClient = ReadOnlyClient | ReadOnlyContentClient | SessionsReaderClient;

async function connectReadOnlyForm(options: ReadOnlyFormOptions = {}): Promise<ReadOnlyAnyClient> {
  const core = await connectCore(options);
  if (options.preset !== undefined) {
    return composeOrClose<SessionsReaderClient>(
      core,
      allowedMethods(PRESET_LISTS[options.preset]),
      PRESET_MEMBERS,
      lazyStreams(core),
    );
  }
  const entry = options.content === true ? EntryKey.readOnlyContent : EntryKey.readOnly;
  const base = entry === EntryKey.readOnlyContent ? READ_ONLY_CONTENT_METHODS : READ_ONLY_METHODS;
  const allowed = allowedMethods(base, options.methods === undefined ? {} : { methods: options.methods });
  return composeOrClose<ReadOnlyClient | ReadOnlyContentClient>(core, allowed, ENTRY_MEMBERS[entry], lazyStreams(core));
}

// One implementation for the three overloads: the union return is narrowed by the overload the caller's options match.
export const connectReadOnly: ConnectReadOnly = connectReadOnlyForm as ConnectReadOnly;
