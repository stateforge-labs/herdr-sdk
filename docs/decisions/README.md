# Decisions (ADRs) for @homelab/herdr

Architecture decision records, StateForge format (frontmatter id/title/status/date/decision-makers/summary; sections Context and problem statement, Decision outcome, Consequences). Source: [the architecture plan](../architecture/plan.md), 2026-11-02.
Status moves to accepted when the code that implements the decision has landed; partial builds stay proposed and say what is built in the ADR.
Ids are **HERDR-ADR-NNNN** (the library's own sequence). The voice engine's records are always cited as **hub ADR-NNNN**.

| ADR | Title | Status |
|---|---|---|
| [HERDR-ADR-0001](HERDR-ADR-0001-library-scope-and-location.md) | Library scope and location: packages/herdr in omarchylab, @homelab/herdr | proposed |
| [HERDR-ADR-0002](HERDR-ADR-0002-generate-the-client-from-herdrs-published-schema.md) | Generate the client from herdr's published schema | proposed |
| [HERDR-ADR-0003](HERDR-ADR-0003-layering-and-entry-points.md) | Layering and subpath entry points, zero-dependency core | proposed |
| [HERDR-ADR-0004](HERDR-ADR-0004-promise-core-and-effect-client.md) | Promise core and Effect client, Effect as an optional peer | proposed |
| [HERDR-ADR-0005](HERDR-ADR-0005-capability-scoped-clients.md) | Capability-scoped clients and the admin subpath | proposed |
| [HERDR-ADR-0006](HERDR-ADR-0006-domain-model-separate-from-wire-types.md) | Domain model separate from wire types (deferred to its first consumer) | proposed |
| [HERDR-ADR-0007](HERDR-ADR-0007-subscriptions-and-long-poll-design.md) | Subscriptions, long-poll and held connections | proposed |
| [HERDR-ADR-0008](HERDR-ADR-0008-test-kit-and-contract-test-policy.md) | Test kit and contract-test policy: no live endpoint by default | proposed |
| [HERDR-ADR-0009](HERDR-ADR-0009-schema-drift-and-protocol-tied-versioning.md) | Schema drift and protocol-tied versioning | proposed |
| [HERDR-ADR-0011](HERDR-ADR-0011-consumer-migration.md) | Consumer migration and distribution (tarball, then registry) | proposed |
| [HERDR-ADR-0012](HERDR-ADR-0012-runtime-targets-and-build-output.md) | Runtime targets (Bun first, Node) and compiled build output | proposed |
| [HERDR-ADR-0014](HERDR-ADR-0014-executable-docs.md) | Docs are executable: README-first, examples compiled and run | proposed |
| [HERDR-ADR-0015](HERDR-ADR-0015-dependency-policy-and-size-budget.md) | Dependency policy and size budget | proposed |
| [HERDR-ADR-0016](HERDR-ADR-0016-design-intent-inherited-from-atalaya.md) | Design intent inherited from atalaya: measured wire facts and client principles | proposed |
| [HERDR-ADR-0017](HERDR-ADR-0017-interfaces-locked-before-parallel-implementation.md) | Interfaces are locked before parallel implementation | proposed |
| [HERDR-ADR-0018](HERDR-ADR-0018-the-skill-ships-in-the-package.md) | The agent skill ships in the package, with a bin to install it | proposed |
| [HERDR-ADR-0019](HERDR-ADR-0019-publish-to-the-gitlab-npm-registry-on-a-tag.md) | Publish @homelab/herdr to the GitLab npm registry on a protected tag | proposed |

Cross-project (not written here): hub ADR-0030 "Depend on the extracted @homelab/herdr package" supersedes hub ADR-0003 and amends hub ADR-0012, 0022 and 0029; the hub ADR changes are listed in [plan section 8](../architecture/plan.md#8-migration).
