// Role: CoreLink: one persistent connection to the core socket with hello, per-call timeouts, reconnect with capped backoff.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
import { createConnection } from 'node:net';
import type { Socket } from 'node:net';
import { parseCount, type Count } from './kernel.ts';
import { byKind, isErr, isOk, must, type KindMap } from './kernel.ts';
import type { Duration } from './kernel.ts';
import { parseText, type NonEmptyText, type Text } from './kernel.ts';
import { isUnknown, OutcomeKind, unknown, UnknownWhy, type Unknown } from './errors.ts';
import {
  HC_BACKOFF_BASE, HC_BACKOFF_CAP, HC_CLOSED, HC_CONNECTING, HC_DOWN, HC_DROPPED, HC_GENERATION, HC_HELLO_METHOD,
  HC_HELLO_TIMEOUT, HC_HELLO_UNREADABLE, HC_NO_CONNECTION, HC_ODD_RESULT, HcKind, LinkState, SocketEvent, TimerHold,
} from './constants.ts';
import { Backoff } from './backoff.ts';
import { HcCoreLines, encodeHcCoreRequest, parseHcCallId, parseHcCoreHello, parseHcCoreMessage, parseHcParams, parseWireChunk } from './wire.ts';
import type { HcCallId, HcCoreHello, HcCoreMessage, HcParams, HcPayload, SocketPath } from './wire.ts';

export interface HcAnswered {
  readonly kind: typeof OutcomeKind.Answer;
  readonly value: HcPayload;
}

export type HcCallResult = HcAnswered | Unknown;

export interface CoreLinkTiming {
  readonly helloTimeout: Duration;
  readonly backoffBase: Duration;
  readonly backoffCap: Duration;
}

export interface CoreLinkParts {
  readonly path: SocketPath;
  readonly timing?: CoreLinkTiming;
}

type Settle = (result: HcCallResult) => void;

const ZERO = must(parseCount(0));
const ONE = must(parseCount(1));
const HELLO_PARAMS: HcParams = must(parseHcParams({ generation: HC_GENERATION }));
const DEFAULT_TIMING: CoreLinkTiming = { helloTimeout: HC_HELLO_TIMEOUT, backoffBase: HC_BACKOFF_BASE, backoffCap: HC_BACKOFF_CAP };

const unreachable = (detail: Text): Unknown => unknown({ why: UnknownWhy.Unreachable, detail });
const timedOut = (after: Duration): Unknown => unknown({ why: UnknownWhy.Timeout, after });
const none = (): null => null;

const ANSWER_OF: KindMap<HcCoreMessage, HcCallResult | null> = {
  [HcKind.Reply]: (message) => ({ kind: OutcomeKind.Answer, value: message.result }),
  [HcKind.Odd]: () => unknown({ why: UnknownWhy.Unreadable, detail: HC_ODD_RESULT }),
  [HcKind.Fault]: (message) => unknown({ why: UnknownWhy.Failed, code: message.code, detail: `${message.reason}: ${message.message}` }),
  [HcKind.Event]: none,
  [HcKind.Heartbeat]: none,
  [HcKind.Missed]: none,
};

const ID_OF: KindMap<HcCoreMessage, HcCallId | null> = {
  [HcKind.Reply]: (message) => message.id,
  [HcKind.Odd]: (message) => message.id,
  [HcKind.Fault]: (message) => message.id,
  [HcKind.Event]: none,
  [HcKind.Heartbeat]: none,
  [HcKind.Missed]: none,
};

export class CoreLink {
  private readonly path: SocketPath;
  private readonly timing: CoreLinkTiming;
  private readonly pending = new Map<HcCallId, Settle>();
  private socket: Socket | null = null;
  private state: LinkState = LinkState.Idle;
  private connecting: Promise<Unknown | null> | null = null;
  private readonly backoff: Backoff;
  private issued: Count = ZERO;
  private info: HcCoreHello | null = null;

  constructor(parts: CoreLinkParts) {
    this.path = parts.path;
    this.timing = parts.timing ?? DEFAULT_TIMING;
    this.backoff = new Backoff(this.timing, TimerHold.LetsProcessEnd);
  }

  get hello(): HcCoreHello | null {
    return this.info;
  }

  open(): Promise<Unknown | null> {
    return this.ready();
  }

  call(method: NonEmptyText, params: HcParams, timeout: Duration): Promise<HcCallResult> {
    return new Promise<HcCallResult>((resolve) => {
      const timer = setTimeout(() => { resolve(timedOut(timeout)); }, timeout);
      timer.unref();
      void this.attempt(method, params, timeout).then((result) => {
        clearTimeout(timer);
        resolve(result);
        return result;
      });
    });
  }

  private async attempt(method: NonEmptyText, params: HcParams, timeout: Duration): Promise<HcCallResult> {
    const down = await this.ready();
    return down === null ? this.request(method, params, timeout) : down;
  }

  async close(): Promise<void> {
    this.state = LinkState.Closed;
    this.backoff.stop();
    this.settleAll(unreachable(HC_CLOSED));
    const socket = this.socket;
    if (socket === null) {
      return;
    }
    this.socket = null;
    await new Promise<void>((resolve) => { socket.once(SocketEvent.Close, () => { resolve(); }); socket.destroy(); });
  }

  private readonly readiness: Readonly<Record<LinkState, () => Promise<Unknown | null>>> = {
    [LinkState.Ready]: () => Promise.resolve(null),
    [LinkState.Connecting]: () => this.connecting ?? Promise.resolve(unreachable(HC_CONNECTING)),
    [LinkState.Backoff]: () => Promise.resolve(unreachable(HC_DOWN)),
    [LinkState.Closed]: () => Promise.resolve(unreachable(HC_CLOSED)),
    [LinkState.Idle]: () => this.connect(),
  };

  private ready(): Promise<Unknown | null> {
    return this.readiness[this.state]();
  }

  private connect(): Promise<Unknown | null> {
    this.state = LinkState.Connecting;
    const attempt = this.dial().finally(() => { this.connecting = null; });
    this.connecting = attempt;
    return attempt;
  }

  private dial(): Promise<Unknown | null> {
    return new Promise<Unknown | null>((resolve) => {
      const socket = createConnection(this.path);
      const lines = new HcCoreLines(() => { socket.destroy(); });
      let reason: Text = HC_DROPPED;
      this.socket = socket;
      socket.on(SocketEvent.Data, (chunk) => {
        const bytes = parseWireChunk(chunk);
        if (isOk(bytes)) {
          this.receive(lines.feed(bytes.value));
        }
      });
      socket.on(SocketEvent.Error, (cause) => { reason = must(parseText(cause.message)); });
      socket.on(SocketEvent.Close, () => { this.lost(socket); resolve(unreachable(reason)); });
      socket.once(SocketEvent.Connect, () => { void this.handshake(socket).then(resolve); });
    });
  }

  private async handshake(socket: Socket): Promise<Unknown | null> {
    const reply = await this.request(HC_HELLO_METHOD, HELLO_PARAMS, this.timing.helloTimeout);
    const refusal = this.takeHello(reply);
    if (refusal !== null) {
      socket.destroy();
      return refusal;
    }
    this.state = LinkState.Ready;
    this.backoff.survive();
    return null;
  }

  private takeHello(reply: HcCallResult): Unknown | null {
    if (isUnknown(reply)) {
      return reply;
    }
    const hello = parseHcCoreHello(reply.value);
    if (isErr(hello)) {
      return unknown({ why: UnknownWhy.Unreadable, detail: HC_HELLO_UNREADABLE });
    }
    if (hello.value.generation !== HC_GENERATION) {
      return unknown({ why: UnknownWhy.Unreadable, detail: `generation ${hello.value.generation}` });
    }
    this.info = hello.value;
    return null;
  }

  private request(method: NonEmptyText, params: HcParams, timeout: Duration): Promise<HcCallResult> {
    const socket = this.socket;
    if (socket === null || socket.destroyed) {
      return Promise.resolve(unreachable(HC_NO_CONNECTION));
    }
    this.issued = must(parseCount(this.issued + ONE));
    const id = must(parseHcCallId(this.issued));
    return new Promise<HcCallResult>((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve(timedOut(timeout)); }, timeout);
      timer.unref();
      this.pending.set(id, (result) => { clearTimeout(timer); resolve(result); });
      socket.write(encodeHcCoreRequest(id, method, params));
    });
  }

  private receive(values: readonly HcPayload[]): void {
    for (const value of values) {
      const parsed = parseHcCoreMessage(value);
      const id = isOk(parsed) ? byKind(ID_OF, parsed.value, undefined) : null;
      const answer = isOk(parsed) ? byKind(ANSWER_OF, parsed.value, undefined) : null;
      const settle = id === null ? undefined : this.pending.get(id);
      if (id !== null && settle !== undefined && answer !== null) {
        this.pending.delete(id);
        settle(answer);
      }
    }
  }

  private lost(socket: Socket): void {
    if (socket !== this.socket) {
      return;
    }
    this.socket = null;
    this.settleAll(unreachable(HC_DROPPED));
    if (this.state === LinkState.Closed) {
      return;
    }
    this.state = LinkState.Backoff;
    this.backoff.schedule(() => { void this.reconnect(); });
  }

  private reconnect(): Promise<Unknown | null> {
    return this.state === LinkState.Backoff ? this.connect() : Promise.resolve(null);
  }

  private settleAll(result: Unknown): void {
    const settles = [...this.pending.values()];
    this.pending.clear();
    for (const settle of settles) {
      settle(result);
    }
  }
}
