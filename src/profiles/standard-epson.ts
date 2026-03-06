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

export const StandardEpsonProfile: PrinterProfile = {
  name: "Standard Epson",
  supportedCharsets: [
    "PC437",
    "PC850",
    "PC858",
    "PC860",
    "PC863",
    "PC865",
    "WPC1252",
    "UTF8",
  ],
  commands: {
    init: new Uint8Array(CMD.INIT),

    text: {
      boldOn: new Uint8Array(CMD.TEXT.BOLD.on),
      boldOff: new Uint8Array(CMD.TEXT.BOLD.off),
      underlineOn: new Uint8Array(CMD.TEXT.UNDERLINE.on),
      underlineOff: new Uint8Array(CMD.TEXT.UNDERLINE.off),
      strikeOn: EMPTY_BYTES,
      strikeOff: EMPTY_BYTES,
      invertOn: new Uint8Array(CMD.TEXT.INVERT.on),
      invertOff: new Uint8Array(CMD.TEXT.INVERT.off),
      rotateOn: new Uint8Array(CMD.TEXT.ROTATE.on),
      rotateOff: new Uint8Array(CMD.TEXT.ROTATE.off),
      upsideDownOn: new Uint8Array(CMD.TEXT.UPSIDE_DOWN.on),
      upsideDownOff: new Uint8Array(CMD.TEXT.UPSIDE_DOWN.off),
      smoothingOn: new Uint8Array(CMD.TEXT.SMOOTHING.on),
      smoothingOff: new Uint8Array(CMD.TEXT.SMOOTHING.off),
      size: (sx: number, sy: number) => new Uint8Array(CMD.TEXT.SIZE(sx, sy)),
      color: null,
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
      motionUnits: (x: number, y: number) =>
        new Uint8Array(CMD.LAYOUT.MOTION_UNITS.set(x, y)),
      absolutePos: (n: number) =>
        new Uint8Array(CMD.LAYOUT.ABSOLUTE_POSITION.set(n)),
      relativePos: (n: number) =>
        new Uint8Array(CMD.LAYOUT.RELATIVE_POSITION.set(n)),
      pageModeOn: new Uint8Array(CMD.LAYOUT.PAGE_MODE.on),
      pageModeOff: new Uint8Array(CMD.LAYOUT.PAGE_MODE.off),
      printArea: (x: number, y: number, w: number, h: number) =>
        new Uint8Array(CMD.LAYOUT.PRINT_AREA.set(x, y, w, h)),
      printDirection: (dir: 0 | 1 | 2 | 3) =>
        new Uint8Array(CMD.LAYOUT.PRINT_DIRECTION.set(dir)),
    },

    hardware: {
      cutFull: new Uint8Array(CMD.HARDWARE.CUT.FULL()),
      cutPartial: new Uint8Array(CMD.HARDWARE.CUT.PARTIAL()),
      cutFullFeed: (n: number) => new Uint8Array(CMD.HARDWARE.CUT.FULL(n)),
      cutPartialFeed: (n: number) =>
        new Uint8Array(CMD.HARDWARE.CUT.PARTIAL(n)),
      drawerPin2: (on: number, off: number) =>
        new Uint8Array(CMD.HARDWARE.DRAWER.PIN2(on, off)),
      drawerPin5: (on: number, off: number) =>
        new Uint8Array(CMD.HARDWARE.DRAWER.PIN5(on, off)),
      beep: (count: number, durationMs: number) =>
        new Uint8Array(CMD.HARDWARE.BEEP.EPSON(count)),
      density: null,
      printSpeed: null,
      eject: null,
      realtimeStatus: new Uint8Array(CMD.HARDWARE.REALTIME_STATUS.set(1)),
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
      printPdf417: (data: string, params: PDF417Params) =>
        new Uint8Array(
          CMD.BARCODES.PDF417(
            params.cols,
            params.rows,
            params.error,
            params.truncated,
            data,
          ),
        ),
      printDataMatrix: (data: string) =>
        new Uint8Array(CMD.BARCODES.DATAMATRIX(data)),
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
