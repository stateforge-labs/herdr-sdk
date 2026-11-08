// Role: FakeHcCore, a scripted herdr-core on a temporary unix socket: hello, terminal.list/get/read, events with heartbeats, missed, drops and slow or silent replies.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
import { createServer } from 'node:net';
import type { Server, Socket } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RECORDED_FRAMES } from './frames.ts';
import { brand, isString } from '../kernel.ts';
import { EMPTY_TEXT, HC_GET_METHOD, HC_HELLO_METHOD, HC_JSONRPC_VERSION, HC_LINE_SEPARATOR, HC_LIST_METHOD, HC_READ_METHOD, HC_SUBSCRIBE_METHOD, HcField, HcNotificationMethod, JsType, SocketEvent, UTF8 } from '../constants.ts';
import { DemoTerminal, FakeFaultKind, FakeField, FakeName, FakeRpcCode, FakeScreen, FakeText, FrameName, SPLIT_AT, SPLIT_DELAY } from './constants.ts';
import type { SocketPath } from '../wire.ts';

type Fields = Record<string, unknown>;
export type Handler = (params: Fields) => unknown;
type Serve = (socket: Socket, params: Fields) => unknown;


export class FakeFault {
  readonly code: number;
  readonly kind: string;
  readonly message: string;

  constructor(code: number, kind: string, message: string) {
    this.code = code;
    this.kind = kind;
    this.message = message;
  }
}

export interface Seen {
  readonly method: string;
  readonly params: Fields;
  readonly connection: number;
}

const isFields = (input: unknown): input is Fields => typeof input === JsType.Object && input !== null && !Array.isArray(input);
const loaded: unknown = RECORDED_FRAMES;

export function frame(name: string): Fields {
  const found = isFields(loaded) ? loaded[name] : undefined;
  if (!isFields(found)) {
    throw new FakeFault(FakeRpcCode.NotFound, FakeFaultKind.NotFound, FakeText.NoFrame(name));
  }
  return found;
}

const section = (source: Fields, key: string): Fields => {
  const found = source[key];
  return isFields(found) ? found : {};
};

const listOf = (source: Fields, key: string): unknown[] => {
  const found = source[key];
  return Array.isArray(found) ? found : [];
};

const dataOf = (name: string): Fields => section(section(frame(name), HcField.Params), HcField.Data);

export const agentTerminal = (address: string, state: string, labels: Fields = DemoTerminal.Labels): Fields => ({
  ...dataOf(FrameName.Created), address, labels, state: DemoTerminal.Live, status: { app: DemoTerminal.App, state }, foreground: { argv: [...DemoTerminal.Argv], cwd: DemoTerminal.Cwd, name: DemoTerminal.Name, pid: DemoTerminal.Pid },
});

export const shellTerminal = (address: string): Fields => {
  const first = listOf(section(frame(FrameName.Subscribed), HcField.Result), HcField.Terminals)[0];
  return { ...(isFields(first) ? first : {}), address };
};

export class FakeHcCore {
  connections = 0;
  silent = false;
  splitReplies = false;
  seq = 100;
  terminals: Fields[] = [];
  readonly seen: Seen[] = [];
  private readonly handlers = new Map<string, Handler>();
  private readonly delays = new Map<string, number>();
  private readonly sockets = new Set<Socket>();
  private readonly subscribers = new Set<Socket>();
  private readonly timers = new Set<NodeJS.Timeout>();
  private server: Server | null = null;
  private helloResult: Fields = section(frame(FrameName.Hello), HcField.Result);

  private readonly dir: string;
  readonly path: SocketPath;

  private constructor(dir: string, path: SocketPath) {
    this.dir = dir;
    this.path = path;
    this.terminals = [agentTerminal(DemoTerminal.First, DemoTerminal.Working), agentTerminal(DemoTerminal.Second, DemoTerminal.Idle)];
  }

  static async start(): Promise<FakeHcCore> {
    const dir = mkdtempSync(join(tmpdir(), FakeName.DirPrefix));
    const core = new FakeHcCore(dir, brand<string, 'SocketPath'>(join(dir, FakeName.Socket)));
    await core.up();
    return core;
  }

  static unlistened(): FakeHcCore {
    const dir = mkdtempSync(join(tmpdir(), FakeName.DirPrefix));
    return new FakeHcCore(dir, brand<string, 'SocketPath'>(join(dir, FakeName.Socket)));
  }

  get open(): number {
    return this.sockets.size;
  }

  get subscribed(): number {
    return this.subscribers.size;
  }

  on(method: string, handler: Handler): void {
    this.handlers.set(method, handler);
  }

  delay(method: string, ms: number): void {
    this.delays.set(method, ms);
  }

  hello(patch: Fields): void {
    this.helloResult = { ...this.helloResult, ...patch };
  }

  async up(): Promise<void> {
    const server = createServer((socket) => { this.accept(socket); });
    this.server = server;
    await new Promise<void>((resolve) => { server.listen(this.path, resolve); });
  }

  async down(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.dropAll();
    if (server !== null) {
      await new Promise<void>((resolve) => { server.close(() => { resolve(); }); });
    }
  }

  dropAll(): void {
    for (const socket of this.sockets) {
      socket.destroy();
    }
  }

  event(type: string, terminal: string | null, data?: Fields): number {
    this.seq += 1;
    const base = section(frame(FrameName.eventOf(type)), HcField.Params);
    this.send(HcNotificationMethod.Event, { [HcField.Seq]: this.seq, [HcField.Terminal]: terminal, [HcField.Type]: type, [HcField.Data]: data ?? section(base, HcField.Data) });
    return this.seq;
  }

  heartbeat(): void {
    this.send(HcNotificationMethod.Heartbeat, { [HcField.Seq]: this.seq });
  }

  missed(terminals: Fields[]): void {
    this.seq += 1;
    this.send(HcNotificationMethod.Missed, { [HcField.Seq]: this.seq, [HcField.Terminals]: terminals });
  }

  raw(text: string): void {
    for (const socket of this.subscribers) {
      socket.write(text);
    }
  }

  async stop(): Promise<void> {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    await this.down();
    rmSync(this.dir, { recursive: true, force: true });
  }

  private send(method: HcNotificationMethod, params: Fields): void {
    const line = JSON.stringify({ [HcField.JsonRpc]: HC_JSONRPC_VERSION, [HcField.Method]: method, [HcField.Params]: params }) + HC_LINE_SEPARATOR;
    for (const socket of this.subscribers) {
      socket.write(line);
    }
  }

  private accept(socket: Socket): void {
    this.connections += 1;
    const connection = this.connections;
    this.sockets.add(socket);
    let rest: string = EMPTY_TEXT;
    socket.on(SocketEvent.Data, (chunk: Buffer) => {
      const lines = (rest + chunk.toString(UTF8)).split(HC_LINE_SEPARATOR);
      rest = lines.pop() ?? EMPTY_TEXT;
      for (const line of lines) {
        this.handle(socket, line, connection);
      }
    });
    socket.on(SocketEvent.Error, () => undefined);
    socket.on(SocketEvent.Close, () => { this.sockets.delete(socket); this.subscribers.delete(socket); });
  }

  private handle(socket: Socket, line: string, connection: number): void {
    const request: unknown = JSON.parse(line);
    if (!isFields(request) || !isString(request[HcField.Method])) {
      return;
    }
    const method = String(request[HcField.Method]);
    const params = section(request, HcField.Params);
    this.seen.push({ method, params, connection });
    if (this.silent) {
      return;
    }
    const wait = this.delays.get(method) ?? 0;
    const timer = setTimeout(() => { this.timers.delete(timer); this.reply(socket, request[HcField.Id], method, params); }, wait);
    this.timers.add(timer);
  }

  private reply(socket: Socket, id: unknown, method: string, params: Fields): void {
    if (socket.destroyed) {
      return;
    }
    const body = this.outcome(socket, method, params);
    const line = JSON.stringify({ [HcField.Id]: id, [HcField.JsonRpc]: HC_JSONRPC_VERSION, ...body }) + HC_LINE_SEPARATOR;
    if (!this.splitReplies) {
      socket.write(line);
      return;
    }
    socket.write(line.slice(0, SPLIT_AT));
    const timer = setTimeout(() => { this.timers.delete(timer); socket.write(line.slice(SPLIT_AT)); }, SPLIT_DELAY);
    this.timers.add(timer);
  }

  private outcome(socket: Socket, method: string, params: Fields): Fields {
    try {
      return { [HcField.Result]: this.resultOf(socket, method, params) };
    } catch (cause) {
      if (cause instanceof FakeFault) {
        return { [HcField.Error]: { [HcField.Code]: cause.code, [HcField.Message]: cause.message, [HcField.Data]: { [HcField.Kind]: cause.kind } } };
      }
      throw cause;
    }
  }

  private resultOf(socket: Socket, method: string, params: Fields): unknown {
    const custom = this.handlers.get(method);
    if (custom !== undefined) {
      return custom(params);
    }
    const serve = this.served.get(method);
    if (serve === undefined) {
      throw new FakeFault(FakeRpcCode.MethodNotFound, FakeFaultKind.MethodNotFound, FakeText.NoMethod(method));
    }
    return serve(socket, params);
  }

  private readonly served: ReadonlyMap<string, Serve> = new Map<string, Serve>([
    [HC_HELLO_METHOD, () => this.helloResult],
    [HC_LIST_METHOD, () => ({ [FakeField.HiddenFinished]: 0, [HcField.Terminals]: this.terminals })],
    [HC_GET_METHOD, (_socket, params) => this.getOf(params[HcField.Terminal])],
    [HC_READ_METHOD, (_socket, params) => ({ text: FakeText.Screen(params[HcField.Terminal]), complete: true, how: FakeScreen.How, why: null })],
    [HC_SUBSCRIBE_METHOD, (socket) => { this.subscribers.add(socket); return { [FakeField.Channel]: null, [HcField.Seq]: this.seq, [HcField.Terminals]: this.terminals }; }],
  ]);

  private getOf(address: unknown): Fields {
    const found = this.terminals.find((terminal) => terminal[FakeField.Address] === address);
    if (found === undefined) {
      throw new FakeFault(FakeRpcCode.NotFound, FakeFaultKind.NotFound, FakeText.NoTerminal(address));
    }
    return found;
  }
}

export function nextWithin<T>(iterator: AsyncIterator<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const timer = setTimeout(() => { resolve(null); }, ms);
    iterator.next().then((step) => { clearTimeout(timer); resolve(step.done === true ? null : step.value); return step; }, reject);
  });
}

export const later = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
