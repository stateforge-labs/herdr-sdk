// Role: tests of the docs/api emitters (gen/emit-docs.ts) over the committed schema.
// Informs HERDR-ADR-0014 (executable docs) and plan sections 3.2 and 3.6 (the method and event references).
import { describe, expect, test } from 'bun:test';
import { emitEventsDoc, emitMethodsDoc } from '../../gen/emit-docs.ts';
import { GEN_PATHS, loadSchema } from '../../gen/schema.ts';

const schema = loadSchema(GEN_PATHS.schemaPath);
const methodsDoc = emitMethodsDoc(schema);
const eventsDoc = emitEventsDoc(schema);

// A method row has a class and a yes/no long-poll cell (the entry matrix has no such cells).
const METHOD_ROW = /^\| `[^`]+` \| `P\.[^`]+` \| .+ \| (R-meta|R-content|W|I|H|L|C|X|D|S) \| (yes|no) \| /gm;

describe('methods.md', () => {
  test('has one row per method', () => {
    expect(methodsDoc.match(METHOD_ROW)?.length).toBe(102);
  });

  test('carries the class counts footer', () => {
    expect(methodsDoc).toContain('| R-meta | 24 |');
    expect(methodsDoc).toContain('| W | 34 |');
  });

  test('shows the source of every result and no unmapped marker', () => {
    expect(methodsDoc).toContain('| Result tag | Source |');
    expect(methodsDoc).not.toContain('unmapped (phase 3)');
  });

  test('renders the same bytes twice', () => {
    expect(emitMethodsDoc(schema)).toBe(methodsDoc);
  });
});

describe('events.md', () => {
  test('lists the 26 kinds and 2 parameterised rows', () => {
    expect(eventsDoc).toContain('26 event kinds and 27 subscription types');
    expect(eventsDoc).toContain('| — | `pane.output_matched` |');
    expect(eventsDoc).toContain('| — | `pane.scroll_changed` |');
  });

  test('states the facts', () => {
    expect(eventsDoc).toContain('7 kinds are not awaitable');
    expect(eventsDoc).toContain('`pane_output_changed` has no subscription type');
    expect(eventsDoc).toContain('`pane_agent_status_changed` is in both shapes');
  });

  test('renders the same bytes twice', () => {
    expect(emitEventsDoc(schema)).toBe(eventsDoc);
  });
});
