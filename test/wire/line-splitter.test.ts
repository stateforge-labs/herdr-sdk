// Role: checks NDJSON framing: a line split across chunks, several lines in one chunk, empty lines dropped and the pending tail.
// Informs HERDR-ADR-0016 (W2 framing) and plan 5 (socket tests); ported-and-extended from atalaya test coverage of transport/line-splitter.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LineSplitter } from '../../src/wire/line-splitter.ts';

describe('LineSplitter', () => {
  test('joins a line split across two chunks', () => {
    const splitter = new LineSplitter();
    assert.deepEqual(splitter.push('{"id":'), []);
    assert.deepEqual(splitter.push('"a"}\n'), ['{"id":"a"}']);
  });

  test('returns several lines from one chunk in order', () => {
    const splitter = new LineSplitter();
    assert.deepEqual(splitter.push('one\ntwo\nthree\n'), ['one', 'two', 'three']);
  });

  test('drops empty lines', () => {
    const splitter = new LineSplitter();
    assert.deepEqual(splitter.push('\n\nalpha\n\n'), ['alpha']);
  });

  test('keeps the unfinished tail as pending until its newline arrives', () => {
    const splitter = new LineSplitter();
    assert.deepEqual(splitter.push('done\npart'), ['done']);
    assert.equal(splitter.pending, 'part');
    assert.deepEqual(splitter.push('ial\n'), ['partial']);
    assert.equal(splitter.pending, '');
  });
});
