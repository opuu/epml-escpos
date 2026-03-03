import { ASTNode, ElementNode } from "./ast";
import { PrinterProfile } from "../profiles/types";
import { StandardEpsonProfile } from "../profiles/standard-epson";

interface PrinterState {
  align: "left" | "center" | "right";
  bold: boolean;
  underline: boolean;
  invert: boolean;
  family: "a" | "b";
  width: number;
  height: number;
  strike: boolean;
  color: "black" | "red";
  rotate: boolean;
  upsideDown: boolean;
}

export class CodeGenerator {
  private bytes: number[] = [];
  private stateStack: PrinterState[] = [];
  private profile: PrinterProfile;
  private isNewLine: boolean = true;
  private layoutWidth: number = 48;

  constructor(
    private ast: ASTNode[],
    profile?: PrinterProfile,
  ) {
    this.profile = profile || StandardEpsonProfile;
  }

  private get currentState(): PrinterState {
    if (this.stateStack.length === 0) {
      return {
        align: "left",
        bold: false,
        underline: false,
        invert: false,
        family: "a",
        width: 1,
        height: 1,
        strike: false,
        color: "black",
        rotate: false,
        upsideDown: false,
      };
    }
    return this.stateStack[this.stateStack.length - 1];
  }

  public generate(): Uint8Array {
    this.bytes = [];

    const root = this.ast.find(
      (n) => n.type === "Element" && n.name === "receipt",
    ) as ElementNode;
    if (root && root.attributes["width"]) {
      this.layoutWidth = parseInt(root.attributes["width"], 10) || 48;
    }

    this.bytes.push(...this.profile.commands.initialization);
    this.stateStack = [
      {
        align: "left",
        bold: false,
        underline: false,
        invert: false,
        family: "a",
        width: 1,
        height: 1,
        strike: false,
        color: "black",
        rotate: false,
        upsideDown: false,
      },
    ];

    for (const node of this.ast) {
      this.generateNode(node);
    }

    // Reset printer formatting before exiting
    this.bytes.push(...this.profile.commands.initialization);

    return new Uint8Array(this.bytes);
  }

  private ensureNewLine() {
    if (!this.isNewLine) {
      this.bytes.push(...this.profile.commands.layout.newline);
      this.isNewLine = true;
    }
  }

  private pushState(newState: Partial<PrinterState>) {
    const current = this.currentState;
    const nextState: PrinterState = { ...current, ...newState };
    this.stateStack.push(nextState);
    this.applyStateDifferences(current, nextState);
  }

  private popState() {
    if (this.stateStack.length > 1) {
      const current = this.currentState;
      this.stateStack.pop();
      const previous = this.currentState;
      this.applyStateDifferences(current, previous);
    }
  }

  private applyStateDifferences(
    oldState: PrinterState,
    newState: PrinterState,
  ) {
    if (oldState.align !== newState.align) {
      this.bytes.push(...this.profile.commands.align[newState.align]);
    }
    if (oldState.bold !== newState.bold) {
      this.bytes.push(
        ...(newState.bold
          ? this.profile.commands.text.bold.on
          : this.profile.commands.text.bold.off),
      );
    }
    if (oldState.underline !== newState.underline) {
      this.bytes.push(
        ...(newState.underline
          ? this.profile.commands.text.underline.on
          : this.profile.commands.text.underline.off),
      );
    }
    if (oldState.invert !== newState.invert) {
      this.bytes.push(
        ...(newState.invert
          ? this.profile.commands.text.invert.on
          : this.profile.commands.text.invert.off),
      );
    }
    if (oldState.family !== newState.family) {
      this.bytes.push(
        ...(newState.family === "b"
          ? this.profile.commands.text.family.b
          : this.profile.commands.text.family.a),
      );
    }
    if (
      oldState.width !== newState.width ||
      oldState.height !== newState.height
    ) {
      this.bytes.push(
        ...this.profile.commands.text.size(newState.width, newState.height),
      );
    }
    if (oldState.strike !== newState.strike) {
      this.bytes.push(
        ...(newState.strike
          ? this.profile.commands.text.strike.on
          : this.profile.commands.text.strike.off),
      );
    }
    if (oldState.color !== newState.color) {
      this.bytes.push(
        ...(newState.color === "red"
          ? this.profile.commands.text.color.red
          : this.profile.commands.text.color.black),
      );
    }
    if (oldState.rotate !== newState.rotate) {
      this.bytes.push(
        ...(newState.rotate
          ? this.profile.commands.text.rotate.on
          : this.profile.commands.text.rotate.off),
      );
    }
    if (oldState.upsideDown !== newState.upsideDown) {
      this.bytes.push(
        ...(newState.upsideDown
          ? this.profile.commands.text.upsideDown.on
          : this.profile.commands.text.upsideDown.off),
      );
    }
  }

  private generateNode(node: ASTNode) {
    if (node.type === "Text") {
      this.encodeText(node.value);
    } else if (node.type === "Element") {
      this.generateElement(node);
    } else if (node.type === "ForLoop") {
      for (const child of node.children) {
        this.generateNode(child);
      }
    } else if (node.type === "Raw") {
      this.ensureNewLine();
      for (let i = 0; i < node.data.length; i++) {
        this.bytes.push(node.data[i]);
      }
      // After raw binary data (e.g. GS v 0 image), the printer resets position.
      // Do NOT inject a trailing LF as it could corrupt binary command data.
      this.isNewLine = true;
    }
  }

  private encodeText(text: string) {
    for (let i = 0; i < text.length; i++) {
      let code = text.charCodeAt(i);

      if (code === 0x0a) {
        this.isNewLine = true;
      } else {
        this.isNewLine = false;
      }

      if (code > 255) {
        code = 0x3f; // fallback '?' for non-ASCII
      }
      this.bytes.push(code);
    }
  }

  private generateElement(node: ElementNode) {
    const name = node.name.toLowerCase();

    switch (name) {
      case "receipt":
        node.children.forEach((c) => this.generateNode(c));
        break;
      case "b":
        this.pushState({ bold: true });
        node.children.forEach((c) => this.generateNode(c));
        this.popState();
        break;
      case "u":
        this.pushState({ underline: true });
        node.children.forEach((c) => this.generateNode(c));
        this.popState();
        break;
      case "i_text": {
        const fullWidth = node.attributes["full-width"] === "true";
        const hasPadding = node.attributes["padding"] === "true";
        const align = node.attributes["align"] || "left";

        if (fullWidth) {
          // Extract text content recursively to compute length
          const extractText = (nodes: ASTNode[]): string => {
            let t = "";
            for (const n of nodes) {
              if (n.type === "Text") t += n.value;
              if (n.type === "Element") t += extractText(n.children);
            }
            return t;
          };
          const rawText = extractText(node.children).trim();

          // Account for font size multiplier — check if children contain <font> with width
          let fontWidth = 1;
          const findFontWidth = (nodes: ASTNode[]) => {
            for (const n of nodes) {
              if (n.type === "Element" && n.name.toLowerCase() === "font") {
                const w = parseInt(n.attributes["width"] || "1", 10);
                if (w > fontWidth) fontWidth = w;
              }
              if (n.type === "Element") findFontWidth(n.children);
            }
          };
          findFontWidth(node.children);

          const effectiveWidth = Math.floor(this.layoutWidth / fontWidth);
          const textLen = rawText.length;
          const padLen = Math.max(0, effectiveWidth - textLen);

          let paddedText: string;
          if (align === "center") {
            const leftPad = Math.floor(padLen / 2);
            const rightPad = padLen - leftPad;
            paddedText = " ".repeat(leftPad) + rawText + " ".repeat(rightPad);
          } else if (align === "right") {
            paddedText = " ".repeat(padLen) + rawText;
          } else {
            paddedText = rawText + " ".repeat(padLen);
          }

          this.ensureNewLine();
          this.pushState({ invert: true });

          // Zero line spacing so padding lines sit flush against the text
          this.bytes.push(...this.profile.commands.layout.spacing.set(0));

          // Apply font size if any font element exists
          if (fontWidth > 1) {
            const fontHeight = this.currentState.height;
            this.bytes.push(
              ...this.profile.commands.text.size(
                fontWidth,
                fontHeight > 1 ? fontHeight : fontWidth,
              ),
            );
          }

          if (hasPadding) {
            // Top padding: an inverted blank line
            this.encodeText(" ".repeat(effectiveWidth));
            this.bytes.push(...this.profile.commands.layout.newline);
          }

          this.encodeText(paddedText);
          this.bytes.push(...this.profile.commands.layout.newline);

          if (hasPadding) {
            // Bottom padding: an inverted blank line
            this.encodeText(" ".repeat(effectiveWidth));
            this.bytes.push(...this.profile.commands.layout.newline);
          }

          // Restore default line spacing
          this.bytes.push(...this.profile.commands.layout.spacing.default);

          this.popState();
          this.isNewLine = true;
        } else {
          this.pushState({ invert: true });
          node.children.forEach((c) => this.generateNode(c));
          this.popState();
        }
        break;
      }
      case "strike":
        this.pushState({ strike: true });
        node.children.forEach((c) => this.generateNode(c));
        this.popState();
        break;
      case "font": {
        const widthStr = node.attributes["width"];
        const heightStr = node.attributes["height"];
        const familyStr = node.attributes["family"];
        const newState: Partial<PrinterState> = {};
        if (widthStr)
          newState.width = Math.max(
            1,
            Math.min(8, parseInt(widthStr, 10) || 1),
          );
        if (heightStr)
          newState.height = Math.max(
            1,
            Math.min(8, parseInt(heightStr, 10) || 1),
          );
        if (familyStr === "b" || familyStr === "a") newState.family = familyStr;
        this.pushState(newState);
        node.children.forEach((c) => this.generateNode(c));
        this.popState();
        break;
      }
      case "color": {
        const colorVal = node.attributes["value"];
        if (colorVal === "red" || colorVal === "black") {
          this.pushState({ color: colorVal });
          node.children.forEach((c) => this.generateNode(c));
          this.popState();
        } else {
          // Unknown color value — still render children with current state
          node.children.forEach((c) => this.generateNode(c));
        }
        break;
      }
      case "rotate":
        this.pushState({ rotate: true });
        node.children.forEach((c) => this.generateNode(c));
        this.popState();
        break;
      case "upside-down":
        this.pushState({ upsideDown: true });
        node.children.forEach((c) => this.generateNode(c));
        this.popState();
        break;
      case "center":
        this.ensureNewLine();
        this.pushState({ align: "center" });
        node.children.forEach((c) => this.generateNode(c));
        this.ensureNewLine();
        this.popState();
        break;
      case "left":
        this.ensureNewLine();
        this.pushState({ align: "left" });
        node.children.forEach((c) => this.generateNode(c));
        this.ensureNewLine();
        this.popState();
        break;
      case "right":
        this.ensureNewLine();
        this.pushState({ align: "right" });
        node.children.forEach((c) => this.generateNode(c));
        this.ensureNewLine();
        this.popState();
        break;
      case "br":
        this.bytes.push(...this.profile.commands.layout.newline);
        this.isNewLine = true;
        break;
      case "feed":
        const lines = parseInt(node.attributes["lines"] || "1", 10);
        this.bytes.push(...this.profile.commands.layout.feed(lines));
        this.isNewLine = true;
        break;
      case "cut":
        if (node.attributes["mode"] === "partial") {
          this.bytes.push(...this.profile.commands.hardware.cut.partial);
        } else {
          this.bytes.push(...this.profile.commands.hardware.cut.full);
        }
        this.isNewLine = true;
        break;
      case "beep":
        const count = parseInt(node.attributes["count"] || "1", 10);
        const duration = parseInt(node.attributes["duration"] || "50", 10);
        this.bytes.push(
          ...this.profile.commands.hardware.beep(count, duration),
        );
        break;
      case "open-drawer":
        if (node.attributes["pin"] === "5") {
          this.bytes.push(...this.profile.commands.hardware.drawer.pin5);
        } else {
          this.bytes.push(...this.profile.commands.hardware.drawer.pin2);
        }
        break;
      case "line-spacing": {
        const dotsStr = node.attributes["dots"];
        if (dotsStr !== undefined) {
          const dots = parseInt(dotsStr, 10);
          this.bytes.push(...this.profile.commands.layout.spacing.set(dots));
        }
        node.children.forEach((c) => this.generateNode(c));
        // Reset spacing after scoped children
        this.bytes.push(...this.profile.commands.layout.spacing.default);
        break;
      }
      case "reset-spacing":
        this.bytes.push(...this.profile.commands.layout.spacing.default);
        break;
      case "row": {
        // Row layout is pre-computed by the analyzer into flattened text children.
        // Just render the pre-computed content with a newline.
        this.ensureNewLine();
        node.children.forEach((c) => this.generateNode(c));
        this.bytes.push(...this.profile.commands.layout.newline);
        this.isNewLine = true;
        break;
      }
      case "barcode": {
        const type = node.attributes["type"] || "CODE128";
        const width = parseInt(node.attributes["width"] || "2", 10);
        const height = parseInt(node.attributes["height"] || "64", 10);
        const textPosition = node.attributes["text-position"] || "none";
        const textFont = node.attributes["text-font"] || "a";
        let data = "";
        const extractData = (children: ASTNode[]) => {
          for (const c of children) {
            if (c.type === "Text") data += c.value;
            if (c.type === "Element") extractData(c.children);
            // Variables are resolved to Text by the analyzer, so no Variable case needed
          }
        };
        extractData(node.children);
        this.ensureNewLine();
        this.bytes.push(
          ...this.profile.commands.hardware.barcode(
            type,
            data.trim(),
            width,
            height,
            textPosition,
            textFont,
          ),
        );
        this.ensureNewLine();
        break;
      }
      case "qr": {
        const size = parseInt(node.attributes["size"] || "3", 10);
        const err = node.attributes["error"] || "M";
        let data = "";
        node.children.forEach((c) => {
          if (c.type === "Text") data += c.value;
        });
        this.ensureNewLine();
        this.bytes.push(
          ...this.profile.commands.hardware.qr(data.trim(), size, err),
        );
        this.ensureNewLine();
        break;
      }
      case "hr":
        this.ensureNewLine();
        this.encodeText("-".repeat(this.layoutWidth));
        this.bytes.push(...this.profile.commands.layout.newline);
        this.isNewLine = true;
        break;
      case "density": {
        const levelStr = node.attributes["level"];
        if (levelStr !== undefined) {
          const level = parseInt(levelStr, 10);
          this.bytes.push(...this.profile.commands.hardware.density(level));
        }
        break;
      }
      default:
        node.children.forEach((c) => this.generateNode(c));
        break;
    }
  }
}
