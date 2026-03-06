export class EPMLError extends Error {
  public readonly stage: "lexer" | "parser" | "semantic" | "codegen" | "plugin";
  public readonly line?: number;
  public readonly column?: number;

  constructor(
    message: string,
    stage: "lexer" | "parser" | "semantic" | "codegen" | "plugin",
    line?: number,
    column?: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.stage = stage;
    this.line = line;
    this.column = column;
    Object.setPrototypeOf(this, (this.constructor as any).prototype);
  }
}

export class EPMLSyntaxError extends EPMLError {
  constructor(message: string, line?: number, column?: number) {
    super(message, "lexer", line, column); // or parser
  }
}

export class EPMLSemanticError extends EPMLError {
  public readonly tagName?: string;

  constructor(
    message: string,
    line?: number,
    column?: number,
    tagName?: string,
  ) {
    super(message, "semantic", line, column);
    this.tagName = tagName;
  }
}

export class EPMLCodegenError extends EPMLError {
  constructor(message: string, line?: number, column?: number) {
    super(message, "codegen", line, column);
  }
}

export class EPMLPluginError extends EPMLError {
  public readonly pluginName?: string;

  constructor(
    message: string,
    pluginName?: string,
    line?: number,
    column?: number,
  ) {
    super(message, "plugin", line, column);
    this.pluginName = pluginName;
  }
}

export interface EPMLWarning {
  message: string;
  stage: "lexer" | "parser" | "semantic" | "codegen" | "plugin";
  tagName?: string;
  line?: number;
  column?: number;
}

export type Result<T, E extends Error> =
  | { success: true; value: T; error?: never }
  | { success: false; error: E; value?: never };

export function success<T>(value: T): Result<T, any> {
  return { success: true, value };
}

export function failure<E extends Error>(error: E): Result<any, E> {
  return { success: false, error };
}
