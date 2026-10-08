import "reflect-metadata";
import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import {
  AiDrawingImageMimeType,
  type AiDrawingImageDto,
} from "../src/ai/contracts/ai-drawing-request.dto.js";
import { validateAiDrawingImage } from "../src/ai/contracts/ai-drawing-image.validator.js";

async function createImage(
  format: "png" | "jpeg" | "webp",
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 160 },
    },
  })
    [format]()
    .toBuffer();
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
    [AiDrawingImageMimeType.Png, "png", 256, 512],
    [AiDrawingImageMimeType.Jpeg, "jpeg", 512, 256],
    [AiDrawingImageMimeType.Webp, "webp", 256, 256],
  ] as const)(
    "decodes supported %s content and validates its dimensions",
    async (mimeType, format, width, height) => {
      const image = await createImage(format, width, height);

      await expect(
        validateAiDrawingImage(imageDto(image, mimeType, width, height)),
      ).resolves.toBeUndefined();
    },
  );

  it("rejects image bytes with a MIME claim for another format", async () => {
    const png = await createImage("png", 256, 256);

    await expect(
      validateAiDrawingImage(
        imageDto(png, AiDrawingImageMimeType.Jpeg, 256, 256),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects dimensions that differ from encoded metadata or exceed bounds", async () => {
    const png = await createImage("png", 256, 256);

    await expect(
      validateAiDrawingImage(
        imageDto(png, AiDrawingImageMimeType.Png, 1024, 1024),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const oversized = await createImage("png", 4097, 256);
    await expect(
      validateAiDrawingImage(
        imageDto(oversized, AiDrawingImageMimeType.Png, 4097, 256),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects malformed compressed pixels even when the PNG header is valid", async () => {
    const validPng = await createImage("png", 256, 256);
    const corruptedPng = Buffer.from(validPng);
    const idatOffset = corruptedPng.indexOf(Buffer.from("IDAT"));
    expect(idatOffset).toBeGreaterThan(0);
    corruptedPng.fill(0, idatOffset + 8, idatOffset + 12);

    await expect(
      validateAiDrawingImage(
        imageDto(corruptedPng, AiDrawingImageMimeType.Png, 256, 256),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects non-canonical base64 and truncated image containers", async () => {
    await expect(
      validateAiDrawingImage({
        data: "aGVsbG8",
        mimeType: AiDrawingImageMimeType.Png,
        width: 256,
        height: 256,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      validateAiDrawingImage(
        imageDto(
          Buffer.from([0x89, 0x50, 0x4e, 0x47]),
          AiDrawingImageMimeType.Png,
          256,
          256,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects encoded image bytes above the application size limit", async () => {
    const oversized = Buffer.alloc(4 * 1024 * 1024 + 1);
    await expect(
      validateAiDrawingImage(
        imageDto(oversized, AiDrawingImageMimeType.Png, 256, 256),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
