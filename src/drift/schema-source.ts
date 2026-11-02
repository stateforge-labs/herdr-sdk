// Role: schema sources as pure factories: the committed copy and the installed herdr, each with its reader or runner injected. No I/O here.
// Informs HERDR-ADR-0009 (a missing herdr or copy is NotFound, an unreadable one is Unreadable; both exit 3) and HERDR-ADR-0008 (the runner is the CLI, never the socket).
import { join } from 'node:path';
import { SchemaReadKind } from '../constants.ts';
import {
  HerdrCommand,
  ReasonText,
  SchemaField,
  SchemaFileName,
  SystemErrorCode,
  VERSION_PATTERN,
  VersionFileField,
} from './constants.ts';
import { isNode, isNumber, isString } from './schema-walk.ts';
import type { SchemaRead, SchemaSource } from './types.ts';

// Reads one file as text; throws when it is absent.
export type ReadText = (path: string) => string;

// Runs the herdr CLI with arguments and returns its stdout; throws when it fails (a missing binary carries code ENOENT).
export type RunHerdr = (args: readonly string[]) => string;

export function committedSource(dir: string, readText: ReadText): SchemaSource {
  return async () => {
    let schemaText: string;
    let versionText: string;
    try {
      schemaText = readText(join(dir, SchemaFileName.Schema));
    } catch (error) {
      return readFailure(error, ReasonText.CommittedMissing, ReasonText.CommittedUnreadable);
    }
    try {
      versionText = readText(join(dir, SchemaFileName.Version));
    } catch (error) {
      return readFailure(error, ReasonText.VersionMissing, ReasonText.VersionFileUnreadable);
    }
    const version = committedVersionOf(versionText);
    return version === null ? unreadable(ReasonText.VersionUnreadable) : parseSchemaText(schemaText, version);
  };
}

export function installedSource(runHerdr: RunHerdr): SchemaSource {
  return async () => {
    let schemaText: string;
    let versionText: string;
    try {
      schemaText = runHerdr(HerdrCommand.SchemaJson);
    } catch (error) {
      return readFailure(error, ReasonText.HerdrMissing, ReasonText.HerdrRefused);
    }
    try {
      versionText = runHerdr(HerdrCommand.Version);
    } catch (error) {
      return readFailure(error, ReasonText.HerdrMissing, ReasonText.HerdrVersionMissing);
    }
    const version = herdrVersionOf(versionText);
    return version === null ? unreadable(ReasonText.HerdrVersionMissing) : parseSchemaText(schemaText, version);
  };
}

// Reads schema JSON text; the herdr version comes from the caller. A schema without a protocol number is Unreadable.
export function parseSchemaText(text: string, herdrVersion: string): SchemaRead {
  const parsed = tryParse(text);
  if (parsed === undefined) {
    return unreadable(ReasonText.NotJson);
  }
  if (!isNode(parsed) || !isNumber(parsed[SchemaField.Protocol])) {
    return unreadable(ReasonText.NoProtocol);
  }
  return { kind: SchemaReadKind.Found, schema: parsed, herdrVersion };
}

// A missing file or executable (code ENOENT) is NotFound; any other failure to read is Unreadable.
function readFailure(error: unknown, missingReason: string, failedReason: string): SchemaRead {
  const code = isNode(error) ? error.code : undefined;
  return code === SystemErrorCode.NotFound ? notFound(missingReason) : unreadable(failedReason);
}

function committedVersionOf(text: string): string | null {
  const parsed = tryParse(text);
  const version = isNode(parsed) ? parsed[VersionFileField.Version] : undefined;
  return isString(version) ? version : null;
}

function herdrVersionOf(text: string): string | null {
  const match = VERSION_PATTERN.exec(text);
  return match?.[0] ?? null;
}

// JSON.parse never yields undefined, so undefined marks a text that is not JSON.
function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function notFound(reason: string): SchemaRead {
  return { kind: SchemaReadKind.NotFound, reason };
}

function unreadable(reason: string): SchemaRead {
  return { kind: SchemaReadKind.Unreadable, reason };
}
