# Architecture of @stateforge-labs/herdr-sdk (C4, LikeC4)

Modelled with [LikeC4](https://likec4.dev) following the voice engine's conventions (`plugins/crisap94.voice-engine/docs/architecture/c4-guide.md`, hub ADR-0015: StateForge subset, folders 1 to 6, one meaning per colour, one model). Everything is **proposed** until the code lands.

| Document | What |
|---|---|
| [plan.md](plan.md) | the plan: summary and decisions, layers, coverage, test kit, drift, migration, phases with size table, portability inventory (appendix A) |
| [../../README.md](../../README.md) | README-first developer guide (planned API) |
| [contracts.md](contracts.md) | locked contract files, lane ownership and lane graph for the parallel build (HERDR-ADR-0017) |
| [../decisions/](../decisions/README.md) | 17 ADRs (proposed), ids HERDR-ADR-NNNN |
| [c4/](c4/) | the LikeC4 model |

## How to read it

1. Start with the README usage snippets: they are the API the design must serve.
2. Read the plan summary, then section 3 (layers); appendix A lists what is ported from atalaya-bridge and the hub.
3. Each plan section links its ADR; each ADR cites the plan section and the evidence files.
4. Open the C4 views: Context -> Containers -> Components.

## Layout

```
c4/
  specification.c4   kinds, colours with the legend, tags
  model.c4           consumers, herdr, the library, its entry points and components
  views.c4           1 · Context, 2 · Containers, 3 · Components (core client, Effect client)
```

## Views

- `1 · Context / @stateforge-labs/herdr-sdk` (`index`): consumers (voice-hub, atalaya-bridge, scripts) and herdr.
- `2 · Containers / @stateforge-labs/herdr-sdk` (`entries`): entry points core, read-only, admin, model (deferred), effect, schema, test-kit, drift tooling and generator.
- `3 · Components / Core client` (`coreComponents`): generated, wire, client layers, subscribe, watch and held connections.
- `3 · Components / Effect client` (`effectComponents`): Herdr service, layers, tagged errors, Stream subscribe, watchPaneSet.

Validate: `cd docs/architecture/c4 && npx -y likec4@1.60.0 validate .`

One server serves one folder, so the voice engine's model is the separate `likec4` server.
