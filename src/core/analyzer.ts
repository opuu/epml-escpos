import { ASTNode, ElementNode, TextNode } from "./ast";
import { EPMLSemanticError } from "./errors";

export class SemanticAnalyzer {
  private layoutWidth = 48; // default width

  constructor(
    private ast: ASTNode[],
    private data: any,
  ) {}

  /**
   * Strips `{{ }}` wrappers and whitespace from a variable path.
   */
  private normalizeVariablePath(raw: string): string {
    return raw.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
  }

  private resolvePath(path: string, context: any): any {
    const cleanPath = this.normalizeVariablePath(path);
    const parts = cleanPath.split(".");
    let current = context;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  public analyze(): ASTNode[] {
    // Retrieve receipt width
    const root = this.ast.find(
      (n) => n.type === "Element" && n.name === "receipt",
    ) as ElementNode;
    if (root && root.attributes["width"]) {
      this.layoutWidth = parseInt(root.attributes["width"], 10) || 48;
    }

    return this.processNodes(this.ast, this.data);
  }

  private processNodes(nodes: ASTNode[], context: any): ASTNode[] {
    const result: ASTNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      if (node.type === "Text") {
        // Drop pure formatting whitespace that causes unwanted line feeds
        const isFormatting =
          node.value.trim() === "" && node.value.includes("\n");
        if (!isFormatting) {
          result.push({ ...node });
        }
      } else if (node.type === "Variable") {
        const val = this.resolvePath(node.path, context);
        result.push({
          type: "Text",
          value: val !== undefined && val !== null ? String(val) : "",
          line: node.line,
          column: node.column,
        } as TextNode);
      } else if (node.type === "ForLoop") {
        const list = this.resolvePath(node.collectionPath, context);
        if (Array.isArray(list)) {
          for (const item of list) {
            const newContext = { ...context, [node.itemName]: item };
            result.push(...this.processNodes(node.children, newContext));
          }
        }
      } else if (node.type === "If") {
        let falseBranch: ASTNode[] = [];

        // Lookahead for optional <else>
        let lookahead = i + 1;
        let foundElse = false;

        while (lookahead < nodes.length) {
          const nextNode = nodes[lookahead];

          // Skip pure whitespace text nodes
          if (nextNode.type === "Text" && nextNode.value.trim() === "") {
            lookahead++;
            continue;
          }

          if (
            nextNode.type === "Element" &&
            nextNode.name.toLowerCase() === "else"
          ) {
            falseBranch = nextNode.children;
            foundElse = true;
            i = lookahead; // jump over to <else>
          }
          break; // Stop looking if we hit real content or non-else tags
        }

        const conditionVal = this.resolvePath(node.conditionPath, context);
        // Evaluate truthiness
        const isTruthy = Array.isArray(conditionVal)
          ? conditionVal.length > 0
          : !!conditionVal;

        if (isTruthy) {
          result.push(...this.processNodes(node.trueBranch, context));
        } else if (foundElse) {
          result.push(...this.processNodes(falseBranch, context));
        }
      } else if (node.type === "Element") {
        if (node.name === "row") {
          const processedChildren = this.processNodes(node.children, context);
          const rowNode = this.processRow({
            ...node,
            children: processedChildren,
          });
          result.push(rowNode);
        } else if (node.name === "hr") {
          // Replace <hr/> with a text node of dashes
          result.push({
            type: "Text",
            value: "-".repeat(this.layoutWidth),
            line: node.line,
            column: node.column,
          });
        } else {
          result.push({
            ...node,
            children: this.processNodes(node.children, context),
          });
        }
      } else if (node.type === "Raw") {
        // Passthrough pre-resolved raw byte nodes (e.g. images)
        result.push(node);
      }
    }

    return result;
  }

  private processRow(row: ElementNode): ElementNode {
    const cols = row.children.filter(
      (c) => c.type === "Element" && c.name === "col",
    ) as ElementNode[];

    let rowOutput = "";

    // Recursively extract all text from a node tree (ignoring formatting elements)
    const extractText = (nodes: ASTNode[]): string => {
      let text = "";
      for (const n of nodes) {
        if (n.type === "Text") text += n.value;
        if (n.type === "Element") text += extractText(n.children);
      }
      return text;
    };

    for (const col of cols) {
      const widthStr = col.attributes["width"] || "";
      const isPercent = widthStr.endsWith("%");
      const widthVal = parseFloat(widthStr);
      let colWidth = 0;

      if (!isNaN(widthVal)) {
        // Ensure percentage calculations result in whole numbers
        colWidth = isPercent
          ? Math.floor((widthVal / 100) * this.layoutWidth)
          : Math.floor(widthVal);
      }

      const align = col.attributes["align"] || "left";

      let textValue = extractText(col.children).trim();

      if (colWidth > 0 && textValue.length > colWidth) {
        textValue = textValue.substring(0, colWidth);
      }

      let padLen = colWidth > 0 ? colWidth - textValue.length : 0;
      if (padLen < 0) padLen = 0;

      if (align === "right") {
        rowOutput += " ".repeat(padLen) + textValue;
      } else if (align === "center") {
        const leftPad = Math.floor(padLen / 2);
        const rightPad = padLen - leftPad;
        rowOutput += " ".repeat(leftPad) + textValue + " ".repeat(rightPad);
      } else {
        rowOutput += textValue + " ".repeat(padLen);
      }
    }

    // Trim trailing spaces preventing strict 48-char auto-wrap double spacing on buggy printers
    rowOutput = rowOutput.trimEnd();

    return {
      ...row,
      children: [
        {
          type: "Text",
          value: rowOutput,
          line: row.line,
          column: row.column,
        },
      ],
    };
  }
}
