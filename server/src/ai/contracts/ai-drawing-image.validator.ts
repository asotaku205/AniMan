import { BadRequestException } from "@nestjs/common";
import {
  AiDrawingImageMimeType,
  MAX_AI_IMAGE_BYTES,
} from "./ai-drawing-request.dto.js";
import type { AiDrawingImageDto } from "./ai-drawing-request.dto.js";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const MIN_AI_IMAGE_DIMENSION = 256;
const MAX_AI_IMAGE_DIMENSION = 4096;
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

interface ImageDimensions {
  width: number;
  height: number;
}

function invalidImage(): never {
  throw new BadRequestException(
    "AI drawing image signature, container, or dimensions are invalid",
  );
}

function readPngDimensions(data: Buffer): ImageDimensions {
  if (
    data.length < 45 ||
    !data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    data.readUInt32BE(8) !== 13 ||
    data.toString("ascii", 12, 16) !== "IHDR"
  ) {
    return invalidImage();
  }

  const dimensions = {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
  let offset = 8;
  let hasImageData = false;
  let hasEnd = false;

  while (offset + 12 <= data.length) {
    const chunkLength = data.readUInt32BE(offset);
    const chunkType = data.toString("ascii", offset + 4, offset + 8);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > data.length) {
      return invalidImage();
    }
    if (chunkType === "IDAT" && chunkLength > 0) {
      hasImageData = true;
    }
    if (chunkType === "IEND") {
      if (chunkLength !== 0 || chunkEnd !== data.length) {
        return invalidImage();
      }
      hasEnd = true;
      break;
    }
    offset = chunkEnd;
  }

  if (!hasImageData || !hasEnd) {
    return invalidImage();
  }
  return dimensions;
}

function readJpegDimensions(data: Buffer): ImageDimensions {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) {
    return invalidImage();
  }

  let offset = 2;
  let dimensions: ImageDimensions | undefined;

  while (offset < data.length) {
    if (data[offset] !== 0xff) {
      return invalidImage();
    }
    while (offset < data.length && data[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= data.length) {
      return invalidImage();
    }

    const marker = data[offset];
    offset += 1;
    if (marker === 0xd9) {
      return invalidImage();
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > data.length) {
      return invalidImage();
    }

    const segmentLength = data.readUInt16BE(offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > data.length) {
      return invalidImage();
    }
    if (marker === 0xda) {
      if (!dimensions || segmentEnd >= data.length) {
        return invalidImage();
      }
      return dimensions;
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) {
        return invalidImage();
      }
      const componentCount = data[offset + 7];
      if (componentCount === 0 || segmentLength < 8 + 3 * componentCount) {
        return invalidImage();
      }
      dimensions = {
        height: data.readUInt16BE(offset + 3),
        width: data.readUInt16BE(offset + 5),
      };
    }
    offset = segmentEnd;
  }
  return invalidImage();
}

function readWebpDimensions(data: Buffer): ImageDimensions {
  if (
    data.length < 30 ||
    data.toString("ascii", 0, 4) !== "RIFF" ||
    data.toString("ascii", 8, 12) !== "WEBP" ||
    data.readUInt32LE(4) + 8 !== data.length
  ) {
    return invalidImage();
  }

  let offset = 12;
  let extendedDimensions: ImageDimensions | undefined;
  let hasImagePayload = false;
  while (offset + 8 <= data.length) {
    const chunkType = data.toString("ascii", offset, offset + 4);
    const chunkLength = data.readUInt32LE(offset + 4);
    const payloadOffset = offset + 8;
    const chunkEnd = payloadOffset + chunkLength + (chunkLength % 2);
    if (chunkEnd > data.length) {
      return invalidImage();
    }

    if (chunkType === "VP8X" && chunkLength >= 10) {
      extendedDimensions = {
        width: data.readUIntLE(payloadOffset + 4, 3) + 1,
        height: data.readUIntLE(payloadOffset + 7, 3) + 1,
      };
      hasImagePayload = false;
    }
    if (
      chunkType === "VP8 " &&
      chunkLength >= 10 &&
      data[payloadOffset + 3] === 0x9d &&
      data[payloadOffset + 4] === 0x01 &&
      data[payloadOffset + 5] === 0x2a
    ) {
      const dimensions = {
        width: data.readUInt16LE(payloadOffset + 6) & 0x3fff,
        height: data.readUInt16LE(payloadOffset + 8) & 0x3fff,
      };
      if (!extendedDimensions) {
        return dimensions;
      }
      hasImagePayload = true;
    }
    if (
      chunkType === "VP8L" &&
      chunkLength >= 5 &&
      data[payloadOffset] === 0x2f
    ) {
      const bits = data.readUInt32LE(payloadOffset + 1);
      const dimensions = {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
      if (!extendedDimensions) {
        return dimensions;
      }
      hasImagePayload = true;
    }
    if (chunkType === "ANMF" && chunkLength >= 16) {
      hasImagePayload = true;
    }
    offset = chunkEnd;
  }
  if (extendedDimensions && hasImagePayload) {
    return extendedDimensions;
  }
  return invalidImage();
}

function readImageDimensions(
  data: Buffer,
  mimeType: AiDrawingImageMimeType,
): ImageDimensions {
  if (mimeType === AiDrawingImageMimeType.Png) {
    return readPngDimensions(data);
  }
  if (mimeType === AiDrawingImageMimeType.Jpeg) {
    return readJpegDimensions(data);
  }
  if (mimeType === AiDrawingImageMimeType.Webp) {
    return readWebpDimensions(data);
  }
  return invalidImage();
}

export function validateAiDrawingImage(image: AiDrawingImageDto): void {
  const bytes = Buffer.from(image.data, "base64");
  if (
    bytes.length === 0 ||
    bytes.length > MAX_AI_IMAGE_BYTES ||
    bytes.toString("base64") !== image.data
  ) {
    invalidImage();
  }

  const dimensions = readImageDimensions(bytes, image.mimeType);
  if (
    dimensions.width !== image.width ||
    dimensions.height !== image.height ||
    dimensions.width < MIN_AI_IMAGE_DIMENSION ||
    dimensions.height < MIN_AI_IMAGE_DIMENSION ||
    dimensions.width > MAX_AI_IMAGE_DIMENSION ||
    dimensions.height > MAX_AI_IMAGE_DIMENSION
  ) {
    invalidImage();
  }
}
