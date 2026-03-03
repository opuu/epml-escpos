export interface PrinterProfile {
  commands: {
    initialization: number[];
    text: {
      bold: { on: number[]; off: number[] };
      underline: { on: number[]; off: number[] };
      invert: { on: number[]; off: number[] };
      family: { a: number[]; b: number[] };
      size: (width: number, height: number) => number[];
      strike: { on: number[]; off: number[] };
      color: { black: number[]; red: number[] };
      rotate: { on: number[]; off: number[] };
      upsideDown: { on: number[]; off: number[] };
    };
    align: { left: number[]; center: number[]; right: number[] };
    layout: {
      newline: number[];
      feed: (lines: number) => number[];
      spacing: { default: number[]; set: (dots: number) => number[] };
    };
    hardware: {
      cut: { full: number[]; partial: number[] };
      drawer: { pin2: number[]; pin5: number[] };
      beep: (count: number, durationMS: number) => number[];
      barcode: (
        type: string,
        data: string,
        width: number,
        height: number,
        textPosition: string,
        textFont: string,
      ) => number[];
      qr: (data: string, size: number, errorCorrection: string) => number[];
      density: (level: number) => number[];
      image: (width: number, height: number, data: Uint8Array) => number[];
    };
  };
}
