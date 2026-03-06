export { Lexer } from "./lexer.js";
export type { Token, TokenType } from "./lexer.js";
export { Parser } from "./parser.js";
export { SemanticAnalyzer } from "./semantic.js";
export { CodeGenerator } from "./codegen.js";
export { EPMLCompiler } from "./compiler.js";
export {
  createDefaultRasterizer,
  defaultRasterizeImage,
} from "./image-rasterizer.js";

// Export standard API Types
export * from "./types.js";
export * from "./plugin.js";

// Export Errors
export {
  EPMLError,
  EPMLSyntaxError,
  EPMLSemanticError,
  EPMLCodegenError,
  EPMLPluginError,
} from "./errors.js";
export type { EPMLWarning } from "./errors.js";

// Export Constants
export * as Commands from "./commands/index.js";

// Export Profiles
export { StandardEpsonProfile } from "./profiles/standard-epson.js";
export { StarMicronicsProfile } from "./profiles/star-micronics.js";
