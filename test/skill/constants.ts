// Role: names and limits used by the skill test (paths, frontmatter limits, fence markers).
// Informs the herdr-sdk skill (skills/herdr-sdk): frontmatter limits come from the Agent Skills spec as recorded in R-2026-11-07-01.
export const SkillPath = {
  Dir: 'skills/herdr-sdk',
  SkillFile: 'skills/herdr-sdk/SKILL.md',
  References: 'skills/herdr-sdk/references',
  Generated: 'test/skill/.generated',
} as const;

export const SkillLimit = {
  NameMax: 64,
  DescriptionMax: 1024,
  BodyLinesMax: 500,
} as const;

export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const FENCE_TS = /^```ts( run)?\n([\s\S]*?)^```$/gm;
export const IMPORT_REWRITES: readonly (readonly [string, string])[] = [
  ['@homelab/herdr/read-only', '../../../src/read-only.ts'],
  ['@homelab/herdr/test-kit', '../../../src/test-kit.ts'],
  ['@homelab/herdr/admin', '../../../src/admin.ts'],
  ['@homelab/herdr', '../../../src/index.ts'],
];
