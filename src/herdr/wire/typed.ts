// Role: type-only helpers that map a method name to its params type and its result type. CONTRACT FILE (HERDR-ADR-0017): read-only for every lane.
// Informs HERDR-ADR-0002 (generated types) and plan 3.2; ported from atalaya src/herdr/client/typed.ts. Type-only, so it sits in wire in 2a; phase 3 may move it into a generator emitter (plan 3.2 target src/herdr/generated/typed.ts).
import type { METHOD_RESULT, Method, MethodParams, ResponseResult, ResultByTag } from '../generated/index.ts';

export type ParamsOf<M extends Method> = MethodParams[M];

export type ResultOf<M extends Method> = M extends keyof typeof METHOD_RESULT
  ? ResultByTag[(typeof METHOD_RESULT)[M]]
  : ResponseResult;
