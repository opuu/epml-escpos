import { readFile } from "node:fs/promises";
import { EPMLCodegenError } from "./errors.js";
import { ImageDitherMode, ImageRenderOptions, RasterizerFn } from "./types.js";

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const clampByte = (value: number) => Math.max(0, Math.min(255, value));

function decodeDataUrl(dataUrl: string): Buffer {
  const trimmed = dataUrl.trim();
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx < 0) {
    throw new EPMLCodegenError(
      "Invalid image data URL: missing comma separator",
    );
  }

  const header = trimmed.slice(0, commaIdx).replace(/\s+/g, "");
  const payload = trimmed.slice(commaIdx + 1).replace(/\s+/g, "");
  if (!/^data:/i.test(header)) {
    throw new EPMLCodegenError("Invalid image data URL header");
  }

  if (/;base64$/i.test(header)) {
    return Buffer.from(payload, "base64");
  }

  return Buffer.from(decodeURIComponent(payload), "utf8");
}

async function loadSourceBuffer(source: string): Promise<Buffer> {
  const trimmed = source.trim();
  if (!trimmed) {
    throw new EPMLCodegenError("Image source is empty");
  }

  if (/^data:/i.test(trimmed)) {
    return decodeDataUrl(trimmed);
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new EPMLCodegenError(
        `Failed to download image '${trimmed}' (${response.status} ${response.statusText})`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  try {
    return await readFile(trimmed);
  } catch (error: any) {
    throw new EPMLCodegenError(
      `Failed to read image file '${trimmed}': ${error?.message || String(error)}`,
    );
  }
}

function toGrayscale(
  rgba: Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const output = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = rgba[offset];
    const g = rgba[offset + 1];
    const b = rgba[offset + 2];
    const a = rgba[offset + 3] / 255;

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    // Blend transparent pixels against white background.
    output[i] = gray * a + 255 * (1 - a);
  }
  return output;
}

function thresholdMask(
  gray: Float32Array,
  width: number,
  height: number,
  threshold: number,
  invert: boolean,
): Uint8Array {
  const output = new Uint8Array(width * height);
  for (let i = 0; i < output.length; i++) {
    const black = gray[i] < threshold ? 1 : 0;
    output[i] = invert ? (black ? 0 : 1) : black;
  }
  return output;
}

function bayerMask(
  gray: Float32Array,
  width: number,
  height: number,
  invert: boolean,
): Uint8Array {
  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const cell = BAYER_4X4[y % 4][x % 4];
      const localThreshold = ((cell + 0.5) / 16) * 255;
      const black = gray[idx] < localThreshold ? 1 : 0;
      output[idx] = invert ? (black ? 0 : 1) : black;
    }
  }
  return output;
}

function floydSteinbergMask(
  gray: Float32Array,
  width: number,
  height: number,
  threshold: number,
  invert: boolean,
): Uint8Array {
  const buffer = new Float32Array(gray);
  const output = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldValue = buffer[idx];
      const nextValue = oldValue < threshold ? 0 : 255;
      const black = nextValue === 0 ? 1 : 0;
      output[idx] = invert ? (black ? 0 : 1) : black;

      const error = oldValue - nextValue;

      if (x + 1 < width) {
        buffer[idx + 1] = clampByte(buffer[idx + 1] + (error * 7) / 16);
      }
      if (y + 1 < height) {
        if (x > 0) {
          buffer[idx + width - 1] = clampByte(
            buffer[idx + width - 1] + (error * 3) / 16,
          );
        }
        buffer[idx + width] = clampByte(buffer[idx + width] + (error * 5) / 16);
        if (x + 1 < width) {
          buffer[idx + width + 1] = clampByte(
            buffer[idx + width + 1] + (error * 1) / 16,
          );
        }
      }
    }
  }

  return output;
}

function packMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  const bytesPerRow = Math.ceil(width / 8);
  const packed = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    const rowByteOffset = y * bytesPerRow;
    for (let x = 0; x < width; x++) {
      if (mask[rowOffset + x]) {
        const byteIndex = rowByteOffset + (x >> 3);
        packed[byteIndex] |= 0x80 >> (x & 7);
      }
    }
  }

  return packed;
}

function toMonochromeMask(
  gray: Float32Array,
  width: number,
  height: number,
  dither: ImageDitherMode,
  threshold: number,
  invert: boolean,
): Uint8Array {
  if (dither === "bayer") {
    return bayerMask(gray, width, height, invert);
  }
  if (dither === "floyd-steinberg") {
    return floydSteinbergMask(gray, width, height, threshold, invert);
  }
  return thresholdMask(gray, width, height, threshold, invert);
}

export async function defaultRasterizeImage(
  source: string,
  targetWidth: number,
  options: ImageRenderOptions = {},
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const requestedWidth = Math.max(1, Math.round(targetWidth || 1));
  const scale =
    typeof options.scale === "number" &&
    Number.isFinite(options.scale) &&
    options.scale > 0
      ? options.scale
      : 1;
  const finalWidth = Math.max(1, Math.round(requestedWidth * scale));

  const input = await loadSourceBuffer(source);
  const jimpModule = await import("jimp");
  const JimpCtor = (jimpModule as any).Jimp || (jimpModule as any).default;
  if (!JimpCtor || typeof JimpCtor.read !== "function") {
    throw new EPMLCodegenError("Failed to load Jimp image decoder");
  }

  const image = await JimpCtor.read(input);
  image.resize({ w: finalWidth });

  const rgba = image.bitmap.data as Uint8Array;
  const width = image.bitmap.width as number;
  const height = image.bitmap.height as number;

  const dither = options.dither || "threshold";
  const threshold = clampByte(options.threshold ?? 128);
  const invert = !!options.invert;

  const gray = toGrayscale(rgba, width, height);
  const mask = toMonochromeMask(gray, width, height, dither, threshold, invert);

  return {
    data: packMask(mask, width, height),
    width,
    height,
  };
}

export function createDefaultRasterizer(
  defaults: ImageRenderOptions = {},
): RasterizerFn {
  return async (source, targetWidth, options = {}) => {
    const merged: ImageRenderOptions = { ...defaults, ...options };
    return defaultRasterizeImage(source, targetWidth, merged);
  };
}
