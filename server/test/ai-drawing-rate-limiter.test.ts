import { HttpException, HttpStatus } from "@nestjs/common";
import { AiDrawingRateLimiter } from "../src/ai/ai-drawing-rate-limiter.service.js";

describe("AI drawing rate limiter", () => {
  let limiter: AiDrawingRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T12:00:00.000Z"));
    limiter = new AiDrawingRateLimiter();
  });

  afterEach(() => {
    limiter.onModuleDestroy();
    vi.useRealTimers();
  });

  it("allows five requests per minute per user and isolates accounts", () => {
    for (let request = 0; request < 5; request += 1) {
      expect(() => limiter.assertCanRequest("user-a")).not.toThrow();
    }

    expect(() => limiter.assertCanRequest("user-a")).toThrow(HttpException);
    expect(() => limiter.assertCanRequest("user-a")).toThrow(
      expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS }),
    );
    expect(() => limiter.assertCanRequest("user-b")).not.toThrow();
  });

  it("allows thirty requests per rolling day and expires the daily window", () => {
    for (let request = 0; request < 30; request += 1) {
      limiter.assertCanRequest("user-a");
      vi.advanceTimersByTime(12_000);
    }

    expect(() => limiter.assertCanRequest("user-a")).toThrow(HttpException);
    expect(() => limiter.assertCanRequest("user-a")).toThrow(
      expect.objectContaining({ status: HttpStatus.TOO_MANY_REQUESTS }),
    );

    vi.advanceTimersByTime(24 * 60 * 60 * 1_000);
    expect(() => limiter.assertCanRequest("user-a")).not.toThrow();
  });
});
