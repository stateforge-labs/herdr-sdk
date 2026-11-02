// Role: lane-local constants of schema drift: schema bundle and definition names, facet labels, reason texts, herdr calls and CLI flags.
// Informs HERDR-ADR-0009 (drift) and HERDR-ADR-0017 (lane P5c owns src/drift/**). As const objects, so no string literal is compared in code. The exit codes and outcome kinds stay in the root constants.ts.

export const DriftName = 'herdr-drift';

export const DriftErrorName = { Malformed: 'MalformedSchemaError' } as const;

export const SchemaField = { Protocol: 'protocol', Schemas: 'schemas' } as const;

// The three bundles of the published schema that drift reads (schemas.<bundle>).
export const SchemaNamespace = {
  Request: 'request',
  SuccessResponse: 'success_response',
  Event: 'event',
} as const;

// Named definitions drift looks up inside a bundle.
export const SchemaDefinition = {
  ResponseResult: 'ResponseResult',
  EventData: 'EventData',
  Subscription: 'Subscription',
} as const;

// Keywords and property names read inside schema nodes.
export const SchemaKey = {
  Defs: '$defs',
  OneOf: 'oneOf',
  Properties: 'properties',
  Const: 'const',
  Description: 'description',
} as const;

// The property that names a branch of a tagged union: a request method or a result, event or subscription type.
export const TagProperty = { Method: 'method', Type: 'type' } as const;

// Labels of the facets in the human report (HERDR-ADR-0009).
export const DriftFacet = {
  Methods: 'methods',
  ResultTags: 'result tags',
  EventKinds: 'event kinds',
  SubscriptionTypes: 'subscribable types',
} as const;

// JavaScript typeof results, so no string literal is compared in code.
export const JsType = { Object: 'object', String: 'string', Number: 'number' } as const;

// The one system error code drift reads: a missing executable (`herdr` not on PATH).
export const SystemErrorCode = { NotFound: 'ENOENT' } as const;

// Files of the committed schema directory (`schema/`, written by `bun run capture`).
export const SchemaFileName = { Schema: 'herdr-api.schema.json', Version: 'herdr-version.json' } as const;
export const VersionFileField = { Version: 'version' } as const;

// The herdr CLI calls drift makes. They run only in bin/herdr-drift.ts, never against the socket (HERDR-ADR-0008).
export const HerdrCommand = {
  Version: ['--version'],
  SchemaJson: ['api', 'schema', '--json'],
} as const;

export const HerdrCall = { TimeoutMs: 60_000 } as const;

// A semantic version inside the text `herdr --version` prints.
export const VERSION_PATTERN = /\d+\.\d+\.\d+/;

export const DEFAULT_HERDR_BIN = 'herdr';

export const ArgFlag = {
  Committed: '--committed',
  Herdr: '--herdr',
  Json: '--json',
  Help: '--help',
} as const;

export const ArgsKind = { Run: 'run', Help: 'help', Usage: 'usage' } as const;

// Why a source could not look (exit 3, HERDR-ADR-0009).
export const ReasonText = {
  CommittedMissing: 'the committed schema is not there',
  CommittedUnreadable: 'the committed schema could not be read',
  VersionMissing: 'the committed herdr-version.json is not there',
  VersionFileUnreadable: 'the committed herdr-version.json could not be read',
  VersionUnreadable: 'the committed herdr-version.json carries no version',
  NotJson: 'the schema is not JSON',
  NoProtocol: 'the schema carries no protocol number',
  HerdrMissing: 'herdr is not on PATH, so the live schema cannot be read',
  HerdrRefused: 'herdr did not return a schema',
  HerdrVersionMissing: 'herdr did not report a version',
} as const;

export const UsageText = {
  Unexpected: (argument: string) => `unexpected argument '${argument}'`,
  MissingValue: (flag: string) => `${flag} needs a value`,
} as const;
