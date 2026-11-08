// Role: CoreEvents: events.subscribe as a feed (snapshot, events, heartbeat watchdog, missed means a fresh snapshot).
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
import { createConnection } from 'node:net';
import type { Socket } from 'node:net';
import { byKind, isErr, isOk, must, type KindMap } from './kernel.ts';
import { AsyncQueue } from './kernel.ts';
import { duration, type Duration } from './kernel.ts';
import { Backoff } from './backoff.ts';
import { HC_BACKOFF_BASE, HC_BACKOFF_CAP, HC_HEARTBEAT_EVERY, HC_HEARTBEAT_MISSES, HC_SUBSCRIBE_METHOD, EventsPhase, HcKind, Life, RetryPhase, SocketEvent, TimerHold } from './constants.ts';
import { HcCoreLines, encodeHcCoreRequest, parseHcCallId, parseHcCoreMessage, parseHcParams, parseHcSnapshot, parseWireChunk } from './wire.ts';
import type { HcCoreMessage, HcEvent, HcHeartbeat, HcMissed, HcParams, HcPayload, HcSnapshot, SocketPath } from './wire.ts';

export interface HcSnapshotFeed {
  readonly kind: typeof HcKind.Snapshot;
  readonly snapshot: HcSnapshot;
}

export type HcCoreFeed = HcSnapshotFeed | HcMissed | HcHeartbeat | HcEvent;

export interface CoreEventsTiming {
  readonly backoffBase: Duration;
  readonly backoffCap: Duration;
  readonly silence: Duration;
}

export interface CoreEventsParts {
  readonly path: SocketPath;
  readonly filter?: HcParams;
  readonly timing?: CoreEventsTiming;
}

const SUBSCRIBE_ID = must(parseHcCallId(1));
const NO_FILTER: HcParams = must(parseHcParams({}));
const DEFAULT_TIMING: CoreEventsTiming = {
  backoffBase: HC_BACKOFF_BASE,
  backoffCap: HC_BACKOFF_CAP,
  silence: duration(HC_HEARTBEAT_EVERY * HC_HEARTBEAT_MISSES),
};

export class CoreEvents {
  readonly feed = new AsyncQueue<HcCoreFeed>();
  private readonly path: SocketPath;
  private readonly filter: HcParams;
  private readonly timing: CoreEventsTiming;
  private socket: Socket | null = null;
  private watchdog: NodeJS.Timeout | null = null;
  private readonly backoff: Backoff;
  private phase: EventsPhase = EventsPhase.Waiting;
  private life: Life = Life.Open;

  constructor(parts: CoreEventsParts) {
    this.path = parts.path;
    this.filter = parts.filter ?? NO_FILTER;
    this.timing = parts.timing ?? DEFAULT_TIMING;
    this.backoff = new Backoff(this.timing, TimerHold.HoldsProcess);
  }

  start(): void {
    if (this.socket === null && this.backoff.phase === RetryPhase.Idle && this.life === Life.Open) {
      this.connect();
    }
  }

  async close(): Promise<void> {
    this.life = Life.Closed;
    this.clearTimers();
    this.feed.end();
    const socket = this.socket;
    if (socket === null) {
      return;
    }
    this.socket = null;
    await new Promise<void>((resolve) => { socket.once(SocketEvent.Close, () => { resolve(); }); socket.destroy(); });
  }

  private connect(): void {
    const socket = createConnection(this.path);
    const lines = new HcCoreLines(() => { socket.destroy(); });
    this.socket = socket;
    this.phase = EventsPhase.Waiting;
    socket.on(SocketEvent.Data, (chunk) => {
      const bytes = parseWireChunk(chunk);
      this.arm(socket);
      if (isOk(bytes)) {
        this.receive(lines.feed(bytes.value), socket);
      }
    });
    socket.on(SocketEvent.Error, () => undefined);
    socket.on(SocketEvent.Close, () => { this.lost(socket); });
    socket.once(SocketEvent.Connect, () => {
      this.arm(socket);
      socket.write(encodeHcCoreRequest(SUBSCRIBE_ID, HC_SUBSCRIBE_METHOD, this.filter));
    });
  }

  private arm(socket: Socket): void {
    if (this.watchdog !== null) {
      clearTimeout(this.watchdog);
    }
    this.watchdog = setTimeout(() => { socket.destroy(); }, this.timing.silence);
    this.watchdog.unref();
  }

  private receive(values: readonly HcPayload[], socket: Socket): void {
    for (const value of values) {
      const parsed = parseHcCoreMessage(value);
      if (isErr(parsed)) {
        continue;
      }
      this.accept(parsed.value, socket);
    }
  }

  private readonly acceptors: KindMap<HcCoreMessage, void, Socket> = {
    [HcKind.Fault]: (_message, socket) => { socket.destroy(); },
    [HcKind.Odd]: (_message, socket) => { socket.destroy(); },
    [HcKind.Reply]: (message, socket) => { this.snapshotOf(message.result, socket); },
    [HcKind.Event]: (message) => { this.forward(message); },
    [HcKind.Heartbeat]: (message) => { this.forward(message); },
    [HcKind.Missed]: (message) => { this.forward(message); },
  };

  private accept(message: HcCoreMessage, socket: Socket): void {
    byKind(this.acceptors, message, socket);
  }

  private forward(feed: HcCoreFeed): void {
    if (this.phase === EventsPhase.Subscribed) {
      this.feed.push(feed);
    }
  }

  private snapshotOf(result: HcPayload, socket: Socket): void {
    const snapshot = parseHcSnapshot(result);
    if (isErr(snapshot) || this.phase === EventsPhase.Subscribed) {
      socket.destroy();
      return;
    }
    this.phase = EventsPhase.Subscribed;
    this.backoff.survive();
    this.feed.push({ kind: HcKind.Snapshot, snapshot: snapshot.value });
  }

  private lost(socket: Socket): void {
    if (socket !== this.socket) {
      return;
    }
    this.socket = null;
    this.clearTimers();
    if (this.life === Life.Closed) {
      return;
    }
    this.backoff.schedule(() => { this.connect(); });
  }

  private clearTimers(): void {
    if (this.watchdog !== null) {
      clearTimeout(this.watchdog);
    }
    this.watchdog = null;
    this.backoff.stop();
  }
}
