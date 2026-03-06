export type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
    ? _DeepPartialArray<U>
    : T extends object
      ? _DeepPartialObject<T>
      : T | undefined;

type _DeepPartialArray<T> = Array<DeepPartial<T>>;
type _DeepPartialObject<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export type Barcode1DType =
  | "UPCA"
  | "UPCE"
  | "EAN13"
  | "EAN8"
  | "CODE39"
  | "ITF"
  | "CODABAR"
  | "CODE93"
  | "CODE128";

export type QRErrorLevel = "L" | "M" | "Q" | "H";

export interface PDF417Params {
  cols: number;
  rows: number;
  error: number;
  truncated: boolean;
}

export type NVImageMode = "normal" | "double-width" | "double-height" | "quad";

/**
 * The complete table of byte sequences for every logical operation
 * the EPML compiler can perform. Every value is either a concrete
 * Uint8Array, a function that returns one, or null if the operation
 * is not supported by this printer.
 */
export interface CommandMap {
  init: Uint8Array | null; // ESC @ or equivalent

  text: {
    boldOn: Uint8Array | null;
    boldOff: Uint8Array | null;
    underlineOn: Uint8Array | null;
    underlineOff: Uint8Array | null;
    strikeOn: Uint8Array | null;
    strikeOff: Uint8Array | null;
    invertOn: Uint8Array | null;
    invertOff: Uint8Array | null;
    rotateOn: Uint8Array | null;
    rotateOff: Uint8Array | null;
    upsideDownOn: Uint8Array | null;
    upsideDownOff: Uint8Array | null;
    smoothingOn: Uint8Array | null;
    smoothingOff: Uint8Array | null;
    size: ((sizeX: number, sizeY: number) => Uint8Array) | null;
    color: ((color: "black" | "red") => Uint8Array) | null;
    charset: ((codePage: number) => Uint8Array) | null;
    font: ((family: "a" | "b") => Uint8Array) | null;
  };

  alignment: {
    left: Uint8Array | null;
    center: Uint8Array | null;
    right: Uint8Array | null;
  };

  layout: {
    feedLines: ((lines: number) => Uint8Array) | null;
    feedDots: ((dots: number) => Uint8Array) | null;
    feedReverse: ((lines: number) => Uint8Array) | null;
    lineSpacing: ((dots: number) => Uint8Array) | null;
    defaultSpacing: Uint8Array | null;
    leftMargin: ((units: number) => Uint8Array) | null;
    printWidth: ((units: number) => Uint8Array) | null;
    motionUnits: ((x: number, y: number) => Uint8Array) | null;
    absolutePos: ((n: number) => Uint8Array) | null;
    relativePos: ((n: number) => Uint8Array) | null;
    pageModeOn: Uint8Array | null;
    pageModeOff: Uint8Array | null;
    printArea:
      | ((x: number, y: number, w: number, h: number) => Uint8Array)
      | null;
    printDirection: ((dir: 0 | 1 | 2 | 3) => Uint8Array) | null;
  };

  hardware: {
    cutFull: Uint8Array | null;
    cutPartial: Uint8Array | null;
    cutFullFeed: ((lines: number) => Uint8Array) | null;
    cutPartialFeed: ((lines: number) => Uint8Array) | null;
    drawerPin2: ((onMs: number, offMs: number) => Uint8Array) | null;
    drawerPin5: ((onMs: number, offMs: number) => Uint8Array) | null;
    beep: ((count: number, durationMs: number) => Uint8Array) | null;
    density: ((level: number) => Uint8Array) | null;
    printSpeed: ((level: number) => Uint8Array) | null;
    eject: Uint8Array | null;
    realtimeStatus: Uint8Array | null;
  };

  barcodes: {
    hri: ((position: "none" | "above" | "below" | "both") => Uint8Array) | null;
    hriFont: ((font: "a" | "b") => Uint8Array) | null;
    height: ((dots: number) => Uint8Array) | null;
    width: ((module: number) => Uint8Array) | null;
    print1d: ((type: Barcode1DType, data: string) => Uint8Array) | null;
    printQr:
      | ((data: string, size: number, errorLevel: QRErrorLevel) => Uint8Array)
      | null;
    printPdf417: ((data: string, params: PDF417Params) => Uint8Array) | null;
    printDataMatrix: ((data: string) => Uint8Array) | null;
    printMaxicode: ((data: string) => Uint8Array) | null;
  };

  images: {
    raster:
      | ((data: Uint8Array, width: number, height: number) => Uint8Array)
      | null;
    column:
      | ((data: Uint8Array, width: number, height: number) => Uint8Array)
      | null;
    nvPrint: ((slot: number, mode: NVImageMode) => Uint8Array) | null;
  };
}

/**
 * A plugin that overrides byte-level commands for a specific printer or printer family.
 * The template syntax is unchanged — the plugin only affects what bytes are emitted.
 */
export interface EPMLPlugin {
  /**
   * Unique identifier. Recommended format: "@scope/epml-plugin-<printer-model>"
   * or "epml-plugin-<printer-family>".
   */
  name: string;

  /**
   * Plugin API version. Must be 1.
   */
  version: 1;

  /**
   * Human-readable description of what printer(s) this plugin targets.
   * Shown in debug output and warnings.
   */
  description?: string;

  /**
   * Partial command map. Any key provided here overrides the corresponding
   * entry in the base profile's command map. Omitted keys fall through to
   * the base profile unchanged.
   *
   * Use null explicitly to mark a command as unsupported on this printer
   * (the compiler will emit a warning and skip the command rather than
   * using the base profile's bytes).
   */
  commands: DeepPartial<CommandMap>;
}
