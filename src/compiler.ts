import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { SemanticAnalyzer } from "./semantic.js";
import { CodeGenerator } from "./codegen.js";
import {
  PrinterProfile,
  CompileOptions,
  CompileResult,
  ASTNode,
  RasterizerFn,
  EPMLWarning,
  ImageRenderOptions,
} from "./types.js";
import { EPMLPlugin, CommandMap } from "./plugin.js";
import { PluginRegistry } from "./plugin-registry.js";
import { StandardEpsonProfile } from "./profiles/standard-epson.js";
import { createDefaultRasterizer } from "./image-rasterizer.js";

export class EPMLCompiler {
  /**
   * Register one or more plugins globally.
   */
  public static use(...plugins: EPMLPlugin[]): void {
    for (const plugin of plugins) {
      PluginRegistry.register(plugin);
    }
  }

  /**
   * Remove a previously registered plugin by name.
   */
  public static unuse(pluginName: string): void {
    PluginRegistry.unregister(pluginName);
  }

  /**
   * Return the names of all currently registered plugins.
   */
  public static registeredPlugins(): string[] {
    return PluginRegistry.getRegisteredPlugins();
  }

  /**
   * Compiles an EPML template string synchronously into raw ESC/POS.
   */
  public static compile(
    template: string,
    data: Record<string, unknown>,
    profile?: PrinterProfile,
    options?: CompileOptions,
  ): CompileResult {
    const activeProfile = profile || StandardEpsonProfile;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    const analyzer = new SemanticAnalyzer(ast, data, true, options);
    const analyzedAst = analyzer.analyze();

    // Determine initial receipt width from root <receipt> node
    let w = 48;
    for (const n of analyzedAst) {
      if (n.type === "Element" && n.name === "receipt" && n.attributes?.width) {
        w = n.attributes.width as number;
      }
    }

    const warnings: EPMLWarning[] = [];
    const commandMap: CommandMap = PluginRegistry.compileCommandMap(
      activeProfile.commands,
      options?.plugins || [],
      warnings,
    );

    const generator = new CodeGenerator(
      analyzedAst,
      commandMap,
      options,
      true,
      w,
    );

    const res = generator.generate();
    return { bytes: res.bytes, warnings: [...warnings, ...res.warnings] };
  }

  /**
   * Asynchronously compiles an EPML template allowing image rendering.
   */
  public static async compileAsync(
    template: string,
    data: Record<string, unknown>,
    imageRenderer: RasterizerFn,
    profile?: PrinterProfile,
    options?: CompileOptions,
  ): Promise<CompileResult>;
  public static async compileAsync(
    template: string,
    data: Record<string, unknown>,
    profile?: PrinterProfile,
    options?: CompileOptions,
  ): Promise<CompileResult>;
  public static async compileAsync(
    template: string,
    data: Record<string, unknown>,
    imageRendererOrProfile?: RasterizerFn | PrinterProfile,
    profileOrOptions?: PrinterProfile | CompileOptions,
    maybeOptions?: CompileOptions,
  ): Promise<CompileResult> {
    const { imageRenderer, profile, options } = this.resolveCompileAsyncArgs(
      imageRendererOrProfile,
      profileOrOptions,
      maybeOptions,
    );

    const activeRenderer =
      imageRenderer || createDefaultRasterizer(options?.image || {});
    const activeProfile = profile || StandardEpsonProfile;

    const lexer = new Lexer(template);
    const tokens = lexer.tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    const analyzer = new SemanticAnalyzer(ast, data, false, options);
    let analyzedAst = analyzer.analyze();

    const warnings: EPMLWarning[] = [];
    const commandMap: CommandMap = PluginRegistry.compileCommandMap(
      activeProfile.commands,
      options?.plugins || [],
      warnings,
    );

    analyzedAst = await this.resolveImages(
      analyzedAst,
      activeRenderer,
      commandMap,
    );

    let w = 48;
    for (const n of analyzedAst) {
      if (n.type === "Element" && n.name === "receipt" && n.attributes?.width) {
        w = n.attributes.width as number;
      }
    }

    const generator = new CodeGenerator(
      analyzedAst,
      commandMap,
      options,
      false,
      w,
    );
    const res = await generator.generateAsync();
    return { bytes: res.bytes, warnings: [...warnings, ...res.warnings] };
  }

  private static async resolveImages(
    nodes: ASTNode[],
    renderer: RasterizerFn,
    commands: CommandMap,
  ): Promise<ASTNode[]> {
    const result: ASTNode[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === "Element" && node.name.toLowerCase() === "image") {
        let imageSource = "";
        const attrs = (node.attributes || {}) as Record<string, unknown>;
        if (typeof attrs.src === "string" && attrs.src.trim()) {
          imageSource = attrs.src;
        } else {
          (node.children || []).forEach((c: ASTNode) => {
            if (c.type === "Text") imageSource += (c as any).value;
          });
        }
        imageSource = await this.normalizeImageSource(imageSource);

        const rawWidth = parseInt(
          (node.attributes as any)["width"] || "384",
          10,
        );
        const targetWidth = Number.isNaN(rawWidth) ? 384 : rawWidth;

        if (imageSource) {
          const imageOptions: ImageRenderOptions = {
            dither:
              typeof attrs.dither === "string"
                ? (attrs.dither as ImageRenderOptions["dither"])
                : undefined,
            threshold:
              typeof attrs.threshold === "number" ? attrs.threshold : undefined,
            scale: typeof attrs.scale === "number" ? attrs.scale : undefined,
            mode:
              typeof attrs.mode === "string"
                ? (attrs.mode as ImageRenderOptions["mode"])
                : undefined,
          };

          const res = await renderer(imageSource, targetWidth, imageOptions);
          const requestedMode = imageOptions.mode || "raster";

          if (requestedMode === "column" && commands.images.column) {
            const columnBytes = commands.images.column(
              res.data,
              res.width,
              res.height,
            );
            result.push({
              ...node,
              children: [
                {
                  type: "Raw",
                  data: new Uint8Array(columnBytes),
                  line: node.line,
                  column: node.column,
                },
              ],
            });
          } else if (commands.images.raster) {
            const rasterBytes = commands.images.raster(
              res.data,
              res.width,
              res.height,
            );
            result.push({
              ...node,
              children: [
                {
                  type: "Raw",
                  data: new Uint8Array(rasterBytes),
                  line: node.line,
                  column: node.column,
                },
              ],
            });
          } else {
            result.push(node);
          }
        } else {
          result.push(node);
        }
      } else if (
        node.type === "Element" ||
        node.type === "ForLoop" ||
        node.type === "If"
      ) {
        const processedNode = { ...node };
        if ((processedNode as any).children) {
          (processedNode as any).children = await this.resolveImages(
            (node as any).children,
            renderer,
            commands,
          );
        }
        if (processedNode.type === "If") {
          (processedNode as any).trueBranch = await this.resolveImages(
            (node as any).trueBranch,
            renderer,
            commands,
          );
          if ((processedNode as any).falseBranch) {
            (processedNode as any).falseBranch = await this.resolveImages(
              (node as any).falseBranch,
              renderer,
              commands,
            );
          }
        }
        result.push(processedNode);
      } else {
        result.push(node);
      }
    }
    return result;
  }

  private static compactDataUrl(value: string): string {
    const trimmed = value.trim();
    const commaIdx = trimmed.indexOf(",");
    if (commaIdx < 0) {
      return trimmed.replace(/\s+/g, "");
    }

    const header = trimmed.slice(0, commaIdx).replace(/\s+/g, "");
    const payload = trimmed.slice(commaIdx + 1).replace(/\s+/g, "");
    return `${header},${payload}`;
  }

  private static async normalizeImageSource(source: string): Promise<string> {
    const trimmed = source.trim();
    if (!trimmed) return "";

    if (/^data:/i.test(trimmed)) {
      return this.compactDataUrl(trimmed);
    }

    return trimmed;
  }

  private static resolveCompileAsyncArgs(
    imageRendererOrProfile?: RasterizerFn | PrinterProfile,
    profileOrOptions?: PrinterProfile | CompileOptions,
    maybeOptions?: CompileOptions,
  ): {
    imageRenderer?: RasterizerFn;
    profile?: PrinterProfile;
    options?: CompileOptions;
  } {
    let imageRenderer: RasterizerFn | undefined;
    let profile: PrinterProfile | undefined;
    let options: CompileOptions | undefined;

    if (typeof imageRendererOrProfile === "function") {
      imageRenderer = imageRendererOrProfile;

      if (this.isPrinterProfile(profileOrOptions)) {
        profile = profileOrOptions;
      } else {
        options = profileOrOptions as CompileOptions | undefined;
      }

      if (maybeOptions) {
        options = maybeOptions;
      }
    } else {
      profile = imageRendererOrProfile;

      if (this.isPrinterProfile(profileOrOptions)) {
        profile = profileOrOptions;
        options = maybeOptions;
      } else {
        options =
          (profileOrOptions as CompileOptions | undefined) || maybeOptions;
      }
    }

    return { imageRenderer, profile, options };
  }

  private static isPrinterProfile(value: unknown): value is PrinterProfile {
    if (!value || typeof value !== "object") {
      return false;
    }
    return "commands" in value;
  }
}
