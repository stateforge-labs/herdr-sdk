// Role: builds small hand-made schema documents for the drift tests; options change one facet at a time.
// Informs HERDR-ADR-0009 (drift tests use fakes, never the real herdr; HERDR-ADR-0008) and HERDR-ADR-0017 (fixtures are the lane's own test support).
import type { SchemaDocument } from '../../../src/drift/types.ts';

export interface MiniOptions {
  readonly protocol?: number;
  readonly methods?: readonly string[];
  readonly results?: readonly string[];
  readonly events?: readonly string[];
  readonly subscriptions?: readonly string[];
  readonly limitType?: string;
}

const DEFAULTS = {
  protocol: 22,
  methods: ['ping', 'workspace.list'],
  results: ['pong', 'workspace_list'],
  events: ['workspace_created'],
  subscriptions: ['workspace.created', 'pane.output_matched'],
  limitType: 'integer',
} as const;

export function miniSchema(options: MiniOptions = {}): SchemaDocument {
  const chosen = { ...DEFAULTS, ...options };
  return {
    protocol: chosen.protocol,
    schema_version: 1,
    schemas: {
      request: {
        oneOf: chosen.methods.map(methodBranch),
        $defs: {
          Params: { type: 'object', properties: { limit: { type: chosen.limitType } } },
          Subscription: { oneOf: chosen.subscriptions.map(typeBranch) },
        },
      },
      success_response: {
        $defs: {
          Result: { type: 'object' },
          ResponseResult: { oneOf: chosen.results.map(typeBranch) },
        },
      },
      event: {
        $defs: { EventData: { oneOf: chosen.events.map(typeBranch) } },
      },
    },
  };
}

function methodBranch(method: string) {
  return {
    properties: { method: { const: method, type: 'string' }, params: { $ref: '#/schemas/request/$defs/Params' } },
    required: ['method', 'params'],
    type: 'object',
  };
}

function typeBranch(type: string) {
  return { properties: { type: { const: type, type: 'string' } }, required: ['type'], type: 'object' };
}
