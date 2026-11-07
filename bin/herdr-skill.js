#!/usr/bin/env node
// Role: the herdr-skill bin: prints or installs the agent skill that ships in this package (skills/herdr-sdk), so an agent can load it without knowing where node_modules is.
// Informs HERDR-ADR-0018 (the skill ships in the package; Claude Code does not discover node_modules, so `install` copies it into a skills directory) and the hc `--skill` convention.
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_NAME = 'herdr-sdk';
const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', SKILL_NAME);
const DEFAULT_TARGET = join('.claude', 'skills');
const USAGE = `usage: herdr-skill <command>
  print              print SKILL.md to stdout
  path               print the directory of the skill inside this package
  install [skills-dir]   copy the skill to <skills-dir>/${SKILL_NAME} (default ${DEFAULT_TARGET}); an existing copy is replaced
exit: 0 ok, 2 usage`;

function run(args) {
  const [command, target] = args;
  if (command === 'print') {
    process.stdout.write(readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8'));
    return 0;
  }
  if (command === 'path') {
    console.log(SKILL_DIR);
    return 0;
  }
  if (command === 'install') {
    const destination = resolve(target ?? DEFAULT_TARGET, SKILL_NAME);
    const replaced = existsSync(destination);
    cpSync(SKILL_DIR, destination, { recursive: true, force: true });
    console.log(`${replaced ? 'replaced' : 'installed'} ${destination}`);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

process.exitCode = run(process.argv.slice(2));
