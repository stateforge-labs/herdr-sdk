// Role: createFakeHerdr(): a fake herdr on a temporary socket, serving each connection from the protocol in fake-protocol.ts.
// Informs HERDR-ADR-0016, plan 5, HERDR-ADR-0008; merged by HERDR-ADR-0021 from fake-connection.ts, fake-herdr.ts.
import { createServer } from 'node:net';
import type { Socket, Server } from 'node:net';
import { AnswerKind, EMPTY_REPLY_ID, ServedState, TEXT_ENCODING, WireField, Fake, WireFact } from '../../constants.ts';
import { Method, PROTOCOL } from '../generated/index.ts';
import { isObject, LineSplitter } from '../wire/codec.ts';
import { answerFor, errorAnswer, invalidRequestAnswer, AckSwitches, FakeScript, HeldConnections, isHeldMethod, specsOf, subscribeRefusal, Subscribers, endSocket, lineOf, safeWrite, fieldOf, isText, advertisedCapabilities, fakeSocketLocation, removeOwnedDir } from './fake-protocol.ts';
import type { Answer, PongSettings, FakeSocketLocation } from './fake-protocol.ts';
import type { ReceivedRequest, CreateFakeHerdr, FakeHerdr, FakeHerdrOptions } from './types.ts';

// What every connection of one fake shares.
export interface ServingContext {
  readonly script: FakeScript;
  readonly pong: PongSettings;
  readonly subscribers: Subscribers;
  readonly acks: AckSwitches;
  readonly held: HeldConnections;
}

export function serveConnection(socket: Socket, context: ServingContext): void {
  const splitter = new LineSplitter();
  let state: ServedState = ServedState.Fresh;
  socket.setEncoding(TEXT_ENCODING);
  // A client may destroy its socket at any time; the fake must not crash on the write that follows.
  socket.on('error', () => undefined);
  socket.on('close', () => {
    context.subscribers.forget(socket);
    context.held.forget(socket);
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
    writeAndEnd(socket, invalidRequestAnswer(), context);
    return ServedState.Answered;
  }
  context.script.record(request);
  if (request.method === Method.EventsSubscribe && !context.script.hasScriptedOutcome(request.method)) {
    return subscribe(socket, request, context);
  }
  const answer = answerFor(context.script, request, context.pong);
  return finish(socket, answer, state, context, request.method);
}

// An events.subscribe is refused (W6: invalid_params, then the connection ends) or acknowledged, and then the connection carries pushes (W2).
function subscribe(socket: Socket, request: ReceivedRequest, context: ServingContext): ServedState {
  const refusal = subscribeRefusal(request.params);
  if (refusal !== undefined) {
    writeAndEnd(socket, errorAnswer(request.id, refusal), context);
    return ServedState.Answered;
  }
  context.held.forget(socket);
  context.acks.acknowledge(socket, request.id);
  context.subscribers.add(socket, specsOf(request.params));
  return ServedState.Subscriber;
}

// Writes the answer. A result for a class C method (or on a held connection) keeps the connection open as held; anything else ends it (W1).
// An error envelope always ends it: how herdr treats a refused class C request is not measured; the fake takes the conservative reading and ends the connection.
function finish(socket: Socket, answer: Answer, state: ServedState, context: ServingContext, method: string): ServedState {
  if (answer.kind === AnswerKind.Silent) {
    return state;
  }
  writeAnswer(socket, answer);
  const keepsOpen = answer.kind === AnswerKind.Envelope && WireField.Result in answer.body && (state === ServedState.Held || isHeldMethod(method));
  if (!keepsOpen) {
    closeConnection(socket, context);
    return ServedState.Answered;
  }
  context.held.add(socket);
  return ServedState.Held;
}

function writeAndEnd(socket: Socket, answer: Answer, context: ServingContext): void {
  writeAnswer(socket, answer);
  closeConnection(socket, context);
}

// Ends the connection from the server side and leaves the held set at once, so heldCount() never counts a connection the client has already lost.
function closeConnection(socket: Socket, context: ServingContext): void {
  context.held.forget(socket);
  endSocket(socket);
}

// A silent answer writes nothing; a raw answer is written as it is; an envelope is serialised.
function writeAnswer(socket: Socket, answer: Answer): void {
  if (answer.kind === AnswerKind.Silent) {
    return;
  }
  safeWrite(socket, lineOf(answer.kind === AnswerKind.Raw ? answer.line : answer.body));
}

// A request is a JSON object with a string method; anything else is not a request.
function parseRequest(line: string): ReceivedRequest | undefined {
  const parsed = parseJson(line);
  if (!isObject(parsed)) {
    return undefined;
  }
  const method = fieldOf(parsed, WireField.Method);
  if (!isText(method)) {
    return undefined;
  }
  const id = fieldOf(parsed, WireField.Id);
  return { id: isText(id) ? id : EMPTY_REPLY_ID, method, params: fieldOf(parsed, WireField.Params) };
}

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

export const createFakeHerdr: CreateFakeHerdr = async function createFakeHerdr(options: FakeHerdrOptions = {}): Promise<FakeHerdr> {
  const location = fakeSocketLocation(options.socketPath);
  const pong: PongSettings = {
    protocol: options.protocol ?? PROTOCOL,
    version: options.version ?? Fake.Version,
    capabilities: advertisedCapabilities(options.capabilities),
  };
  const context: ServingContext = {
    script: new FakeScript(),
    pong,
    subscribers: new Subscribers(),
    acks: new AckSwitches(),
    held: new HeldConnections(),
  };
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => {
      sockets.delete(socket);
    });
    serveConnection(socket, context);
  });
  await listen(server, location.path);
  return handleFor(location, context, sockets, server);
};

function handleFor(location: FakeSocketLocation, context: ServingContext, sockets: ReadonlySet<Socket>, server: Server): FakeHerdr {
  const { script, subscribers, acks, held } = context;
  return {
    path: location.path,
    capabilities: context.pong.capabilities,
    reproduces: [
      WireFact.W1CloseAfterResponse,
      WireFact.W2AckThenStream,
      WireFact.W3EmptyIdOnUnparseable,
      WireFact.W4SchemaOverSocketIsEmpty,
      WireFact.W5NoHistoryReplay,
      WireFact.W6PerPaneNeedsPaneId,
    ],
    reply(method, result) {
      script.setReply(method, result);
    },
    fail(method, error) {
      script.setFailure(method, error);
    },
    silent(method) {
      script.setSilent(method);
    },
    rawReply(method, line) {
      script.setRawLine(method, line);
    },
    replySequence(method, steps) {
      script.setSequence(method, steps);
    },
    receivedMethods() {
      return script.methods();
    },
    requests() {
      return script.requests();
    },
    connectionCount() {
      return sockets.size;
    },
    push(frame) {
      subscribers.push(frame);
    },
    closeSubscribers() {
      subscribers.closeAll();
    },
    subscriberCount() {
      return subscribers.count();
    },
    holdPushes() {
      return subscribers.holdPushes();
    },
    splitAck() {
      acks.splitNextAck();
    },
    strayLine(line) {
      acks.strayBeforeAck(line);
    },
    heldCount() {
      return held.count();
    },
    closeHeld() {
      held.closeAll();
    },
    async stop() {
      for (const socket of sockets) {
        socket.destroy();
      }
      await close(server);
      removeOwnedDir(location);
    },
  };
}

function listen(server: Server, path: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(path, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}
