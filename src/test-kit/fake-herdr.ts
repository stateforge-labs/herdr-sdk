// Role: createFakeHerdr(): a unix-socket server on node:net that speaks herdr's NDJSON request/response wire, with scripted answers, for tests only.
// Informs HERDR-ADR-0008 (test kit on node:net; the hub fake used Bun.listen), HERDR-ADR-0016 (fake facts F1, F3, F6; wire facts W1 and W3) and plan 5 (the 2a minimum API).
//
// Protocol facts this fake relies on, with the source that proves each one (hub test/fakes/fake-herdr-server.ts header):
//  F1  ping answers {id, result: {type: "pong", protocol, version}}. Source: generated/results.ts Result_pong. Implemented.
//  F2  events.subscribe acks {id, result: {type: "subscription_started"}} on its own connection. Implemented (P5a).
//  F3  a refused request answers {id, error: {code, message}}. Source: generated/errors.ts ErrorBody. Implemented (fail).
//  F4  after the ack, push frames are NDJSON lines {event, data} with no id. Implemented (push); spec matching is not modelled.
//  F5  one events.subscribe per connection; any close means resubscribe. Implemented (a subscriber takes no further request).
//  F6  a method the server has no answer for gets an error envelope. Code "unknown_method" is this fake's own value, not a herdr code. OPEN.
//
// Wire facts of HERDR-ADR-0016 that this fake reproduces:
//  W1  herdr closes after every response; a second request on the same connection is never answered. Implemented, except class C (held) connections, which stay open and answer each request (HERDR-ADR-0016).
//  W2  after the ack, pushes arrive on the same connection as id-less lines. Implemented (splitAck, strayLine, holdPushes are the test switches).
//  W3  an unparseable request gets {id: "", error} and then a close. The fake's own code and message are the values in constants.ts (not measured). Implemented.
//
// Test conveniences, not herdr behaviour: silent (accepted, never answered) and rawReply (a raw line, then a close) exist to drive client timeouts and malformed replies.
// The fake never touches a real herdr: it listens on a temp socket that the caller owns through stop().
import { createServer, type Server, type Socket } from 'node:net';
import { PROTOCOL } from '../generated/index.ts';
import { serveConnection } from './fake-connection.ts';
import { advertisedCapabilities } from './fake-pong.ts';
import { fakeSocketLocation, removeOwnedDir, type FakeSocketLocation } from './fake-socket-path.ts';
import { FakeScript } from './fake-script.ts';
import { SubscriptionRegistry } from './fake-subscriptions.ts';
import { Fake, Lane, WireFact } from '../constants.ts';
import { notImplemented } from '../not-implemented.ts';
import type { CreateFakeHerdr, FakeHerdr, FakeHerdrOptions } from './types.ts';

export const createFakeHerdr: CreateFakeHerdr = async function createFakeHerdr(options: FakeHerdrOptions = {}): Promise<FakeHerdr> {
  const location = fakeSocketLocation(options.socketPath);
  const script = new FakeScript();
  const registry = new SubscriptionRegistry();
  const pong = {
    protocol: options.protocol ?? PROTOCOL,
    version: options.version ?? Fake.Version,
    capabilities: advertisedCapabilities(options.capabilities),
  };
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => {
      sockets.delete(socket);
    });
    serveConnection(socket, { script, pong, registry });
  });
  await listen(server, location.path);
  return handleFor(location, { script, registry }, sockets, server, pong.capabilities);
};

function handleFor(
  location: FakeSocketLocation,
  state: { readonly script: FakeScript; readonly registry: SubscriptionRegistry },
  sockets: ReadonlySet<Socket>,
  server: Server,
  capabilities: FakeHerdr['capabilities'],
): FakeHerdr {
  return {
    path: location.path,
    capabilities,
    reproduces: [WireFact.W1CloseAfterResponse, WireFact.W2AckThenStream, WireFact.W3EmptyIdOnUnparseable],
    reply(method, result) {
      state.script.setReply(method, result);
    },
    fail(method, error) {
      state.script.setFailure(method, error);
    },
    silent(method) {
      state.script.setSilent(method);
    },
    rawReply(method, line) {
      state.script.setRawLine(method, line);
    },
    receivedMethods() {
      return state.script.methods();
    },
    connectionCount() {
      return sockets.size;
    },
    replySequence: () => notImplemented('fake.replySequence', Lane.P5a),
    requests() {
      return state.script.requests();
    },
    push(frame) {
      state.registry.push(frame);
    },
    closeSubscribers() {
      state.registry.closeSubscribers();
    },
    subscriberCount() {
      return state.registry.subscriberCount();
    },
    holdPushes() {
      return state.registry.holdPushes();
    },
    splitAck() {
      state.registry.splitAck();
    },
    strayLine(line) {
      state.registry.strayLine(line);
    },
    heldCount() {
      return state.registry.heldCount();
    },
    closeHeld() {
      state.registry.closeHeld();
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
