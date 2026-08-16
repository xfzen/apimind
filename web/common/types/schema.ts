export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export interface JsonSchema extends Record<string, unknown> {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  enumDesc?: unknown;
  format?: string;
  mock?: { mock?: unknown };
  maximum?: number;
  minimum?: number;
  maxLength?: number;
  minLength?: number;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
}

export interface SchemaTableRow extends Record<string, unknown> {
  name?: string;
  type?: string;
  key: string | number;
  desc?: string;
  required?: boolean;
  default?: unknown;
  sub?: Record<string, unknown>;
  children?: SchemaTableRow[];
}

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export interface NamedValue {
  name: string;
  value: unknown;
}
