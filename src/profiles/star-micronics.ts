import { PrinterProfile } from "./types.js";
import {
  CommandMap,
  Barcode1DType,
  QRErrorLevel,
  PDF417Params,
  NVImageMode,
} from "../plugin.js";
import * as CMD from "../commands/index.js";

const EMPTY_BYTES = new Uint8Array();

export const StarMicronicsProfile: PrinterProfile = {
  name: "Star Micronics (ESC/POS Mode)",
  supportedCharsets: ["PC437", "PC858", "UTF8"],
  commands: {
    init: new Uint8Array(CMD.INIT),

    text: {
      boldOn: new Uint8Array(CMD.TEXT.BOLD.on),
      boldOff: new Uint8Array(CMD.TEXT.BOLD.off),
      underlineOn: new Uint8Array(CMD.TEXT.UNDERLINE.on),
      underlineOff: new Uint8Array(CMD.TEXT.UNDERLINE.off),
      strikeOn: new Uint8Array([CMD.ESC, 0x24, 1]),
      strikeOff: new Uint8Array([CMD.ESC, 0x24, 0]),
      invertOn: new Uint8Array(CMD.TEXT.INVERT.on),
      invertOff: new Uint8Array(CMD.TEXT.INVERT.off),
      rotateOn: new Uint8Array(CMD.TEXT.ROTATE.on),
      rotateOff: new Uint8Array(CMD.TEXT.ROTATE.off),
      upsideDownOn: new Uint8Array(CMD.TEXT.UPSIDE_DOWN.on),
      upsideDownOff: new Uint8Array(CMD.TEXT.UPSIDE_DOWN.off),
      smoothingOn: null,
      smoothingOff: null,
      size: (sx: number, sy: number) => new Uint8Array(CMD.TEXT.SIZE(sx, sy)),
      color: (c: "black" | "red") =>
        new Uint8Array(c === "red" ? [CMD.ESC, 0x35] : [CMD.ESC, 0x34]),
      charset: (cp: number) => new Uint8Array(CMD.CHARSET.setPage(cp)),
      font: (f: "a" | "b") => new Uint8Array(CMD.TEXT.FONT[f]),
    },

    alignment: {
      left: new Uint8Array(CMD.TEXT.ALIGN.left),
      center: new Uint8Array(CMD.TEXT.ALIGN.center),
      right: new Uint8Array(CMD.TEXT.ALIGN.right),
    },

    layout: {
      feedLines: (n: number) => new Uint8Array(CMD.LAYOUT.FEED.LINES(n)),
      feedDots: (n: number) => new Uint8Array(CMD.LAYOUT.FEED.DOTS(n)),
      feedReverse: null,
      lineSpacing: (n: number) =>
        new Uint8Array(CMD.LAYOUT.LINE_SPACING.set(n)),
      defaultSpacing: new Uint8Array(CMD.LAYOUT.LINE_SPACING.default),
      leftMargin: (n: number) => new Uint8Array(CMD.LAYOUT.LEFT_MARGIN.set(n)),
      printWidth: (n: number) => new Uint8Array(CMD.LAYOUT.PRINT_WIDTH.set(n)),
      motionUnits: null,
      absolutePos: (n: number) =>
        new Uint8Array(CMD.LAYOUT.ABSOLUTE_POSITION.set(n)),
      relativePos: (n: number) =>
        new Uint8Array(CMD.LAYOUT.RELATIVE_POSITION.set(n)),
      pageModeOn: null,
      pageModeOff: null,
      printArea: null,
      printDirection: null,
    },

    hardware: {
      cutFull: new Uint8Array([CMD.ESC, 0x64, 0x30]),
      cutPartial: new Uint8Array([CMD.ESC, 0x64, 0x31]),
      cutFullFeed: (n: number) => new Uint8Array([CMD.ESC, 0x64, 0x30]),
      cutPartialFeed: (n: number) => new Uint8Array([CMD.ESC, 0x64, 0x31]),
      drawerPin2: (on: number, off: number) =>
        new Uint8Array([CMD.ESC, 0x07, on, off]),
      drawerPin5: (on: number, off: number) =>
        new Uint8Array([CMD.ESC, 0x07, on, off]),
      beep: (count: number, durationMs: number) =>
        new Uint8Array(CMD.HARDWARE.BEEP.STAR(count)),
      density: null,
      printSpeed: null,
      eject: null,
      realtimeStatus: null,
    },

    barcodes: {
      hri: (pos: "none" | "above" | "below" | "both") => {
        const p =
          pos === "none" ? 0 : pos === "above" ? 1 : pos === "below" ? 2 : 3;
        return new Uint8Array(CMD.BARCODES.HRI.set(p));
      },
      hriFont: (font: "a" | "b") =>
        new Uint8Array(CMD.BARCODES.HRI_FONT.set(font)),
      height: (dots: number) => new Uint8Array(CMD.BARCODES.HEIGHT.set(dots)),
      width: (module: number) => new Uint8Array(CMD.BARCODES.WIDTH.set(module)),
      print1d: (type: Barcode1DType, data: string) =>
        new Uint8Array(CMD.BARCODES.PRINT(type, data)),
      printQr: (data: string, size: number, errorLevel: QRErrorLevel) =>
        new Uint8Array(CMD.BARCODES.QR(size, errorLevel, data)),
      printPdf417: null,
      printDataMatrix: null,
      printMaxicode: null,
    },

    images: {
      raster: (data: Uint8Array, width: number, height: number) =>
        new Uint8Array(CMD.IMAGES.raster(width, height, data)),
      column: (data: Uint8Array, width: number, height: number) =>
        new Uint8Array(CMD.IMAGES.column(width, height, data)),
      nvPrint: (slot: number, mode: NVImageMode) => {
        const m =
          mode === "normal"
            ? 0
            : mode === "double-width"
              ? 1
              : mode === "double-height"
                ? 2
                : 3;
        return new Uint8Array(CMD.IMAGES.nvImage(slot, m));
      },
    },
  },
};
