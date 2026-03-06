import {
  ASTNode,
  CompileOptions,
  CompileResult,
  EPMLWarning,
} from "./types.js";
import { EPMLPluginError, EPMLCodegenError } from "./errors.js";
import { EPMLPlugin, CommandMap } from "./plugin.js";
import * as CMD from "./commands/index.js";

export class CodeGenerator {
  private warnings: EPMLWarning[] = [];
  private isCenter = false;

  constructor(
    private readonly ast: ASTNode[],
    private readonly commands: CommandMap,
    private readonly options: CompileOptions = {},
    private readonly isSync: boolean = true,
    private readonly receiptWidth: number = 48,
  ) {}

  private warn(
    message: string,
    line?: number,
    column?: number,
    tagName?: string,
  ) {
    this.warnings.push({ message, stage: "codegen", line, column, tagName });
  }

  private warnPlugin(message: string) {
    this.warnings.push({ message, stage: "plugin" });
  }

  public generate(): CompileResult {
    let result: any = new Uint8Array();
    result = this.concat(result, this.processNodesSync(this.ast));
    return { bytes: result as Uint8Array, warnings: this.warnings };
  }

  public async generateAsync(): Promise<CompileResult> {
    let result: any = new Uint8Array();
    result = this.concat(result, await this.processNodesAsync(this.ast));
    return { bytes: result as Uint8Array, warnings: this.warnings };
  }

  private concat(a: any, b: any): any {
    if (!b || b.length === 0) return a;
    const c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
  }

  private processNodesSync(nodes: readonly ASTNode[]): any {
    let result: any = new Uint8Array();
    for (const node of nodes) {
      if (node.type === "Text") {
        const encoder = new TextEncoder();
        result = this.concat(result, encoder.encode(node.value || ""));
      } else if (node.type === "Raw") {
        result = this.concat(result, node.data);
      } else if (node.type === "Element") {
        result = this.concat(result, this.processElementSync(node));
      } else {
        if ((node as any).children) {
          result = this.concat(
            result,
            this.processNodesSync((node as any).children),
          );
        }
      }
    }
    return result;
  }

  private async processNodesAsync(nodes: readonly ASTNode[]): Promise<any> {
    let result: any = new Uint8Array();
    for (const node of nodes) {
      if (node.type === "Text") {
        const encoder = new TextEncoder();
        result = this.concat(result, encoder.encode(node.value || ""));
      } else if (node.type === "Raw") {
        result = this.concat(result, node.data);
      } else if (node.type === "Element") {
        result = this.concat(result, await this.processElementAsync(node));
      } else {
        if ((node as any).children) {
          result = this.concat(
            result,
            await this.processNodesAsync((node as any).children),
          );
        }
      }
    }
    return result;
  }

  private processElementSync(node: any): any {
    return this.sharedElementProcess(
      node,
      this.processNodesSync(node.children),
      false,
    );
  }

  private async processElementAsync(node: any): Promise<any> {
    return this.sharedElementProcess(
      node,
      await this.processNodesAsync(node.children),
      true,
    );
  }

  private getVisibleLength(node: any, inheritedScaleX = 1): number {
    let currentScaleX = inheritedScaleX;
    if (node.type === "Element") {
      const raw = node.rawAttributes || {};
      if (raw["size-x"]) currentScaleX = parseInt(raw["size-x"], 10) || 1;
      else if (raw["size"]) currentScaleX = parseInt(raw["size"], 10) || 1;
    }

    let len = 0;
    if (node.type === "Text") {
      len += (node.value || "").length * currentScaleX;
    } else if (node.children) {
      for (const c of node.children) {
        len += this.getVisibleLength(c, currentScaleX);
      }
    }
    return len;
  }

  private sharedElementProcess(
    node: any,
    childBytes: any,
    isAsyncCall: boolean,
  ): any {
    const attrs: any = node.attributes || {};
    let result: any = new Uint8Array();

    const compileFormat = () => {
      let start: any = new Uint8Array();
      let end: any = new Uint8Array();
      const t = this.commands.text;

      if (attrs.align !== undefined && attrs.align !== "left") {
        const alignToSequence = {
          left: this.commands.alignment.left,
          center: this.commands.alignment.center,
          right: this.commands.alignment.right,
        };
        start = this.concat(
          start,
          alignToSequence[attrs.align as "left" | "center" | "right"],
        );
        end = this.concat(
          end,
          alignToSequence.left ? alignToSequence.left : new Uint8Array(),
        );
      }
      if (attrs.bold) {
        start = this.concat(start, t.boldOn);
        end = this.concat(end, t.boldOff);
      }
      if (attrs.underline) {
        start = this.concat(start, t.underlineOn);
        end = this.concat(end, t.underlineOff);
      }
      if (attrs.strike) {
        start = this.concat(start, t.strikeOn);
        end = this.concat(end, t.strikeOff);
      }
      if (attrs.invert) {
        if (t.invertOn?.length) {
          start = this.concat(start, t.invertOn);
          end = this.concat(end, t.invertOff);
        }
      }
      if (attrs.rotate) {
        start = this.concat(start, t.rotateOn);
        end = this.concat(end, t.rotateOff);
      }
      if (attrs["upside-down"]) {
        start = this.concat(start, t.upsideDownOn);
        end = this.concat(end, t.upsideDownOff);
      }
      if (attrs.color === "red") {
        if (t.color) {
          try {
            start = this.concat(start, t.color("red"));
            end = this.concat(end, t.color("black"));
          } catch (e: any) {
            throw new EPMLPluginError(e.message, "CommandMap:color");
          }
        } else {
          this.warn(
            "Printer profile does not support red color.",
            node.line,
            node.column,
            node.name,
          );
        }
      }
      if (attrs.font === "b") {
        if (t.font) {
          try {
            start = this.concat(start, t.font("b"));
            end = this.concat(end, t.font("a"));
          } catch (e: any) {
            throw new EPMLPluginError(e.message, "CommandMap:font");
          }
        }
      }
      if (
        (attrs.size !== undefined && attrs.size !== 1) ||
        (attrs["size-x"] !== undefined && attrs["size-x"] !== 1) ||
        (attrs["size-y"] !== undefined && attrs["size-y"] !== 1)
      ) {
        const sx =
          attrs["size-x"] > 1
            ? attrs["size-x"]
            : attrs.size > 1
              ? attrs.size
              : 1;
        const sy =
          attrs["size-y"] > 1
            ? attrs["size-y"]
            : attrs.size > 1
              ? attrs.size
              : 1;

        if (t.size) {
          try {
            start = this.concat(start, t.size(sx, sy));
            end = this.concat(end, t.size(1, 1));
          } catch (e: any) {
            throw new EPMLPluginError(e.message, "CommandMap:size");
          }
        }
      }
      if (attrs.charset) {
        const cp = CMD.CharsetMap[attrs.charset.toUpperCase()] ?? null;
        if (cp !== null) {
          if (t.charset) {
            try {
              start = this.concat(start, t.charset(cp));
              end = this.concat(end, t.charset(0));
            } catch (e: any) {
              throw new EPMLPluginError(e.message, "CommandMap:charset");
            }
          } else {
            this.warn(
              "Printer profile does not support custom charsets.",
              node.line,
              node.column,
              node.name,
            );
          }
        } else {
          this.warn(
            `Unknown charset ${attrs.charset}`,
            node.line,
            node.column,
            node.name,
          );
        }
      }
      if (attrs.smoothing) {
        if (t.smoothingOn) {
          start = this.concat(start, t.smoothingOn);
          end = this.concat(end, t.smoothingOff);
        }
      }
      return { start, end };
    };

    const fmt = compileFormat();

    const nodeScaleX =
      attrs["size-x"] > 1 ? attrs["size-x"] : attrs.size > 1 ? attrs.size : 1;

    const emitVerticalPadding = (lines: number) => {
      let vBytes = new Uint8Array();
      const shouldFill = attrs.invert || attrs["full-width"] || attrs.padding;
      const padChar =
        typeof attrs["padding-char"] === "string" && attrs["padding-char"]
          ? attrs["padding-char"]
          : " ";
      const padByte = new TextEncoder().encode(padChar)[0] || 0x20;
      for (let i = 0; i < lines; i++) {
        if (shouldFill) {
          const fillChars = Math.floor(this.receiptWidth / nodeScaleX);
          const spaces = new Uint8Array(fillChars).fill(padByte);
          vBytes = this.concat(vBytes, spaces);
        }
        vBytes = this.concat(vBytes, new Uint8Array([CMD.LF]));
      }
      return vBytes;
    };

    const h = this.commands.hardware;
    const l = this.commands.layout;

    const safelyExecute = (fn: any, args: any[], name: string) => {
      if (!fn) return new Uint8Array();
      try {
        return fn(...args);
      } catch (e: any) {
        throw new EPMLPluginError(e.message, `CommandMap:${name}`);
      }
    };

    // Set tight line spacing for inverted blocks with padding to eliminate
    // white gaps between dark lines (default line spacing > character height).
    const hasPadding = attrs["padding-top"] > 0 || attrs["padding-bottom"] > 0;
    const needsTightSpacing = attrs.invert && hasPadding;
    if (needsTightSpacing && l.lineSpacing) {
      const baseCharHeight = 24;
      const scaleY =
        attrs["size-y"] > 1 ? attrs["size-y"] : attrs.size > 1 ? attrs.size : 1;
      result = this.concat(
        result,
        safelyExecute(l.lineSpacing, [baseCharHeight * scaleY], "lineSpacing"),
      );
    }

    result = this.concat(result, fmt.start);

    if (attrs["padding-top"] > 0) {
      result = this.concat(result, emitVerticalPadding(attrs["padding-top"]));
    }

    switch (node.name) {
      case "receipt":
        if (attrs.init) result = this.concat(result, this.commands.init);
        result = this.concat(result, childBytes);
        break;
      case "br":
        result = this.concat(result, new Uint8Array([CMD.LF]));
        break;
      case "hr":
        const str = "-".repeat(this.receiptWidth);
        result = this.concat(result, new TextEncoder().encode(str + "\n"));
        break;
      case "text":
        let textBytes = childBytes;
        if (attrs["full-width"] || attrs.padding) {
          const tVisLen = this.getVisibleLength(node, 1);
          const tPadLen = Math.floor(
            Math.max(0, this.receiptWidth - tVisLen) / nodeScaleX,
          );
          const tPadChar = attrs["padding-char"] || " ";
          const tpc = new TextEncoder().encode(tPadChar)[0] || 0x20;

          let tLeftPad = 0,
            tRightPad = 0;
          if (attrs.align === "right") {
            tLeftPad = tPadLen;
          } else if (attrs.align === "center") {
            tLeftPad = Math.floor(tPadLen / 2);
            tRightPad = Math.ceil(tPadLen / 2);
          } else {
            tRightPad = tPadLen; // default left padding goes to right
          }
          textBytes = this.concat(
            new Uint8Array(tLeftPad).fill(tpc),
            textBytes,
          );
          textBytes = this.concat(
            textBytes,
            new Uint8Array(tRightPad).fill(tpc),
          );
        }
        result = this.concat(result, textBytes);
        if (!attrs.inline)
          result = this.concat(result, new Uint8Array([CMD.LF]));
        break;
      case "row":
        result = this.concat(result, childBytes);
        result = this.concat(result, new Uint8Array([CMD.LF]));
        break;
      case "cell":
        let cellWidth = 0;
        if (typeof attrs.width === "string" && attrs.width.endsWith("%")) {
          const pct = parseFloat(attrs.width.replace("%", ""));
          cellWidth = Math.floor((pct / 100) * this.receiptWidth);
        } else if (attrs.width) {
          cellWidth = parseInt(String(attrs.width), 10);
        } else {
          cellWidth = this.receiptWidth;
        }
        const cellVisLen = this.getVisibleLength(node, 1);
        const cellPadLen = Math.floor(
          Math.max(0, cellWidth - cellVisLen) / nodeScaleX,
        );
        const cellPadChar = attrs["padding-char"] || " ";
        const cpc = new TextEncoder().encode(cellPadChar)[0] || 0x20;

        let cLeftPad = 0,
          cRightPad = 0;
        if (attrs.align === "right") {
          cLeftPad = cellPadLen;
        } else if (attrs.align === "center") {
          cLeftPad = Math.floor(cellPadLen / 2);
          cRightPad = Math.ceil(cellPadLen / 2);
        } else {
          cRightPad = cellPadLen;
        }

        result = this.concat(result, new Uint8Array(cLeftPad).fill(cpc));
        result = this.concat(result, childBytes);
        result = this.concat(result, new Uint8Array(cRightPad).fill(cpc));
        break;
      case "feed":
        result = this.concat(
          result,
          safelyExecute(l.feedLines, [attrs.lines], "feedLines"),
        );
        break;
      case "feed-dots":
        result = this.concat(
          result,
          safelyExecute(l.feedDots, [attrs.n], "feedDots"),
        );
        break;
      case "feed-reverse":
        if (l.feedReverse)
          result = this.concat(
            result,
            safelyExecute(l.feedReverse, [attrs.lines], "feedReverse"),
          );
        else
          this.warn(
            "Printer profile does not support feed-reverse.",
            node.line,
            node.column,
            node.name,
          );
        break;
      case "drawer":
        if (attrs.pin === "2")
          result = this.concat(
            result,
            safelyExecute(h.drawerPin2, [attrs.on, attrs.off], "drawerPin2"),
          );
        else
          result = this.concat(
            result,
            safelyExecute(h.drawerPin5, [attrs.on, attrs.off], "drawerPin5"),
          );
        break;
      case "cut":
        if (attrs.mode === "full")
          result = this.concat(
            result,
            safelyExecute(h.cutFullFeed, [attrs.feed || 0], "cutFull"),
          );
        else
          result = this.concat(
            result,
            safelyExecute(h.cutPartialFeed, [attrs.feed || 0], "cutPartial"),
          );
        break;
      case "barcode":
        const bc = this.commands.barcodes;
        if (bc) {
          const hriPos =
            attrs.hri === "none"
              ? "none"
              : attrs.hri === "above"
                ? "above"
                : attrs.hri === "below"
                  ? "below"
                  : "both";
          result = this.concat(result, safelyExecute(bc.hri, [hriPos], "hri"));
          result = this.concat(
            result,
            safelyExecute(bc.hriFont, [attrs["hri-font"] || "a"], "hriFont"),
          );
          result = this.concat(
            result,
            safelyExecute(bc.height, [attrs.height || 50], "height"),
          );
          result = this.concat(
            result,
            safelyExecute(bc.width, [attrs.width || 3], "width"),
          );
          result = this.concat(
            result,
            safelyExecute(
              bc.print1d,
              [attrs.type, new TextDecoder().decode(childBytes)],
              "print1d",
            ),
          );
        }
        break;
      case "qr":
        if (this.commands.barcodes.printQr) {
          result = this.concat(
            result,
            safelyExecute(
              this.commands.barcodes.printQr,
              [new TextDecoder().decode(childBytes), attrs.size, attrs.error],
              "printQr",
            ),
          );
        }
        break;
      case "pdf417":
        if (this.commands.barcodes.printPdf417) {
          result = this.concat(
            result,
            safelyExecute(
              this.commands.barcodes.printPdf417,
              [
                new TextDecoder().decode(childBytes),
                {
                  cols: attrs.cols,
                  rows: attrs.rows,
                  error: attrs.error,
                  truncated: attrs.truncated,
                },
              ],
              "printPdf417",
            ),
          );
        } else {
          this.warn(
            "Printer profile does not support pdf417.",
            node.line,
            node.column,
            node.name,
          );
        }
        break;
      case "nv-image":
        if (this.commands.images.nvPrint) {
          const m =
            attrs.mode === "normal"
              ? "normal"
              : attrs.mode === "double-width"
                ? "double-width"
                : attrs.mode === "double-height"
                  ? "double-height"
                  : "quad";
          result = this.concat(
            result,
            safelyExecute(
              this.commands.images.nvPrint,
              [attrs.n, m],
              "nvPrint",
            ),
          );
        } else {
          this.warn(
            "Printer profile does not support nv-image.",
            node.line,
            node.column,
            node.name,
          );
        }
        break;
      case "image":
        result = this.concat(result, childBytes);
        break;
      default:
        result = this.concat(result, childBytes);
        break;
    }

    if (attrs["padding-bottom"] > 0) {
      // Ensure bottom padding starts on a fresh line rather than appending to text bytes.
      if (result.length === 0 || result[result.length - 1] !== CMD.LF) {
        result = this.concat(result, new Uint8Array([CMD.LF]));
      }
      result = this.concat(
        result,
        emitVerticalPadding(attrs["padding-bottom"]),
      );
    }
    result = this.concat(result, fmt.end);

    if (needsTightSpacing && l.defaultSpacing) {
      result = this.concat(result, l.defaultSpacing);
    }

    return result;
  }
}
