// Role: the herdr-sdk skill stays true: frontmatter limits, links, version line, named methods exist, and every code block compiles and the `ts run` ones execute against the fake.
// Informs the skill (skills/herdr-sdk), HERDR-ADR-0014 (docs are executable) and HERDR-ADR-0008 (no live endpoint: the fake only).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { METHODS } from '../../src/schema.ts';
import type { Method } from '../../src/generated/index.ts';
import { createFakeHerdr } from '../../src/test-kit.ts';
import { FENCE_TS, IMPORT_REWRITES, NAME_PATTERN, SkillLimit, SkillPath } from './constants.ts';

const read = (path: string): string => readFileSync(path, 'utf8');
const skill = read(SkillPath.SkillFile);
const pkg = JSON.parse(read('package.json')) as { version: string; herdr: { protocol: number } };
const referenceFiles = readdirSync(SkillPath.References).map((name) => join(SkillPath.References, name));
const markdownFiles = [SkillPath.SkillFile, ...referenceFiles];

function frontmatter(text: string): { fields: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(match, 'SKILL.md starts with frontmatter');
  const fields: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const colon = line.indexOf(':');
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return { fields, body: match[2] ?? '' };
}

describe('skill frontmatter', () => {
  const { fields, body } = frontmatter(skill);

  test('has only name and description', () => {
    assert.deepEqual(Object.keys(fields).sort(), ['description', 'name']);
  });
  test('name is 1-64 chars of lowercase letters, digits, single hyphens, and equals the directory', () => {
    const name = fields.name ?? '';
    assert.ok(name.length >= 1 && name.length <= SkillLimit.NameMax);
    assert.match(name, NAME_PATTERN);
    assert.equal(name, SkillPath.Dir.split('/').at(-1));
  });
  test('description is non-empty, at most 1024 chars, no angle brackets, says when to use it', () => {
    const description = fields.description ?? '';
    assert.ok(description.length > 0 && description.length <= SkillLimit.DescriptionMax, `length ${description.length}`);
    assert.doesNotMatch(description, /[<>]/);
    assert.match(description, /Use when/);
  });
  test('body is under 500 lines', () => {
    assert.ok(body.split('\n').length < SkillLimit.BodyLinesMax);
  });
});

describe('skill content stays true', () => {
  test('the version line equals package.json (version and protocol)', () => {
    assert.ok(skill.includes(`@homelab/herdr ${pkg.version} = herdr protocol ${pkg.herdr.protocol}`), 'update the "Targets" line in SKILL.md');
  });
  test('every relative link resolves to a file', () => {
    for (const file of markdownFiles) {
      for (const link of read(file).matchAll(/`(references\/[a-z-]+\.md)`/g)) {
        assert.ok(existsSync(join(SkillPath.Dir, link[1] ?? '')), `${file} points at missing ${link[1]}`);
      }
    }
  });
  test('every method named in a recipe code block exists in the method table', () => {
    const known = new Set(METHODS.map((method) => method.name));
    for (const file of markdownFiles) {
      for (const block of read(file).matchAll(FENCE_TS)) {
        for (const call of (block[2] ?? '').matchAll(/herdr\.([a-z_]+(?:\.[a-z_]+)+)\(/g)) {
          const name = call[1] ?? '';
          if (name.startsWith('events.subscribe')) continue;
          assert.ok(known.has(name), `${file}: herdr.${name}() is not a herdr method`);
        }
      }
    }
  });
});

describe('skill code blocks', () => {
  const blocks: { id: string; run: boolean; code: string }[] = [];
  for (const file of markdownFiles) {
    let n = 0;
    for (const match of read(file).matchAll(FENCE_TS)) {
      n += 1;
      const base = file.replace(/^skills\/herdr-sdk\//, '').replace(/[^a-z0-9]+/gi, '-');
      blocks.push({ id: `${base}-${n}`, run: match[1] === ' run', code: match[2] ?? '' });
    }
  }
  const generated = (id: string): string => join(SkillPath.Generated, `${id}.ts`);

  before(() => {
    rmSync(SkillPath.Generated, { recursive: true, force: true });
    mkdirSync(SkillPath.Generated, { recursive: true });
    for (const block of blocks) {
      let code = block.code;
      for (const [from, to] of IMPORT_REWRITES) code = code.replaceAll(`"${from}"`, `"${to}"`);
      writeFileSync(generated(block.id), code);
    }
    writeFileSync(
      join(SkillPath.Generated, 'tsconfig.json'),
      JSON.stringify({ extends: '../../../tsconfig.test.json', include: ['*.ts'], exclude: [] }),
    );
  });
  after(() => rmSync(SkillPath.Generated, { recursive: true, force: true }));

  test('there are code blocks to check', () => {
    assert.ok(blocks.length >= 10, `found ${blocks.length}`);
  });

  test('all blocks type-check against the package', () => {
    try {
      execFileSync('node_modules/.bin/tsc', ['--noEmit', '-p', join(SkillPath.Generated, 'tsconfig.json')], { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      assert.fail(String((error as { stdout?: string }).stdout ?? error));
    }
  });

  for (const block of blocks.filter((b) => b.run)) {
    test(`${block.id} runs against the fake`, async () => {
      const fake = await createFakeHerdr();
      for (const line of block.code.matchAll(/^\/\/ fake: ([a-z_.]+) (.+)$/gm)) {
        fake.reply(line[1] as Method, JSON.parse(line[2] ?? '{}') as never);
      }
      const before = process.env.HERDR_SOCKET;
      process.env.HERDR_SOCKET = fake.path;
      try {
        await import(`../../${generated(block.id)}`);
      } finally {
        if (before === undefined) delete process.env.HERDR_SOCKET;
        else process.env.HERDR_SOCKET = before;
        await fake.stop();
      }
    });
  }
});

describe('herdr-skill bin', () => {
  const bin = (...args: string[]): { status: number; stdout: string } => {
    const result = spawnSync('node', ['bin/herdr-skill.js', ...args], { encoding: 'utf8' });
    return { status: result.status ?? -1, stdout: result.stdout };
  };

  test('print outputs SKILL.md verbatim', () => {
    const result = bin('print');
    assert.equal(result.status, 0);
    assert.equal(result.stdout, skill);
  });
  test('path names the skill directory', () => {
    assert.ok(bin('path').stdout.trim().endsWith(SkillPath.Dir));
  });
  test('install copies the skill and its references, and a second install replaces', () => {
    const target = mkdtempSync(join(tmpdir(), 'herdr-skill-'));
    try {
      assert.match(bin('install', target).stdout, /^installed /);
      assert.equal(read(join(target, 'herdr-sdk', 'SKILL.md')), skill);
      assert.ok(existsSync(join(target, 'herdr-sdk', 'references', 'recipes.md')));
      assert.match(bin('install', target).stdout, /^replaced /);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  });
  test('an unknown command exits 2 with usage', () => {
    assert.equal(bin('nope').status, 2);
    assert.equal(bin().status, 2);
  });
  test('package.json ships the skill and the generated API docs, and registers the bin', () => {
    const manifest = JSON.parse(read('package.json')) as { files: string[]; bin: Record<string, string> };
    assert.ok(manifest.files.includes('skills') && manifest.files.includes('docs/api'));
    assert.equal(manifest.bin['herdr-skill'], './bin/herdr-skill.js');
  });
});
