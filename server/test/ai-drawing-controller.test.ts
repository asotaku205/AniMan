import "reflect-metadata";
import { HttpException, HttpStatus } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard.js";
import { AiDrawingController } from "../src/ai/consent/ai-drawing.controller.js";
import { AiDrawingDriver } from "../src/ai/driver/ai-drawing-driver.service.js";
import { AiDrawingTask } from "../src/ai/contracts/ai-drawing-request.dto.js";
import type { AiDrawingResponse } from "../src/ai/contracts/ai-drawing-response.js";
import { AiDrawingRateLimiter } from "../src/ai/ai-drawing-rate-limiter.service.js";
import type { PublicUser } from "../src/users/users.service.js";
import { UserRole } from "../src/users/user-role.enum.js";

const user: PublicUser = {
  id: "user-1",
  username: "reader",
  displayName: "Reader",
  role: UserRole.User,
  termsAcceptedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};
const request = { user } as Parameters<AiDrawingController["execute"]>[0];
const drawingInput = {
  task: AiDrawingTask.CompositionGuidance,
  image: {
    data: "aGVsbG8=",
    mimeType: "image/png",
    width: 1024,
    height: 1024,
  },
};
const drawingResponse = {
  schemaVersion: "1",
  task: AiDrawingTask.CompositionGuidance,
  summary: "Thử làm rõ điểm nhấn.",
  sourceIds: [],
  recommendations: [
    {
      principle: "composition",
      explanation: "Thử dịch điểm nhấn khỏi tâm panel.",
      overlay: [],
    },
  ],
} satisfies AiDrawingResponse;

describe("AI drawing controller", () => {
  it("requires JWT authentication", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AiDrawingController,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it("checks rate limit and delegates to drawing driver", async () => {
    const rateLimiter = { assertCanRequest: vi.fn() };
    const drawingDriver = {
      execute: vi.fn(async () => drawingResponse),
    };
    const controller = new AiDrawingController(
      rateLimiter as unknown as AiDrawingRateLimiter,
      drawingDriver as unknown as AiDrawingDriver,
    );

    await expect(controller.execute(request, drawingInput)).resolves.toEqual(
      drawingResponse,
    );
    expect(rateLimiter.assertCanRequest).toHaveBeenCalledWith(user.id);
    expect(drawingDriver.execute).toHaveBeenCalledWith(drawingInput);
  });

  it("stops at the per-user limit before calling the driver", async () => {
    const rateLimiter = {
      assertCanRequest: vi.fn(() => {
        throw new HttpException(
          "AI drawing request limit reached",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }),
    };
    const drawingDriver = { execute: vi.fn() };
    const controller = new AiDrawingController(
      rateLimiter as unknown as AiDrawingRateLimiter,
      drawingDriver as unknown as AiDrawingDriver,
    );

    await expect(
      controller.execute(request, drawingInput),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(drawingDriver.execute).not.toHaveBeenCalled();
  });
});
