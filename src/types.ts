import { EPMLWarning } from "./errors.js";
import { PrinterProfile } from "./profiles/types.js";
import { EPMLPlugin } from "./plugin.js";

export type TokenType = "TagOpen" | "TagClose" | "Text" | "EOF";

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly attributes: Record<string, string>;
  readonly line: number;
  readonly column: number;
}

export type ASTNode = ElementNode | TextNode | ForLoopNode | IfNode | RawNode;

export interface BaseNode {
  readonly line: number;
  readonly column: number;
}

export interface ElementNode extends BaseNode {
  readonly type: "Element";
  readonly name: string;
  readonly rawAttributes: Record<string, string>;
  readonly attributes: Record<string, unknown>; // populated by semantic analyzer
  readonly children: readonly ASTNode[];
}

export interface TextNode extends BaseNode {
  readonly type: "Text";
  readonly value: string;
}

export interface ForLoopNode extends BaseNode {
  readonly type: "ForLoop";
  readonly itemName: string;
  readonly listName: string;
  readonly children: readonly ASTNode[];
}

export interface IfNode extends BaseNode {
  readonly type: "If";
  readonly condition: string;
  readonly trueBranch: readonly ASTNode[];
  readonly falseBranch?: readonly ASTNode[];
}

export interface RawNode extends BaseNode {
  readonly type: "Raw";
  readonly data: Uint8Array;
}

export type ImageDitherMode = "threshold" | "bayer" | "floyd-steinberg";

export interface ImageRenderOptions {
  dither?: ImageDitherMode;
  threshold?: number;
  invert?: boolean;
  scale?: number;
  mode?: "raster" | "column";
}

export type RasterizerFn = (
  url: string,
  targetWidth: number,
  options?: ImageRenderOptions,
) => Promise<{ data: Uint8Array; width: number; height: number }>;

export interface CompileOptions {
  plugins?: EPMLPlugin[];
  strict?: boolean;
  image?: ImageRenderOptions;
}

export interface CompileResult {
  bytes: Uint8Array;
  warnings: EPMLWarning[];
}

export * from "./profiles/types.js";
export type { EPMLWarning } from "./errors.js";
