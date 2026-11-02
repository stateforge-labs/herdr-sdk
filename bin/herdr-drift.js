#!/usr/bin/env node
// Role: the herdr-drift bin (package bin, plain JS so Node runs it from node_modules): the process I/O of the drift CLI. It runs the herdr CLI and sets the exit code; the logic is dist/drift/cli.js.
// Informs HERDR-ADR-0009 (exit codes 0/1/2/3), HERDR-ADR-0008 (the herdr CLI runs here only, never the socket) and HERDR-ADR-0012 (the package runs compiled JavaScript, not .ts).
import { execFileSync } from 'node:child_process';
import { HerdrCall } from '../dist/drift/constants.js';
import { runDriftCli } from '../dist/drift/cli.js';

const spawnHerdr = (binary) => (args) => execFileSync(binary, [...args], {
  encoding: 'utf8',
  timeout: HerdrCall.TimeoutMs,
  stdio: ['ignore', 'pipe', 'pipe'],
});

process.exitCode = await runDriftCli(process.argv.slice(2), spawnHerdr);
