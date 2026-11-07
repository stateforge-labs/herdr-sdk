---
id: HERDR-ADR-0018
title: "The agent skill ships in the package, with a bin to install it"
status: accepted
date: 2026-11-07
decision-makers: owner
summary: "skills/herdr-sdk lives in the npm package and is the single source; herdr-skill prints or copies it; drift is caught by a test that type-checks and runs every code block."
---

# HERDR-ADR-0018: The agent skill ships in the package

Evidence: research study R-2026-11-07-01 (`docs/research/studies/2026-11-07-sdk-skill-best-practices/` in the omarchylab repository, branch research-sdk-skill; confidence low, the study was stopped before its reconcile step, and it has no live discovery probe).

## Context and problem statement

Coding agents misuse an SDK they know only from memory. The herdr family already ships manuals with the binary (`hc --skill`). Where should this SDK's skill live and how does an agent get it?

## Considered options

1. A `skills/` folder in the npm package. 2. A `--skill` command that prints it (the hc convention). 3. A skill generated from the types. 4. A plugin or marketplace package. 5. `AGENTS.md` or `llms.txt` only.

## Decision outcome

Options 1 and 2 together, plus a two-line `AGENTS.md` pointer (5):

- `skills/herdr-sdk/` in the package is the one source: a short `SKILL.md` (routing, version gate, rules) and `references/` (recipes, errors, api-map, versions). The generated `docs/api/*.md` ship too; the skill points at them rather than copying the method list, so it cannot drift from the schema.
- `herdr-skill print|path|install` (plain JS bin, node built-ins only). `install` copies the folder to a skills directory because Claude Code's documented skill locations do not include `node_modules` (reported by the study from the Claude Code docs; not probed).
- Drift control: `test/skill/` checks frontmatter limits, that the "Targets" line equals package.json, that every code block type-checks against the package and every `ts run` block executes against the fake. A recipe with a wrong field name fails CI (verified by mutation).
- Not chosen: (3) generation, because the study found no unit that does it and the method list is already generated into `docs/api`; (4) a plugin, because its fit with a zero-dependency package is not evidenced.

## Consequences

- Good: offline, version-locked to the package, no new dependency, and examples that cannot rot silently.
- Bad: the skill is hand-written prose; the test catches wrong code, not wrong advice. Claude Code users must run `herdr-skill install` once per project or user.
- Open: whether node_modules skills are discovered by other agents (unprobed); whether to also publish to a marketplace (revisit at first registry publish, HERDR-ADR-0011).
