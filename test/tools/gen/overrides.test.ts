// Role: tests of the hand-kept overrides (tools/gen/overrides.ts): paths, nested types, capability names and agent.start bounds.
// Informs HERDR-ADR-0007 and plan section 3.6; the bad inputs are passed in directly, not as fixture files.
import { describe, expect, test } from 'bun:test';
import { assertOverrides, OVERRIDES, ServerCapability } from '../../../tools/gen/overrides.ts';
import type { Override } from '../../../tools/gen/overrides.ts';
import { methodNames } from '../../../tools/gen/emit-method-table.ts';
import { GEN_PATHS, loadSchema } from '../../../tools/gen/schema.ts';

const schema = loadSchema(GEN_PATHS.schemaPath);
const methods = methodNames(schema);

describe('committed overrides', () => {
  test('every override key is a method and every check passes', () => {
    for (const method of Object.keys(OVERRIDES)) {
      expect(methods).toContain(method);
    }
    expect(() => assertOverrides(schema, methods)).not.toThrow();
  });

  test('agent.start bounds are 3000 exclusive and 300000 maximum', () => {
    expect(OVERRIDES['agent.start']?.timeoutBounds).toEqual({ exclusiveMin: 3000, max: 300000 });
  });

  test('the three capability gates name ServerCapabilities keys', () => {
    expect(OVERRIDES['server.ssh_agent.register']?.capability).toBe(ServerCapability.SshAgentRegistration);
    expect(OVERRIDES['client_shell.surface.set']?.capability).toBe(ServerCapability.SurfaceInterest);
    expect(OVERRIDES['server.live_handoff']?.capability).toBe(ServerCapability.LiveHandoff);
  });
});

describe('bad overrides are refused', () => {
  const withOverride = (method: string, override: Override): Readonly<Record<string, Override>> => ({ [method]: override });

  test('a path segment that is not in the params throws', () => {
    const bad = withOverride('agent.wait', { requiredTimeoutPath: ['no_such_field'] });
    expect(() => assertOverrides(schema, methods, bad)).toThrow("override path 'no_such_field' is not in the params of 'agent.wait'");
  });

  test('a nested type name that is not in request.$defs throws', () => {
    const bad = withOverride('agent.prompt', { requiredTimeoutPath: ['wait', 'timeout_ms'], nestedTypes: ['NoSuchType'] });
    expect(() => assertOverrides(schema, methods, bad)).toThrow("nested type 'NoSuchType'");
  });

  test('an unknown capability name throws', () => {
    const bad = withOverride('ping', { capability: 'not_a_capability' as ServerCapability });
    expect(() => assertOverrides(schema, methods, bad)).toThrow("unknown capability 'not_a_capability' on 'ping'");
  });

  test('an override for a name that is not a method throws', () => {
    const bad = withOverride('no.such.method', { requiredTimeoutPath: ['timeout_ms'] });
    expect(() => assertOverrides(schema, methods, bad)).toThrow("override for 'no.such.method'");
  });
});
