// Role: builds the nested method tree once from METHODS (stub until lane P2b).
// Informs HERDR-ADR-0005 (capability-scoped clients) and plan 3.3-3.4; contract in client/types.ts (BuildNamespaceTree).
import { Lane } from '../../constants.ts';
import { notImplemented } from '../../not-implemented.ts';
import type { BuildNamespaceTree } from '../types.ts';

export const buildNamespaceTree: BuildNamespaceTree = () => notImplemented('buildNamespaceTree', Lane.P2b);
