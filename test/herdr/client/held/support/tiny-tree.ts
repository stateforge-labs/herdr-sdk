// Role: a tiny NamespaceTree builder and allow-list for the four class C methods, standing in for P2b's real builder in the held unit tests.
// Informs plan 3.3 and HoldDeps (the held tree is built with the same Invoke as every client); lane P4b test helper.
import { Method } from '../../../../../src/herdr/generated/index.ts';
import type { AllowedMethods, BuildNamespaceTree, CallOptions, Invoke, NamespaceTree } from '../../../../../src/herdr/client/types.ts';

// Every leaf sends its method through the Invoke the held connection gives it.
function leaf(invoke: Invoke, method: Method): (params?: unknown, options?: CallOptions) => Promise<unknown> {
  return (params, options) => invoke(method, params, options);
}

export const tinyTree: BuildNamespaceTree = (_allowed, invoke) => ({
  client: {
    window_title: {
      set: leaf(invoke, Method.ClientWindowTitleSet),
      clear: leaf(invoke, Method.ClientWindowTitleClear),
    },
  },
  client_shell: {
    surface: {
      set: leaf(invoke, Method.ClientShellSurfaceSet),
    },
  },
  server: {
    ssh_agent: {
      register: leaf(invoke, Method.ServerSshAgentRegister),
    },
  },
}) satisfies NamespaceTree;

export const tinyAllowedMethods: AllowedMethods = () =>
  new Set<Method>([
    Method.ClientWindowTitleSet,
    Method.ClientWindowTitleClear,
    Method.ClientShellSurfaceSet,
    Method.ServerSshAgentRegister,
  ]);
