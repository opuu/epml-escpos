import { EPMLSemanticError } from "./errors.js";

export type AttributeType = "string" | "number" | "boolean" | "enum";

export interface AttributeConfig<T = unknown> {
  type: AttributeType;
  required?: boolean;
  default?: T;
  allowedValues?: T[];
  validate?: (value: T) => boolean;
}

export type AttributeSchema<T> = {
  [K in keyof T]-?: AttributeConfig<T[K]>;
};

export function parseAttributes<T>(
  tagName: string,
  rawAttrs: Record<string, string>,
  schema: AttributeSchema<T>,
  line?: number,
  column?: number,
): T {
  const result: any = {};

  for (const key of Object.keys(schema)) {
    const config = (schema as any)[key] as AttributeConfig;
    let rawValue = rawAttrs[key];

    if (rawValue === undefined) {
      if (config.required) {
        throw new EPMLSemanticError(
          `Missing required attribute '${key}' on <${tagName}>`,
          line,
          column,
          tagName,
        );
      }
      if (config.default !== undefined) {
        result[key] = config.default;
      }
      continue;
    }

    let parsedValue: any = rawValue;

    switch (config.type) {
      case "boolean":
        if (rawValue === "" || rawValue === "true" || rawValue === key) {
          parsedValue = true;
        } else if (rawValue === "false") {
          parsedValue = false;
        } else {
          throw new EPMLSemanticError(
            `Invalid boolean value '${rawValue}' for attribute '${key}' on <${tagName}>`,
            line,
            column,
            tagName,
          );
        }
        break;

      case "number":
        parsedValue = parseFloat(rawValue);
        if (isNaN(parsedValue)) {
          throw new EPMLSemanticError(
            `Invalid number value '${rawValue}' for attribute '${key}' on <${tagName}>`,
            line,
            column,
            tagName,
          );
        }
        break;

      case "enum":
      case "string":
        parsedValue = rawValue;
        break;
    }

    if (config.allowedValues && !config.allowedValues.includes(parsedValue)) {
      throw new EPMLSemanticError(
        `Invalid value '${parsedValue}' for attribute '${key}' on <${tagName}>. Allowed: ${config.allowedValues.join(", ")}`,
        line,
        column,
        tagName,
      );
    }

    if (config.validate && !config.validate(parsedValue)) {
      throw new EPMLSemanticError(
        `Validation failed for attribute '${key}' on <${tagName}> with value '${parsedValue}'`,
        line,
        column,
        tagName,
      );
    }

    result[key] = parsedValue;
  }
  return result as T;
}

export interface UniversalTextAttributes {
  [key: string]: unknown;
  align?: "left" | "center" | "right";
  bold?: boolean;
  underline?: boolean;
  strike?: boolean;
  invert?: boolean;
  rotate?: boolean;
  "upside-down"?: boolean;
  color?: "black" | "red";
  font?: "a" | "b";
  size?: number;
  "size-x"?: number;
  "size-y"?: number;
  charset?: string;
  smoothing?: boolean;
  padding?: boolean;
  "full-width"?: boolean;
  inline?: boolean;
  "padding-char"?: string;
}

export const UniversalTextSchema: AttributeSchema<UniversalTextAttributes> = {
  align: {
    type: "enum",
    allowedValues: ["left", "center", "right"],
    default: "left",
  },
  bold: { type: "boolean", default: false },
  underline: { type: "boolean", default: false },
  strike: { type: "boolean", default: false },
  invert: { type: "boolean", default: false },
  rotate: { type: "boolean", default: false },
  "upside-down": { type: "boolean", default: false },
  color: { type: "enum", allowedValues: ["black", "red"], default: "black" },
  font: { type: "enum", allowedValues: ["a", "b"], default: "a" },
  size: { type: "number", default: 1 },
  "size-x": { type: "number", default: 1 },
  "size-y": { type: "number", default: 1 },
  charset: { type: "string" },
  smoothing: { type: "boolean", default: false },
  padding: { type: "boolean", default: false },
  "full-width": { type: "boolean", default: false },
  inline: { type: "boolean", default: false },
  "padding-char": { type: "string", default: " " },
  "padding-top": { type: "number", default: 0 },
  "padding-bottom": { type: "number", default: 0 },
};

export function mergeSchemas<T1, T2>(
  s1: AttributeSchema<T1>,
  s2: AttributeSchema<T2>,
): AttributeSchema<T1 & T2> {
  return { ...s1, ...s2 } as unknown as AttributeSchema<T1 & T2>;
}
