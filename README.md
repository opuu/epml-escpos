# EPML ESC/POS Markup Language

`@opuu/epml-escpos` is an XML-like template compiler for thermal receipt printers.
It transforms EPML templates plus JSON data into raw ESC/POS bytes (`Uint8Array`).

## Features

- XML-style receipt templates
- Variable interpolation with dot-paths (`{{ order.total }}`)
- Control flow: `<for>`, `<if>`, `<else/>`
- Universal text styling attributes (bold, underline, invert, size, align, etc.)
- Layout helpers: `<row>`, `<cell>`, `<hr/>`, `<feed/>`
- Barcode support: 1D, QR, PDF417
- Async image rendering from file path, URL, or data URL
- Printer profiles (Standard Epson, Star Micronics ESC/POS mode)
- Plugin system for overriding command bytes per printer family
- Structured warnings and typed error classes

## Installation

```bash
npm install @opuu/epml-escpos
```

## Quick Start (Synchronous)

Use `compile()` when your template does not contain `<image>`.

```ts
import { EPMLCompiler } from "@opuu/epml-escpos";

const template = `
<receipt width="48" init="true">
  <text align="center" bold size="2">MY STORE</text>
  <hr/>
  <row>
    <cell width="70%">Coffee</cell>
    <cell width="30%" align="right">$3.50</cell>
  </row>
  <row>
    <cell width="70%" bold>TOTAL</cell>
    <cell width="30%" align="right" bold>$3.50</cell>
  </row>
  <feed lines="2"/>
  <cut mode="partial"/>
</receipt>
`;

const data = {};
const result = EPMLCompiler.compile(template, data);

// Raw ESC/POS bytes
const bytes: Uint8Array = result.bytes;

// Non-fatal warnings (e.g. unsupported capability in selected profile)
console.log(result.warnings);
```

## Quick Start (Asynchronous + Images)

`<image>` requires `compileAsync()`.

```ts
import { EPMLCompiler } from "@opuu/epml-escpos";

const template = `
<receipt width="48" init="true">
  <text align="center">Logo</text>
  <image width="200" dither="floyd-steinberg">https://example.com/logo.png</image>
  <feed lines="2"/>
  <cut mode="full"/>
</receipt>
`;

const result = await EPMLCompiler.compileAsync(template, {});
const bytes = result.bytes;
```

Image source can be:

- local file path
- `http://` or `https://` URL
- `data:` URL

## Sending Bytes to a Network Printer

```ts
import net from "node:net";
import { EPMLCompiler } from "@opuu/epml-escpos";

const { bytes } = EPMLCompiler.compile(`<text>Hello printer</text>`, {});

const socket = new net.Socket();
socket.connect(9100, "192.168.1.50", () => {
  socket.write(Buffer.from(bytes), () => socket.destroy());
});
```

## Template Language

### Data Interpolation

Use `{{ path }}` where `path` is dot notation:

- `{{ customer.name }}`
- `{{ items.0.price }}`

Missing values render as an empty string.

### Control Flow

```xml
<for item="line" in="cart.items">
  <row>
    <cell width="70%">{{ line.name }}</cell>
    <cell width="30%" align="right">{{ line.price }}</cell>
  </row>
</for>

<if condition="customer.isMember">
  <text bold>MEMBER PRICE APPLIED</text>
  <else/>
  <text>Sign up for rewards next time.</text>
</if>
```

### Supported Tags

- `<receipt>`
- `<text>`
- `<br/>`
- `<hr/>`
- `<row>`
- `<cell>` (alias: `<col>`)
- `<for>`
- `<if>` + `<else/>`
- `<feed/>`
- `<feed-dots/>`
- `<feed-reverse/>` (profile-dependent)
- `<drawer/>` (alias: `<open-drawer>`)
- `<cut/>`
- `<barcode>`
- `<qr>`
- `<pdf417>`
- `<image>` (async only)
- `<nv-image>`

HTML comments are supported and ignored by the lexer (`<!-- comment -->`).

### Universal Text Attributes

These are accepted on text-capable tags such as `<text>`, `<cell>`, `<row>`, and `<receipt>`.

| Attribute | Type | Default | Notes |
| --- | --- | --- | --- |
| `align` | `left \| center \| right` | `left` | Text alignment |
| `bold` | boolean | `false` | |
| `underline` | boolean | `false` | |
| `strike` | boolean | `false` | |
| `invert` | boolean | `false` | White-on-black mode |
| `rotate` | boolean | `false` | |
| `upside-down` | boolean | `false` | |
| `color` | `black \| red` | `black` | Profile-dependent |
| `font` | `a \| b` | `a` | |
| `size` | number | `1` | Uniform X/Y scale |
| `size-x` | number | `1` | Horizontal scale override |
| `size-y` | number | `1` | Vertical scale override |
| `charset` | string | - | Must be supported by profile |
| `smoothing` | boolean | `false` | Profile-dependent |
| `padding` | boolean | `false` | Fill remaining width with `padding-char` |
| `full-width` | boolean | `false` | Similar to padding behavior for text blocks |
| `inline` | boolean | `false` | Prevent automatic trailing LF for `<text>` |
| `padding-char` | string | space | First byte is used |
| `padding-top` | number | `0` | Adds filled blank lines before content |
| `padding-bottom` | number | `0` | Adds filled blank lines after content |

### Tag-Specific Attributes

- `<receipt width="48" init="true">`
- `<cell width="50%">` or `<cell width="24">`
- `<feed lines="1"/>`
- `<feed-dots n="24"/>`
- `<feed-reverse lines="1"/>`
- `<drawer pin="2|5" on="50" off="50"/>`
- `<cut mode="full|partial" feed="0"/>`
- `<barcode type="CODE128" hri="none|above|below|both" hri-font="a|b" height="50" width="3">...data...</barcode>`
- `<qr size="3" error="L|M|Q|H">...data...</qr>`
- `<pdf417 cols="0" rows="0" error="0" truncated="false">...data...</pdf417>`
- `<image src="..." mode="raster|column" scale="1" dither="threshold|bayer|floyd-steinberg" threshold="128" width="384"/>`
- `<nv-image n="1" mode="normal|double-width|double-height|quad"/>`

## Profiles

The default profile is `StandardEpsonProfile`.

```ts
import { EPMLCompiler, StarMicronicsProfile } from "@opuu/epml-escpos";

const result = EPMLCompiler.compile(template, data, StarMicronicsProfile);
```

Built-in exports:

- `StandardEpsonProfile`
- `StarMicronicsProfile`

## Plugins

Plugins override selected parts of the active profile command map.

```ts
import { EPMLCompiler, type EPMLPlugin } from "@opuu/epml-escpos";

const plugin: EPMLPlugin = {
  name: "my-printer-overrides",
  version: 1,
  commands: {
    text: {
      boldOn: new Uint8Array([0x1b, 0x45, 0x01]),
    },
  },
};

EPMLCompiler.use(plugin); // global registration

const result = EPMLCompiler.compile("<text bold>Hello</text>", {});

EPMLCompiler.unuse("my-printer-overrides");
```

You can also pass local plugins per compile call:

```ts
EPMLCompiler.compile(template, data, undefined, {
  plugins: [plugin],
});
```

## API Overview

### `EPMLCompiler.compile(template, data, profile?, options?)`

- Synchronous compilation
- Returns `CompileResult`
- Throws on syntax/semantic/codegen/plugin errors
- Cannot process `<image>` tags

### `EPMLCompiler.compileAsync(template, data, imageRendererOrProfile?, profileOrOptions?, maybeOptions?)`

- Asynchronous compilation
- Supports `<image>` tags
- Uses built-in rasterizer if you do not provide one

### `CompileResult`

```ts
interface CompileResult {
  bytes: Uint8Array;
  warnings: EPMLWarning[];
}
```

## Errors and Warnings

Error classes:

- `EPMLError`
- `EPMLSyntaxError`
- `EPMLSemanticError`
- `EPMLCodegenError`
- `EPMLPluginError`

Warnings are returned in `CompileResult.warnings` and include source stage and optional line/column metadata.

## Deprecated Tags

The following legacy tags are removed in favor of universal text attributes:

- `<b>`, `<u>`, `<strike>`
- `<center>`, `<left>`, `<right>`
- `<color>`, `<font>`
- `<rotate>`, `<upside-down>`
- `<i_text>`
- `<line-spacing>`, `<reset-spacing>`

Use `<text ...attributes...>` instead.

## Development

```bash
npm run build
npm test
```

## License

MIT
