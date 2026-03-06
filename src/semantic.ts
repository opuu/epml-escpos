import { ASTNode, CompileOptions } from "./types.js";
import {
  parseAttributes,
  UniversalTextSchema,
  mergeSchemas,
} from "./attributes.js";
import { interpolateString, resolvePath } from "./interpolation.js";
import { EPMLSemanticError } from "./errors.js";

const ReceiptSchema = mergeSchemas(UniversalTextSchema, {
  width: { type: "number", default: 48, required: true },
  init: { type: "boolean", default: true },
});

const CellSchema = mergeSchemas(UniversalTextSchema, {
  width: { type: "string", default: "100%" },
});

const DrawerSchema = {
  pin: { type: "enum", allowedValues: ["2", "5"], default: "2" },
  on: { type: "number", default: 50 },
  off: { type: "number", default: 50 },
} as const;

const FeedSchema = {
  lines: { type: "number", default: 1 },
} as const;

const FeedDotsSchema = {
  n: { type: "number", default: 24 },
} as const;

const FeedReverseSchema = {
  lines: { type: "number", default: 1 },
} as const;

const CutSchema = {
  mode: {
    type: "enum",
    allowedValues: ["full", "partial"],
    default: "partial",
  },
  feed: { type: "number", default: 0 },
} as const;

const BarcodeSchema = mergeSchemas(UniversalTextSchema, {
  type: { type: "string", default: "CODE128" },
  hri: {
    type: "enum",
    allowedValues: ["none", "above", "below", "both"],
    default: "none",
  },
  "hri-font": { type: "enum", allowedValues: ["a", "b"], default: "a" },
  height: { type: "number", default: 50 },
  width: { type: "number", default: 3 },
});

const QrSchema = mergeSchemas(UniversalTextSchema, {
  size: { type: "number", default: 3 },
  error: { type: "enum", allowedValues: ["L", "M", "Q", "H"], default: "M" },
});

const Pdf417Schema = {
  cols: { type: "number", default: 0 },
  rows: { type: "number", default: 0 },
  error: { type: "number", default: 0 },
  truncated: { type: "boolean", default: false },
} as const;

const ImageSchema = mergeSchemas(UniversalTextSchema, {
  src: { type: "string" },
  mode: {
    type: "enum",
    allowedValues: ["raster", "column"],
    default: "raster",
  },
  scale: { type: "number", default: 1 },
  dither: {
    type: "enum",
    allowedValues: ["floyd-steinberg", "bayer", "threshold"],
    default: "threshold",
  },
  threshold: { type: "number", default: 128 },
  width: { type: "number", default: 384 },
  align: {
    type: "enum",
    allowedValues: ["left", "center", "right"],
    default: "left",
  },
});

const NvImageSchema = {
  n: { type: "number", required: true },
  mode: {
    type: "enum",
    allowedValues: ["normal", "double-width", "double-height", "quad"],
    default: "normal",
  },
} as const;

export class SemanticAnalyzer {
  private currentReceiptWidth = 48;

  constructor(
    private readonly ast: ASTNode[],
    private readonly data: any,
    private readonly isSync: boolean = true,
    private readonly options: CompileOptions = {},
  ) {}

  public analyze(): ASTNode[] {
    return this.analyzeNodes(this.ast, this.data);
  }

  private analyzeNodes(nodes: readonly ASTNode[], currentData: any): ASTNode[] {
    const result: ASTNode[] = [];

    for (const node of nodes) {
      if (node.type === "Text") {
        const interpolated = interpolateString(node.value, currentData);
        if (interpolated.length > 0) {
          result.push({ ...node, value: interpolated });
        }
      } else if (node.type === "If") {
        const condValue = resolvePath(node.condition, currentData);
        if (condValue) {
          result.push(...this.analyzeNodes(node.trueBranch, currentData));
        } else if (node.falseBranch) {
          result.push(...this.analyzeNodes(node.falseBranch, currentData));
        }
      } else if (node.type === "ForLoop") {
        const list = resolvePath(node.listName, currentData);
        if (Array.isArray(list)) {
          for (const item of list) {
            const scopeData = { ...currentData };
            scopeData[node.itemName] = item;
            result.push(...this.analyzeNodes(node.children, scopeData));
          }
        }
      } else if (node.type === "Element") {
        let { name, rawAttributes, children } = node;
        name = name.toLowerCase();

        const deprecated = [
          "b",
          "u",
          "strike",
          "center",
          "left",
          "right",
          "color",
          "font",
          "rotate",
          "upside-down",
          "i_text",
          "line-spacing",
          "reset-spacing",
        ];
        if (deprecated.includes(name)) {
          throw new EPMLSemanticError(
            `Tag <${name}> is deprecated and removed. Use universal text attributes instead.`,
            node.line,
            node.column,
            name,
          );
        }

        if (name === "col") name = "cell";
        if (name === "open-drawer") name = "drawer";

        let validatedAttrs: Record<string, unknown> = {};

        switch (name) {
          case "receipt":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              ReceiptSchema,
              node.line,
              node.column,
            );
            this.currentReceiptWidth = validatedAttrs.width as number;
            break;
          case "text":
          case "br":
          case "hr":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              UniversalTextSchema,
              node.line,
              node.column,
            );
            break;
          case "cell":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              CellSchema as any,
              node.line,
              node.column,
            );
            break;
          case "row":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              UniversalTextSchema,
              node.line,
              node.column,
            );
            this.validateRowCells(children, node.line, node.column);
            break;
          case "drawer":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              DrawerSchema as any,
              node.line,
              node.column,
            );
            break;
          case "feed":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              FeedSchema as any,
              node.line,
              node.column,
            );
            break;
          case "feed-reverse":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              FeedReverseSchema as any,
              node.line,
              node.column,
            );
            break;
          case "feed-dots":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              FeedDotsSchema as any,
              node.line,
              node.column,
            );
            break;
          case "cut":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              CutSchema as any,
              node.line,
              node.column,
            );
            break;
          case "barcode":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              BarcodeSchema as any,
              node.line,
              node.column,
            );
            break;
          case "qr":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              QrSchema as any,
              node.line,
              node.column,
            );
            break;
          case "pdf417":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              Pdf417Schema as any,
              node.line,
              node.column,
            );
            break;
          case "image":
            if (this.isSync) {
              throw new EPMLSemanticError(
                "Sync compile() cannot process <image> tags. Use compileAsync().",
                node.line,
                node.column,
                name,
              );
            }
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              ImageSchema as any,
              node.line,
              node.column,
            );
            break;
          case "nv-image":
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              NvImageSchema as any,
              node.line,
              node.column,
            );
            break;
          default:
            validatedAttrs = parseAttributes(
              name,
              rawAttributes,
              UniversalTextSchema,
              node.line,
              node.column,
            );
            Object.keys(rawAttributes).forEach((k) => {
              if (!(k in validatedAttrs)) validatedAttrs[k] = rawAttributes[k];
            });
            break;
        }

        result.push({
          ...node,
          name: name,
          attributes: validatedAttrs,
          children: this.analyzeNodes(children, currentData),
        });
      }
    }

    return result;
  }

  private validateRowCells(
    children: readonly ASTNode[],
    line: number,
    column: number,
  ) {
    let totalPercentage = 0;
    let totalAbsolute = 0;

    for (const child of children) {
      if (
        child.type === "Element" &&
        (child.name.toLowerCase() === "cell" ||
          child.name.toLowerCase() === "col")
      ) {
        const widthVal = child.rawAttributes["width"] || "100%";
        if (widthVal.endsWith("%")) {
          totalPercentage += parseFloat(widthVal.replace("%", ""));
        } else {
          totalAbsolute += parseInt(widthVal, 10);
        }
      }
    }

    if (totalPercentage > 100) {
      throw new EPMLSemanticError(
        `Row <cell> widths exceed 100% (sums to ${totalPercentage}%).`,
        line,
        column,
        "row",
      );
    }

    if (totalAbsolute > this.currentReceiptWidth) {
      throw new EPMLSemanticError(
        `Row <cell> widths exceed receipt width (${this.currentReceiptWidth} chars), sums to ${totalAbsolute}.`,
        line,
        column,
        "row",
      );
    }

    if (totalAbsolute > 0 && totalPercentage > 0) {
      // Mixed widths check
      if (
        (totalPercentage / 100) * this.currentReceiptWidth + totalAbsolute >
        this.currentReceiptWidth + 0.1
      ) {
        throw new EPMLSemanticError(
          `Row <cell> mixed widths exceed receipt width (${this.currentReceiptWidth} chars).`,
          line,
          column,
          "row",
        );
      }
    }
  }
}
