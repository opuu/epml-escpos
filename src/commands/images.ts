export const GS = 0x1d;
export const ESC = 0x1b;
export const FS = 0x1c;

export const IMAGES = {
  raster: (width: number, height: number, data: Uint8Array) => {
    const xL = Math.ceil(width / 8) & 0xff;
    const xH = Math.ceil(width / 8) >> 8;
    const yL = height & 0xff;
    const yH = height >> 8;
    return [GS, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...Array.from(data)];
  },
  column: (width: number, height: number, data: Uint8Array) => {
    const n1 = width & 0xff;
    const n2 = width >> 8;
    const expected = width * 3;
    const safeData =
      data.length >= expected
        ? data.slice(0, expected)
        : new Uint8Array(expected);
    if (data.length < expected) safeData.set(data);
    return [ESC, 0x2a, 33, n1, n2, ...Array.from(safeData)];
  },
  nvImage: (n: number, mode: number) => {
    return [FS, 0x70, n, mode];
  },
};
