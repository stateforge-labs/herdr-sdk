// Role: frames the socket text stream into NDJSON lines; keeps the unfinished tail until its newline arrives.
// Informs HERDR-ADR-0016 (W2 framing) and plan 3.1; ported from atalaya src/transport/line-splitter.ts (logic kept, reformatted).
import { LINE_SEPARATOR } from '../constants.ts';

export class LineSplitter {
  private buffer = '';

  // Feeds one chunk and returns every complete, non-empty line it finished.
  push(chunk: string): string[] {
    const parts = (this.buffer + chunk).split(LINE_SEPARATOR);
    this.buffer = parts.pop() ?? '';
    return parts.filter((line) => line.length > 0);
  }

  // Text received after the last newline, not yet a line.
  get pending(): string {
    return this.buffer;
  }
}
