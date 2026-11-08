// Role: an in-memory OpenDedicated and DedicatedConnection for the held tests: records every request, answers from a test function, and lets the test close it from the server side.
// Informs HERDR-ADR-0008 (fakes only, no socket) and HERDR-ADR-0016 (W1 one request per connection; the held stream); lane P4b test helper.
import type { Method } from '../../../../../src/herdr/generated/index.ts';
import type { ParamsOf, ResultOf } from '../../../../../src/herdr/wire/typed.ts';
import type { DedicatedConnection, DedicatedEnd, DedicatedOptions, DedicatedRequestOptions, OpenDedicated } from '../../../../../src/herdr/wire/types.ts';

export interface RecordedRequest {
  readonly method: string;
  readonly params: unknown;
  readonly options: DedicatedRequestOptions | undefined;
}

// Answers one request. The default answers an empty object; a test returns its own promise to hold a reply open.
export type Answer = (method: string, params: unknown) => Promise<unknown>;

export class MemoryConnection implements DedicatedConnection {
  readonly requests: RecordedRequest[] = [];
  destroyed = false;
  readonly ended: Promise<DedicatedEnd>;
  private finish: (end: DedicatedEnd) => void = () => undefined;
  private readonly answer: Answer;

  constructor(answer: Answer) {
    this.answer = answer;
    this.ended = new Promise<DedicatedEnd>((resolve) => {
      this.finish = resolve;
    });
  }

  request<M extends Method>(method: M, params: ParamsOf<M>, options?: DedicatedRequestOptions): Promise<ResultOf<M>> {
    this.requests.push({ method, params, options });
    // The fake answers any method with what the test scripted; the typed result is the test's own fixture.
    return this.answer(method, params) as Promise<ResultOf<M>>;
  }

  onPush(): void {
    // Pushes are not used by the held tests.
  }

  destroy(): void {
    if (!this.destroyed) {
      this.destroyed = true;
      this.finish({ byServer: false });
    }
  }

  // The server closes the connection: `ended` resolves with byServer true.
  serverClose(): void {
    this.finish({ byServer: true });
  }
}

export interface MemoryDedicated {
  readonly open: OpenDedicated;
  readonly connections: MemoryConnection[];
}

// The fake ignores the signal on purpose: the lane's own listener must be what closes the connection when the client or the caller aborts.
export function memoryDedicated(answer: Answer = async () => ({})): MemoryDedicated {
  const connections: MemoryConnection[] = [];
  const open: OpenDedicated = async (_options: DedicatedOptions) => {
    const connection = new MemoryConnection(answer);
    connections.push(connection);
    return connection;
  };
  return { open, connections };
}
