// Role: createFakeHerdr(): a unix-socket server on node:net that speaks herdr's NDJSON request/response wire, with scripted answers, for tests only.
// Informs HERDR-ADR-0008 (test kit on node:net), HERDR-ADR-0016 (fake facts F1-F6; wire facts W1-W6) and plan 5 (the full fake API); test-kit only.
//
// Protocol facts this fake relies on, with the source that proves each one (hub test/fakes/fake-herdr-server.ts header):
//  F1  ping answers {id, result: {type: "pong", protocol, version}}. Source: generated/results.ts Result_pong. Implemented (fake-defaults).
//  F2  events.subscribe acks {id, result: {type: "subscription_started"}} on its own connection. Implemented (fake-ack).
//  F3  a refused request answers {id, error: {code, message}}. Source: generated/errors.ts ErrorBody. Implemented (fake-answer).
//  F4  after the ack, push frames are NDJSON lines {event, data} with no id. Implemented (fake-subscribers, spec matching in fake-subscription).
//  F5  one events.subscribe per connection; any close means resubscribe. Implemented (a subscriber takes no further request).
//  F6  a method the server has no answer for gets an error envelope. Code "unknown_method" is this fake's own value, not a herdr code. OPEN: herdr's own answer is not measured here.
//
// Wire facts of HERDR-ADR-0016 that this fake reproduces, each with a test in test/test-kit/wire-facts.test.ts:
//  W1  herdr closes after every response; a second request on the same connection is never answered. Class C (held) connections stay open (fake-held).
//  W2  after the ack, pushes arrive on the same connection as id-less lines. splitAck and strayLine are the test switches.
//  W3  an unparseable request gets {id: "", error} and then a close. The code and message are the fake's own values in constants.ts (not measured).
//  W4  api.schema over the socket answers {} (fake-defaults).
//  W5  no history is replayed after the ack (fake-ack writes nothing else).
//  W6  a per-pane subscription needs pane_id, else invalid_params and a close; a push reaches only the matching spec (fake-subscription).
//
// Test conveniences, not herdr behaviour: silent (accepted, never answered), rawReply (a raw line, then a close), replySequence (scripted steps)
// and holdPushes exist to drive client timeouts, malformed replies and ordering. Unscripted methods get no default answer except ping and api.schema,
// so F6 keeps working (test/wire/fake.test.ts). The fake never touches a real herdr: it listens on a temp socket that the caller owns through stop().
import { createServer, type Server, type Socket } from 'node:net';
import { PROTOCOL } from '../generated/index.ts';
import { AckSwitches } from './fake-ack.ts';
import { serveConnection, type ServingContext } from './fake-connection.ts';
import { HeldConnections } from './fake-held.ts';
import { advertisedCapabilities, type PongSettings } from './fake-pong.ts';
import { fakeSocketLocation, removeOwnedDir, type FakeSocketLocation } from './fake-socket-path.ts';
import { FakeScript } from './fake-script.ts';
import { Subscribers } from './fake-subscribers.ts';
import { Fake, WireFact } from '../constants.ts';
import type { CreateFakeHerdr, FakeHerdr, FakeHerdrOptions } from './types.ts';

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
