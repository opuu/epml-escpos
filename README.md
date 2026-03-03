# @opuu/epml-escpos

<p align="left">
  <img src="https://img.shields.io/npm/v/@opuu/epml-escpos" alt="NPM Version" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/zero-dependencies-brightgreen" alt="Zero Dependencies" />
</p>

A compiler for **EPML (ESC/POS Markup Language)** — an XML-style templating language for thermal printers. Write expressive markup, feed JSON data, and get raw ESC/POS byte arrays ready to send to hardware.

## Features

- **XML-style templating** — Intuitive tags for text formatting, alignment, tables, and hardware commands
- **Variable interpolation** — Handlebars-style `{{ variable.path }}` syntax with deep path resolution
- **Control flow** — `<for>` loops and `<if>`/`<else>` conditional rendering
- **Table layout** — `<row>`/`<col>` with percentage widths and column alignment
- **Barcode & QR codes** — CODE128, EAN13, QR and more with configurable parameters
- **Image support** — Async image rendering pipeline with pluggable rasterizer
- **Printer profiles** — Pluggable command profiles for Epson, Star Micronics, and custom hardware
- **Zero dependencies** — Pure TypeScript, no runtime dependencies

## Installation

```bash
npm install @opuu/epml-escpos
```

## Quick Start

```typescript
import { EPMLCompiler } from "@opuu/epml-escpos";

const template = `
<receipt width="48">
  <center><b>My Coffee Shop</b></center>
  <br/>
  <left>Hello, {{ customer.name }}!</left>
  <hr/>
  <row>
    <col width="50%">Americano</col>
    <col width="50%" align="right">$3.50</col>
  </row>
  <feed lines="3"/>
  <cut mode="partial"/>
  <open-drawer pin="2"/>
</receipt>
`;

const data = {
  customer: { name: "Jane Doe" },
};

const receiptBytes = EPMLCompiler.compile(template, data);
// receiptBytes is a Uint8Array ready to send to your printer transport
```

## Async Compilation (Images)

To include images, use `compileAsync` with a renderer callback that fetches and dithers images into 1-bit raster data:

```typescript
import { EPMLCompiler } from "@opuu/epml-escpos";

const template = `
<receipt width="48">
  <center>
    <image width="200">/logo.png</image>
  </center>
  <cut/>
</receipt>
`;

const bytes = await EPMLCompiler.compileAsync(
  template,
  {},
  async (url, targetWidth) => {
    // Your image loading and dithering logic here
    // Must return: { data: Uint8Array (1-bit raster), width: number, height: number }
    return await loadAndDitherImage(url, targetWidth);
  },
);
```

## Custom Printer Profiles

Not all printers follow standard Epson ESC/POS. Define a custom profile to override specific commands:

```typescript
import {
  EPMLCompiler,
  PrinterProfile,
  StandardEpsonProfile,
} from "@opuu/epml-escpos";

const MyPrinter: PrinterProfile = {
  ...StandardEpsonProfile,
  commands: {
    ...StandardEpsonProfile.commands,
    hardware: {
      ...StandardEpsonProfile.commands.hardware,
      cut: {
        full: [0x1d, 0x56, 0x41, 0x00],
        partial: [0x1d, 0x56, 0x42, 0x00],
      },
    },
  },
};

const bytes = EPMLCompiler.compile(template, data, MyPrinter);
```

Built-in profiles: `StandardEpsonProfile`, `StarMicronicsProfile`.

## Tag Reference

### Document

| Tag         | Attributes | Description                                                                 |
| ----------- | ---------- | --------------------------------------------------------------------------- |
| `<receipt>` | `width`    | Root element. Sets the character width of the printable area (default: 48). |

### Text Formatting

| Tag             | Attributes                       | Description                                                                                                                                             |
| --------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<b>`           | —                                | Bold text.                                                                                                                                              |
| `<u>`           | —                                | Underlined text.                                                                                                                                        |
| `<strike>`      | —                                | Strikethrough text.                                                                                                                                     |
| `<i_text>`      | `full-width`, `padding`, `align` | Inverted text (white on black). With `full-width="true"`, fills the entire receipt width. With `padding="true"`, adds blank inverted lines above/below. |
| `<font>`        | `width`, `height`, `family`      | Text size (1–8) and font family (`a` or `b`).                                                                                                           |
| `<color>`       | `value`                          | Text color: `"black"` or `"red"` (dual-color printers).                                                                                                 |
| `<rotate>`      | —                                | 90° clockwise text rotation.                                                                                                                            |
| `<upside-down>` | —                                | 180° rotated text.                                                                                                                                      |

### Alignment

| Tag        | Description           |
| ---------- | --------------------- |
| `<center>` | Center-align content. |
| `<left>`   | Left-align content.   |
| `<right>`  | Right-align content.  |

### Layout

| Tag               | Attributes       | Description                                                                        |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `<br/>`           | —                | Line break.                                                                        |
| `<hr/>`           | —                | Horizontal rule (dashes filling receipt width).                                    |
| `<feed>`          | `lines`          | Feed paper by N lines.                                                             |
| `<line-spacing>`  | `dots`           | Set line spacing in dots for contained elements. Resets when closed.               |
| `<reset-spacing>` | —                | Manually reset line spacing to default.                                            |
| `<row>`           | —                | Table row. Must contain `<col>` children.                                          |
| `<col>`           | `width`, `align` | Table column. Width as `%` or character count. Align: `left` / `center` / `right`. |

### Hardware

| Tag             | Attributes          | Description                                 |
| --------------- | ------------------- | ------------------------------------------- |
| `<cut>`         | `mode`              | Paper cut. `"full"` or `"partial"`.         |
| `<beep>`        | `count`, `duration` | Buzzer beep. Duration in ms.                |
| `<open-drawer>` | `pin`               | Cash drawer kick pulse. Pin `"2"` or `"5"`. |
| `<density>`     | `level`             | Print density (0–15).                       |

### Data

| Tag         | Attributes                                              | Description                                                                                          |
| ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `<barcode>` | `type`, `width`, `height`, `text-position`, `text-font` | 1D barcode. Types: `CODE128`, `EAN13`, `EAN8`, `UPCA`, `UPCE`, `CODE39`, `CODE93`, `ITF`, `CODABAR`. |
| `<qr>`      | `size`, `error`                                         | QR code. Size: 1–16. Error correction: `L` / `M` / `Q` / `H`.                                        |
| `<image>`   | `width`                                                 | Raster image (requires `compileAsync`).                                                              |

### Control Flow

| Tag      | Attributes   | Description                                                                       |
| -------- | ------------ | --------------------------------------------------------------------------------- |
| `<for>`  | `each`, `in` | Loop over a JSON array. `each` names the iterator, `in` references the data path. |
| `<if>`   | `condition`  | Conditional block. Renders content when the data path is truthy.                  |
| `<else>` | —            | False branch for the preceding `<if>`.                                            |

### Variables

Use `{{ path.to.value }}` anywhere in text content to interpolate JSON data values. Supports dot-notation for nested objects. Undefined values render as empty strings.

## Architecture

The compiler runs a four-stage pipeline:

```
Template String → Lexer → Parser → Semantic Analyzer → Code Generator → Uint8Array
                  tokens    AST     resolved AST         ESC/POS bytes
```

Each stage is independently accessible:

```typescript
import {
  Lexer,
  Parser,
  SemanticAnalyzer,
  CodeGenerator,
} from "@opuu/epml-escpos";

const tokens = new Lexer(template).tokenize();
const ast = new Parser(tokens).parse();
const resolved = new SemanticAnalyzer(ast, data).analyze();
const bytes = new CodeGenerator(resolved).generate();
```

## Error Handling

The compiler throws typed errors with line/column information:

```typescript
import { EPMLSyntaxError, EPMLSemanticError } from "@opuu/epml-escpos";

try {
  EPMLCompiler.compile(template, data);
} catch (err) {
  if (err instanceof EPMLSyntaxError) {
    console.error(`Template error at line ${err.line}: ${err.message}`);
  }
}
```

## License

MIT
