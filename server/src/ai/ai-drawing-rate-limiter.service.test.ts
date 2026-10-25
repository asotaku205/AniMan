import { HttpException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { AiDrawingRateLimiter } from "./ai-drawing-rate-limiter.service.js";

describe("AiDrawingRateLimiter: quota đọc được + 429 kèm thời gian chờ", () => {
  let limiter: AiDrawingRateLimiter;

  afterEach(() => {
    limiter?.onModuleDestroy();
  });

  it("user mới chưa dùng lượt nào, peek không tốn lượt", () => {
    limiter = new AiDrawingRateLimiter();
    expect(limiter.peekQuota("user-1")).toEqual({
      minuteUsed: 0,
      minuteLimit: 5,
      dayUsed: 0,
      dayLimit: 30,
      retryAfterSeconds: null,
    });
    limiter.peekQuota("user-1");
    limiter.peekQuota("user-1");
    expect(limiter.peekQuota("user-1").minuteUsed).toBe(0);
  });

  it("5 lượt/phút qua, lượt thứ 6 ném 429 kèm mã và số giây chờ", () => {
    limiter = new AiDrawingRateLimiter();
    for (let i = 0; i < 5; i += 1) {
      limiter.assertCanRequest("user-1");
    }
    expect(limiter.peekQuota("user-1")).toMatchObject({
      minuteUsed: 5,
      dayUsed: 5,
    });
    expect(limiter.peekQuota("user-1").retryAfterSeconds).toBeGreaterThan(0);
    let thrown: unknown;
    try {
      limiter.assertCanRequest("user-1");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(HttpException);
    const response = (thrown as HttpException).getResponse() as Record<
      string,
      unknown
    >;
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect(response.code).toBe("ai_rate_limited");
    expect(typeof response.retryAfterSeconds).toBe("number");
    expect(response.retryAfterSeconds as number).toBeGreaterThan(0);
    // Lượt bị chặn không được tính thêm vào quota.
    expect(limiter.peekQuota("user-1").minuteUsed).toBe(5);
  });

  it("30 lượt/ngày qua thì chặn dù chưa hết phút (retryAfter theo ngày)", () => {
    limiter = new AiDrawingRateLimiter();
    // Dùng hết 5 lượt/phút rồi giả lập thời gian trôi bằng cách tạo limiter
    // mới là không được — thay vào đó gọi đủ 30 lượt qua nhiều "phút" giả:
    // ở đây chỉ kiểm tra trần ngày bằng cách nhồi 30 lượt với Date giả.
    const realNow = Date.now;
    let now = realNow();
    Date.now = () => now;
    try {
      for (let i = 0; i < 30; i += 1) {
        limiter.assertCanRequest("user-2");
        now += 61_000; // sang phút mới để không chạm trần phút
      }
      expect(limiter.peekQuota("user-2").dayUsed).toBe(30);
      expect(limiter.peekQuota("user-2").retryAfterSeconds).toBeGreaterThan(0);
      expect(() => limiter.assertCanRequest("user-2")).toThrow(HttpException);
    } finally {
      Date.now = realNow;
    }
  });

  it("user khác nhau không chia quota", () => {
    limiter = new AiDrawingRateLimiter();
    for (let i = 0; i < 5; i += 1) {
      limiter.assertCanRequest("user-a");
    }
    expect(() => limiter.assertCanRequest("user-b")).not.toThrow();
    expect(limiter.peekQuota("user-b").minuteUsed).toBe(1);
  });
});
