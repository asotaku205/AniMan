import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import {
  AiDrawingImageMimeType,
  type AiDrawingImageDto,
} from "../src/ai/contracts/ai-drawing-request.dto.js";
import { validateAiDrawingImage } from "../src/ai/contracts/ai-drawing-image.validator.js";

function createPng(width: number, height: number): Buffer {
  const makeChunk = (type: string, payload: Buffer): Buffer => {
    const chunk = Buffer.alloc(12 + payload.length);
    chunk.writeUInt32BE(payload.length, 0);
    chunk.write(type, 4, "ascii");
    payload.copy(chunk, 8);
    return chunk;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk("IHDR", header),
    makeChunk("IDAT", Buffer.from([0x78, 0x9c, 0x03, 0x00])),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createJpeg(width: number, height: number): Buffer {
  return Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00,
    0x00,
  ]);
}

function createWebp(width: number, height: number): Buffer {
  const data = Buffer.alloc(48);
  data.write("RIFF", 0, "ascii");
  data.writeUInt32LE(40, 4);
  data.write("WEBP", 8, "ascii");
  data.write("VP8X", 12, "ascii");
  data.writeUInt32LE(10, 16);
  data.writeUIntLE(width - 1, 24, 3);
  data.writeUIntLE(height - 1, 27, 3);
  data.write("VP8 ", 30, "ascii");
  data.writeUInt32LE(10, 34);
  data.set([0x9d, 0x01, 0x2a], 41);
  data.writeUInt16LE(width, 44);
  data.writeUInt16LE(height, 46);
  return data;
}

function imageDto(
  data: Buffer,
  mimeType: AiDrawingImageMimeType,
  width: number,
  height: number,
): AiDrawingImageDto {
  return { data: data.toString("base64"), mimeType, width, height };
}

describe("AI drawing image validation", () => {
  it.each([
    [AiDrawingImageMimeType.Png, createPng(256, 512), 256, 512],
    [AiDrawingImageMimeType.Jpeg, createJpeg(512, 256), 512, 256],
    [AiDrawingImageMimeType.Webp, createWebp(256, 256), 256, 256],
  ] as const)(
    "accepts supported %s content when its dimensions match",
    (mimeType, data, width, height) => {
      expect(() =>
        validateAiDrawingImage(imageDto(data, mimeType, width, height)),
      ).not.toThrow();
    },
  );

  it("rejects MIME claims that do not match the encoded image", () => {
    const png = createPng(256, 256);
    expect(() =>
      validateAiDrawingImage(
        imageDto(png, AiDrawingImageMimeType.Jpeg, 256, 256),
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects dimensions that differ from image metadata or exceed bounds", () => {
    const png = createPng(256, 256);
    expect(() =>
      validateAiDrawingImage(
        imageDto(png, AiDrawingImageMimeType.Png, 1024, 1024),
      ),
    ).toThrow(BadRequestException);

    const oversized = createPng(4097, 256);
    expect(() =>
      validateAiDrawingImage(
        imageDto(oversized, AiDrawingImageMimeType.Png, 4097, 256),
      ),
    ).toThrow(BadRequestException);
  });

  it("rejects non-canonical base64 and truncated containers", () => {
    expect(() =>
      validateAiDrawingImage({
        data: "aGVsbG8",
        mimeType: AiDrawingImageMimeType.Png,
        width: 256,
        height: 256,
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      validateAiDrawingImage(
        imageDto(
          Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          AiDrawingImageMimeType.Png,
          256,
          256,
        ),
      ),
    ).toThrow(BadRequestException);
  });

  expect(() =>
    validateAiDrawingImage(
      imageDto(
        Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x02]),
        AiDrawingImageMimeType.Jpeg,
        256,
        256,
      ),
    ),
  ).toThrow(BadRequestException);
});

it("rejects encoded image bytes above the application size limit", () => {
  const oversized = Buffer.alloc(4 * 1024 * 1024 + 1);
  expect(() =>
    validateAiDrawingImage(
      imageDto(oversized, AiDrawingImageMimeType.Png, 256, 256),
    ),
  ).toThrow(BadRequestException);
});
