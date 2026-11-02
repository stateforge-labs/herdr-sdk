// Role: serves one client connection: answers each request line, and keeps the connection open only where herdr does (a subscription after its ack, a held connection after each answer).
// Informs HERDR-ADR-0016 (W1: close after every response except subscribe and class C; W2: ack then id-less pushes; W3: an unparseable line gets the empty id and a close) and plan 5; test-kit only.
import type { Socket } from 'node:net';
import { AnswerKind, EntryKey, LINE_SEPARATOR, ServedState, TEXT_ENCODING, WireField } from '../constants.ts';
import { ENTRY_METHODS, Method } from '../generated/index.ts';
import { isObject } from '../wire/envelope.ts';
import { LineSplitter } from '../wire/line-splitter.ts';
import { answerFor, invalidRequestAnswer, type Answer } from './fake-answer.ts';
import type { FakeScript } from './fake-script.ts';
import type { PongSettings } from './fake-pong.ts';
import type { SubscriptionRegistry } from './fake-subscriptions.ts';
import type { ReceivedRequest } from './types.ts';

export interface ServingContext {
  readonly script: FakeScript;
  readonly pong: PongSettings;
  readonly registry: SubscriptionRegistry;
}

export function serveConnection(socket: Socket, context: ServingContext): void {
  const splitter = new LineSplitter();
  let state: ServedState = ServedState.Fresh;
  socket.setEncoding(TEXT_ENCODING);
  // A client may destroy its socket at any time; the fake must not crash on the write that follows.
  socket.on('error', () => undefined);
  socket.on('close', () => {
    context.registry.forget(socket);
  });
  socket.on('data', (chunk: string) => {
    for (const line of splitter.push(chunk)) {
      state = serveLine(socket, line, state, context);
    }
  });
}

// Returns the state of the connection after this line. A subscriber and an answered connection take no more requests.
function serveLine(socket: Socket, line: string, state: ServedState, context: ServingContext): ServedState {
  if (state === ServedState.Answered || state === ServedState.Subscriber) {
    return state;
  }
  const request = parseRequest(line);
  if (request === undefined) {
    // W3: the unparseable line gets the empty id and the connection ends, even when it was held.
    writeAndEnd(socket, invalidRequestAnswer());
    return ServedState.Answered;
  }
  context.script.record(request);
  if (request.method === Method.EventsSubscribe && !context.script.hasScriptedOutcome(request.method)) {
    context.registry.acknowledge(socket, request.id);
    return ServedState.Subscriber;
  }
  const answer = answerFor(context.script, request.method, request.id, context.pong);
  return finish(socket, answer, state, context, request.method);
}

// Writes the answer. An envelope for a class C method (or on a held connection) keeps the connection open as held; anything else ends it.
function finish(socket: Socket, answer: Answer, state: ServedState, context: ServingContext, method: string): ServedState {
  if (answer.kind === AnswerKind.Silent) {
    return state;
  }
  writeLine(socket, answer);
  const keepsOpen = answer.kind === AnswerKind.Envelope && (state === ServedState.Held || isHeldMethod(method));
  if (!keepsOpen) {
    socket.end();
    return ServedState.Answered;
  }
  if (state !== ServedState.Held) {
    context.registry.addHeld(socket);
  }
  return ServedState.Held;
}

function writeAndEnd(socket: Socket, answer: Answer): void {
  writeLine(socket, answer);
  socket.end();
}

// A silent answer writes nothing.
function writeLine(socket: Socket, answer: Answer): void {
  if (answer.kind === AnswerKind.Silent) {
    return;
  }
  const text = answer.kind === AnswerKind.Raw ? answer.line : JSON.stringify(answer.body);
  writeText(socket, `${text}${LINE_SEPARATOR}`);
}

// The class C methods: the connection-bound ones (ENTRY_METHODS.held), which herdr keeps open after the answer.
function isHeldMethod(method: string): boolean {
  return (ENTRY_METHODS[EntryKey.held] as readonly string[]).includes(method);
}

function writeText(socket: Socket, text: string): void {
  try {
    socket.write(text);
  } catch {
    // The client already went away; there is nobody left to answer.
  }
}

// A request is a JSON object; anything else is not a request.
function parseRequest(line: string): ReceivedRequest | undefined {
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
  return {
    id: String(fields[WireField.Id] ?? ''),
    method: String(fields[WireField.Method]),
    params: fields[WireField.Params],
  };
}
