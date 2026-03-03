import { Lexer } from "./core/lexer";
import { Parser } from "./core/parser";
import { SemanticAnalyzer } from "./core/analyzer";
import { CodeGenerator } from "./core/generator";
import { ASTNode } from "./core/ast";
import { PrinterProfile } from "./profiles/types";
import { StandardEpsonProfile } from "./profiles/standard-epson";

/**
 * The Facade for the EPML Compiler.
 * Handles the Lexer -> Parser -> Analyzer -> Generator pipeline.
 */
export class EPMLCompiler {
  /**
   * Compiles an EPML template string into a raw ESC/POS Uint8Array.
   *
   * @param template The EPML XML-like string.
   * @param data The JSON data payload for variable interpolation.
   * @param profile Optional custom printer profile (Defaults to Standard Epson).
   * @returns A Uint8Array of bytes ready to be sent to a thermal printer.
   * @throws {EPMLSyntaxError} If the template contains malformed EPML syntax.
   */
  public static compile(
    template: string,
    data: any,
    profile?: PrinterProfile,
  ): Uint8Array {
    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    const analyzer = new SemanticAnalyzer(ast, data);
    const analyzedAst = analyzer.analyze();

    const generator = new CodeGenerator(analyzedAst, profile);
    return generator.generate();
  }

  /**
   * Asynchronously compiles an EPML template allowing image rendering.
   *
   * @param template The EPML XML-like string.
   * @param data The JSON data payload for variable interpolation.
   * @param imageRenderer A callback that fetches and dithers the target image into a 1-bit raster array.
   * @param profile Optional custom printer profile.
   * @returns A Promise resolving to the Uint8Array byte sequence.
   */
  public static async compileAsync(
    template: string,
    data: any,
    imageRenderer: (
      url: string,
      targetWidth: number,
    ) => Promise<{ data: Uint8Array; width: number; height: number }>,
    profile?: PrinterProfile,
  ): Promise<Uint8Array> {
    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    const analyzer = new SemanticAnalyzer(ast, data);
    const analyzedAst = analyzer.analyze();

    const activeProfile = profile || StandardEpsonProfile;
    await this.resolveImages(analyzedAst, imageRenderer, activeProfile);

    const generator = new CodeGenerator(analyzedAst, activeProfile);
    return generator.generate();
  }

  private static async resolveImages(
    nodes: ASTNode[],
    renderer: (
      dataUrl: string,
      targetWidth: number,
    ) => Promise<{ data: Uint8Array; width: number; height: number }>,
    profile: PrinterProfile,
  ) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === "Element" && node.name.toLowerCase() === "image") {
        let dataUrl = "";
        node.children.forEach((c: ASTNode) => {
          if (c.type === "Text") dataUrl += c.value;
        });
        dataUrl = dataUrl.trim();
        const targetWidth = parseInt(node.attributes["width"] || "384", 10);

        if (dataUrl) {
          try {
            const result = await renderer(dataUrl, targetWidth);
            const rasterBytes = profile.commands.hardware.image(
              result.width,
              result.height,
              result.data,
            );
            nodes[i] = {
              type: "Raw",
              data: new Uint8Array(rasterBytes),
              line: node.line,
              column: node.column,
            };
          } catch (e) {
            console.error(
              "Failed to render image:",
              dataUrl.substring(0, 30) + "...",
              e,
            );
          }
        }
      } else if (node.type === "Element") {
        await this.resolveImages(node.children, renderer, profile);
      } else if (node.type === "ForLoop") {
        await this.resolveImages(node.children, renderer, profile);
      } else if (node.type === "If") {
        await this.resolveImages(node.trueBranch, renderer, profile);
        if (node.falseBranch) {
          await this.resolveImages(node.falseBranch, renderer, profile);
        }
      }
    }
  }
}

// Export Types and Core Classes
export { Lexer, TokenType, Token } from "./core/lexer";
export { Parser } from "./core/parser";
export { SemanticAnalyzer } from "./core/analyzer";
export { CodeGenerator } from "./core/generator";
export * from "./core/ast";
export { EPMLSyntaxError, EPMLSemanticError } from "./core/errors";

// Export Profiles
export * from "./profiles/types";
export { StandardEpsonProfile } from "./profiles/standard-epson";
export { StarMicronicsProfile } from "./profiles/star-micronics";
