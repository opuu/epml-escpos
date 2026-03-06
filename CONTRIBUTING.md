# Contributing to EPML ESC/POS

Thank you for your interest in contributing to `@opuu/epml-escpos`!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Build the project: `npm run build`

## Project Structure

- `src/compiler.ts`: Main entry point orchestrating parsing, analysis, and generation.
- `src/lexer.ts & parser.ts`: Convert EPML strings into AST nodes.
- `src/semantic.ts`: Applies the attribute schema rules to validate templates.
- `src/codegen.ts`: Traverses AST and concatenates raw `Uint8Array` ESC/POS bytes.
- **`src/plugin.ts`**: Contains the core `CommandMap` definition.
- `src/plugin-registry.ts`: Handles merging logic for plugins over base profiles.

---

## Creating a Plugin

The easiest way to contribute to EPML is by adding support for new thermal printers. Because EPML uses an Attribute-First design, you don't need to add new tags. Instead, you create a plugin that overrides the underlying `CommandMap`.

### 1. The `CommandMap` Interface

All operations that emit ESC/POS bytes are defined in the `CommandMap` interface (located in `src/plugin.ts`). This is a nested tree of byte sequences (represented as `Uint8Array`s) and command functions (that return `Uint8Array`s depending on parameters like lines, sizes, etc.).

### 2. Creating your Plugin

A plugin is just an object implementing the `EPMLPlugin` interface.

```typescript
import { EPMLPlugin } from "@opuu/epml-escpos";

export const MyCoolPrinterProfile: EPMLPlugin = {
  name: "my-cool-printer",
  version: 1, // Currently fixed at 1
  description: "Overrides commands for the CoolPrinter brand",

  // Create a DeepPartial<CommandMap> with the properties you want to override
  commands: {
    hardware: {
      // Override beep
      beep: (count, duration) =>
        new Uint8Array([0x1b, 0x42, count ?? 1, duration ?? 2]),

      // Explicitly nullify properties you know your printer doesn't support!
      // This allows the compiler to issue warnings
      drawerPin5: null,
    },
    text: {
      // Overriding standard byte sequences
      boldOn: new Uint8Array([0x1b, 0x47, 0x01]),
      boldOff: new Uint8Array([0x1b, 0x47, 0x00]),
    },
  },
};
```

### 3. Usage & Conflict Resolution

Users register plugins via `EPMLCompiler.use(MyCoolPrinterProfile)`.

Plugins use a **last-registered wins** strategy when deep merging the `CommandMap`. If two plugins define `hardware.beep`, the second registered plugin will override the first, and EPML will store an explicit `EPMLWarning` indicating the conflict.

### 4. Nullifying Commands

If your printer natively does not support a feature (e.g., cutting the paper), you should explicitly set that command to `null` in your plugin. When EPML registers it over the `StandardEpsonProfile` (which contains cut codes), it will log an `EPMLWarning`, and the code generator will gracefully skip trying to emit cutting sequences, avoiding undefined behavior.

## Submitting Pull Requests

- Please ensure all new commands/plugins are covered by tests.
- Run `npm run lint` before committing your changes.
- Ensure 100% successful compilation `npm run build` locally.
