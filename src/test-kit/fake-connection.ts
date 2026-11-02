// Role: serves one client connection: reads request lines, answers each one, and ends the connection after the first answer.
// Informs HERDR-ADR-0016 (W1: close after every response, a second request is never answered; W3: an unparseable line gets the empty id and a close) and plan 5; test-kit only.
import type { Socket } from 'node:net';
import { AnswerKind, LINE_SEPARATOR, TEXT_ENCODING, WireField } from '../constants.ts';
import { isObject } from '../wire/envelope.ts';
import { LineSplitter } from '../wire/line-splitter.ts';
import { answerFor, invalidRequestAnswer, type Answer } from './fake-answer.ts';
import type { FakeScript } from './fake-script.ts';
import type { PongSettings } from './fake-pong.ts';

export interface ServingContext {
  readonly script: FakeScript;
  readonly pong: PongSettings;
}

interface ParsedRequest {
  readonly id: string;
  readonly method: string;
}

export function serveConnection(socket: Socket, context: ServingContext): void {
  const splitter = new LineSplitter();
  let finished = false;
  socket.setEncoding(TEXT_ENCODING);
  // A client may destroy its socket at any time; the fake must not crash on the write that follows.
  socket.on('error', () => undefined);
  socket.on('data', (chunk: string) => {
    for (const line of splitter.push(chunk)) {
      if (!finished) {
        finished = serveLine(socket, line, context);
      }
    }
  });
}

// Returns true when the connection has been answered and ended.
function serveLine(socket: Socket, line: string, context: ServingContext): boolean {
  const request = parseRequest(line);
  if (request === undefined) {
    return applyAnswer(socket, invalidRequestAnswer());
  }
  context.script.record(request.method);
  return applyAnswer(socket, answerFor(context.script, request.method, request.id, context.pong));
}

function applyAnswer(socket: Socket, answer: Answer): boolean {
  if (answer.kind === AnswerKind.Silent) {
    return false;
  }
  const text = answer.kind === AnswerKind.Raw ? answer.line : JSON.stringify(answer.body);
  writeText(socket, `${text}${LINE_SEPARATOR}`);
  socket.end();
  return true;
}

function writeText(socket: Socket, text: string): void {
  try {
    socket.write(text);
  } catch {
    // The client already went away; there is nobody left to answer.
  }
}

// A request is a JSON object; anything else is not a request.
function parseRequest(line: string): ParsedRequest | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isObject(parsed)) {
    return undefined;
  }
  const fields = parsed as Record<string, unknown>;
  return { id: String(fields[WireField.Id] ?? ''), method: String(fields[WireField.Method]) };
}
