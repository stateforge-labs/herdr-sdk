// Role: the capped exponential backoff of the core link and events.
// Informs HERDR-ADR-0020 (the herdr-core client); ported from the desktop work in herdr-plugins.
import { must } from './kernel.ts';
import { parseCount, type Count } from './kernel.ts';
import type { Duration } from './kernel.ts';
import { RetryPhase, TimerHold } from './constants.ts';
import { nextBackoff } from './wire.ts';

export interface BackoffTiming {
  readonly backoffBase: Duration;
  readonly backoffCap: Duration;
}

const ZERO = must(parseCount(0));
const ONE = must(parseCount(1));

const HOLD: Readonly<Record<TimerHold, (timer: NodeJS.Timeout) => void>> = {
  [TimerHold.HoldsProcess]: () => undefined,
  [TimerHold.LetsProcessEnd]: (timer) => { timer.unref(); },
};

export class Backoff {
  private readonly timing: BackoffTiming;
  private readonly hold: TimerHold;
  private failures: Count = ZERO;
  private retry: NodeJS.Timeout | null = null;
  private proven: NodeJS.Timeout | null = null;

  constructor(timing: BackoffTiming, hold: TimerHold) {
    this.timing = timing;
    this.hold = hold;
  }

  get phase(): RetryPhase {
    return this.retry === null ? RetryPhase.Idle : RetryPhase.Waiting;
  }

  schedule(run: () => void): void {
    this.stop();
    const delay = nextBackoff(this.failures, this.timing.backoffBase, this.timing.backoffCap);
    this.failures = must(parseCount(this.failures + ONE));
    this.retry = this.timer(() => { this.retry = null; run(); }, delay);
  }

  survive(): void {
    this.clear(this.proven);
    this.proven = setTimeout(() => { this.proven = null; this.failures = ZERO; }, this.timing.backoffCap);
    this.proven.unref();
  }

  stop(): void {
    this.clear(this.retry);
    this.clear(this.proven);
    this.retry = null;
    this.proven = null;
  }

  private timer(run: () => void, delay: Duration): NodeJS.Timeout {
    const timer = setTimeout(run, delay);
    HOLD[this.hold](timer);
    return timer;
  }

  private clear(timer: NodeJS.Timeout | null): void {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}
