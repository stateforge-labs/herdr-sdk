// Role: hand-kept per-method overrides (long-poll timeouts, stream return kind, capability gates) and their schema checks.
// Informs HERDR-ADR-0007 (subscriptions and long-poll) and plan section 3.6; the capability names follow plan 3.1.
import { classOf, CapabilityClass } from './capabilities.ts';
import { resolveRef } from './resolve-ref.ts';
import type { ApiSchema, JSONSchema } from './schema.ts';
import { methodParamsName, namespaceOf, SCHEMA_DEF, SCHEMA_NAMESPACE } from './schema.ts';

export const Returns = { Subscription: 'Subscription' } as const;
export type Returns = (typeof Returns)[keyof typeof Returns];

// Capability names a method can be gated on (ServerCapabilities keys of the published schema).
export const ServerCapability = {
  DetachedServerDaemon: 'detached_server_daemon',
  EndpointProtocolGeneration: 'endpoint_protocol_generation',
  HealthCheck: 'health_check',
  LiveHandoff: 'live_handoff',
  SshAgentRegistration: 'ssh_agent_registration',
  SurfaceInterest: 'surface_interest',
} as const;
export type ServerCapability = (typeof ServerCapability)[keyof typeof ServerCapability];

export interface TimeoutBounds {
  readonly exclusiveMin: number;
  readonly max: number;
}

export interface Override {
  readonly requiredTimeoutPath?: readonly string[];   // params path made required in the namespace types
  readonly nestedTypes?: readonly string[];           // params type names along the path (for depth > 1)
  readonly onlyWhenPresent?: string;                  // agent.prompt: only when `wait` is given
  readonly timeoutBounds?: TimeoutBounds;
  readonly returns?: Returns;
  readonly capability?: ServerCapability;
}

export const OVERRIDES: Readonly<Record<string, Override>> = {
  'agent.wait': { requiredTimeoutPath: ['timeout_ms'] },
  'events.wait': { requiredTimeoutPath: ['timeout_ms'] },
  'pane.wait_for_output': { requiredTimeoutPath: ['timeout_ms'] },
  'agent.prompt': {
    requiredTimeoutPath: ['wait', 'timeout_ms'],
    nestedTypes: ['AgentPromptWaitOptions'],
    onlyWhenPresent: 'wait',
  },
  'agent.start': {
    requiredTimeoutPath: ['timeout_ms'],
    timeoutBounds: { exclusiveMin: 3000, max: 300000 },
  },
  'events.subscribe': { returns: Returns.Subscription },
  'server.ssh_agent.register': { capability: ServerCapability.SshAgentRegistration },
  'client_shell.surface.set': { capability: ServerCapability.SurfaceInterest },
  'server.live_handoff': { capability: ServerCapability.LiveHandoff },
};

// A method is long-poll when its class is L or it has a required timeout path.
export function isLongPoll(method: string, overrides: Readonly<Record<string, Override>> = OVERRIDES): boolean {
  return classOf(method) === CapabilityClass.L || overrides[method]?.requiredTimeoutPath !== undefined;
}

// Finds a property on a node, looking through anyOf/oneOf branches (`wait` is anyOf [ref, null]).
function propertyNode(schema: ApiSchema, node: JSONSchema, name: string): JSONSchema | undefined {
  const resolved = resolveRef(schema, node);
  const direct = resolved.properties?.[name];
  if (direct !== undefined) {
    return direct;
  }
  for (const branch of [...(resolved.anyOf ?? []), ...(resolved.oneOf ?? [])]) {
    const found = propertyNode(schema, branch, name);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

// The params definition of a method, looked up by the name its request branch refers to.
function paramsNodeOf(schema: ApiSchema, method: string): JSONSchema {
  const name = methodParamsName(schema, method);
  const definition = requestDefs(schema)[name];
  if (definition === undefined) {
    throw new Error(`params '${name}' of '${method}' is not in request.$defs`);
  }
  return definition;
}

function requestDefs(schema: ApiSchema): Readonly<Record<string, JSONSchema>> {
  return namespaceOf(schema, SCHEMA_NAMESPACE.request).$defs ?? {};
}

function assertPath(schema: ApiSchema, method: string, path: readonly string[]): void {
  let node = paramsNodeOf(schema, method);
  for (const segment of path) {
    const next = propertyNode(schema, node, segment);
    if (next === undefined) {
      throw new Error(`override path '${path.join('.')}' is not in the params of '${method}'`);
    }
    node = next;
  }
}

function assertNestedTypes(schema: ApiSchema, method: string, names: readonly string[]): void {
  const defs = requestDefs(schema);
  for (const name of names) {
    if (defs[name] === undefined) {
      throw new Error(`nested type '${name}' of '${method}' is not in request.$defs`);
    }
  }
}

// ServerCapabilities keys of the schema; every ServerCapability name must be one of them.
function assertCapabilityNames(schema: ApiSchema): void {
  const reply = schema.schemas[SCHEMA_NAMESPACE.successResponse]?.$defs?.[SCHEMA_DEF.serverCapabilities];
  const keys = Object.keys(reply?.properties ?? {});
  for (const name of Object.values(ServerCapability)) {
    if (!keys.includes(name)) {
      throw new Error(`capability '${name}' is not a ServerCapabilities key of the schema`);
    }
  }
}

// Checks every override against the schema and the method table. Throws on the first problem.
export function assertOverrides(
  schema: ApiSchema,
  methods: readonly string[],
  overrides: Readonly<Record<string, Override>> = OVERRIDES,
): void {
  assertCapabilityNames(schema);
  for (const [method, override] of Object.entries(overrides)) {
    if (!methods.includes(method)) {
      throw new Error(`override for '${method}', which is not a method`);
    }
    if (override.requiredTimeoutPath !== undefined) {
      assertPath(schema, method, override.requiredTimeoutPath);
    }
    if (override.nestedTypes !== undefined) {
      assertNestedTypes(schema, method, override.nestedTypes);
    }
    if (override.capability !== undefined && !Object.values(ServerCapability).includes(override.capability)) {
      throw new Error(`unknown capability '${override.capability}' on '${method}'`);
    }
    if (override.onlyWhenPresent !== undefined) {
      assertPath(schema, method, [override.onlyWhenPresent]);
    }
  }
}
