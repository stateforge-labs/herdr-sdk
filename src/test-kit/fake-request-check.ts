// Role: checks the params of a request against the generated shape of its method, the way herdr refuses bad params with invalid_params (HERDR-ADR-0016 W6).
// Informs HERDR-ADR-0016 (W6) and generated/shapes.ts (PARAMS_SHAPE); test-kit only.
import { FakeCheckText, FakeErrorCode, TypeofValue } from '../constants.ts';
import type { ErrorBody } from '../generated/index.ts';
import { JsonKind, PARAMS_SHAPE, type FieldShape, type ParamsShape } from '../generated/shapes.ts';
import { isObject } from '../wire/envelope.ts';
import { fieldOf, isText } from './fake-values.ts';

// The shape of a method, or undefined when the generated table does not list it (then nothing is checked).
function shapeOf(method: string): ParamsShape | undefined {
  const shapes: Readonly<Record<string, ParamsShape>> = PARAMS_SHAPE;
  return Object.hasOwn(shapes, method) ? shapes[method] : undefined;
}

// The first problem with the params, as the error herdr would return; undefined when the params fit the shape.
// Absent params count as an empty object.
export function checkParams(method: string, params: unknown): ErrorBody | undefined {
  const shape = shapeOf(method);
  if (shape === undefined) {
    return undefined;
  }
  const value: unknown = params === undefined ? {} : params;
  if (!isObject(value)) {
    return Object.keys(shape.fields).length === 0 ? undefined : problem(FakeCheckText.NotAnObject(method));
  }
  for (const name of shape.required) {
    if (fieldOf(value, name) === undefined) {
      return problem(FakeCheckText.MissingField(method, name));
    }
  }
  for (const [name, field] of Object.entries(shape.fields)) {
    const present = fieldOf(value, name);
    if (present !== undefined) {
      const fieldProblem = checkField(method, name, field, present);
      if (fieldProblem !== undefined) {
        return fieldProblem;
      }
    }
  }
  return undefined;
}

function checkField(method: string, name: string, field: FieldShape, value: unknown): ErrorBody | undefined {
  const kind = jsonKindOf(value);
  if (!field.kinds.some((allowed) => kindFits(kind, allowed))) {
    return problem(FakeCheckText.WrongKind(method, name));
  }
  if (field.enum !== undefined && isText(value) && !field.enum.includes(value)) {
    return problem(FakeCheckText.NotInEnum(method, name));
  }
  if (field.keyPattern !== undefined && isObject(value)) {
    const pattern = new RegExp(field.keyPattern);
    if (Object.keys(value).some((key) => !pattern.test(key))) {
      return problem(FakeCheckText.KeyNotAllowed(method, name));
    }
  }
  return undefined;
}

// An integer is also a number (JSON Schema): a field that allows number takes 3.
function kindFits(actual: JsonKind, allowed: JsonKind): boolean {
  return actual === allowed || (allowed === JsonKind.Number && actual === JsonKind.Integer);
}

// The JSON kind of a parsed value.
export function jsonKindOf(value: unknown): JsonKind {
  if (value === null) {
    return JsonKind.Null;
  }
  if (Array.isArray(value)) {
    return JsonKind.Array;
  }
  if (isText(value)) {
    return JsonKind.String;
  }
  if (typeof value === TypeofValue.Number) {
    return Number.isInteger(value) ? JsonKind.Integer : JsonKind.Number;
  }
  if (typeof value === TypeofValue.Boolean) {
    return JsonKind.Boolean;
  }
  return JsonKind.Object;
}

function problem(message: string): ErrorBody {
  return { code: FakeErrorCode.InvalidParams, message };
}
