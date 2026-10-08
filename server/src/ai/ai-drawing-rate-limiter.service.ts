import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
} from "@nestjs/common";

const MAX_REQUESTS_PER_MINUTE = 5;
const MAX_REQUESTS_PER_DAY = 30;
const MINUTE_WINDOW_MS = 60_000;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1_000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1_000;

@Injectable()
export class AiDrawingRateLimiter implements OnModuleDestroy {
  private readonly requestsByUser = new Map<string, number[]>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(
      () => this.removeExpiredUsers(Date.now()),
      CLEANUP_INTERVAL_MS,
    );
    this.cleanupTimer.unref();
  }

  assertCanRequest(userId: string): void {
    const now = Date.now();
    const recentRequests = (this.requestsByUser.get(userId) ?? []).filter(
      (timestamp) => now - timestamp < DAY_WINDOW_MS,
    );
    const requestsThisMinute = recentRequests.filter(
      (timestamp) => now - timestamp < MINUTE_WINDOW_MS,
    ).length;

    if (
      requestsThisMinute >= MAX_REQUESTS_PER_MINUTE ||
      recentRequests.length >= MAX_REQUESTS_PER_DAY
    ) {
      this.requestsByUser.set(userId, recentRequests);
      throw new HttpException(
        "AI drawing request limit reached; try again later",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recentRequests.push(now);
    this.requestsByUser.set(userId, recentRequests);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  private removeExpiredUsers(now: number): void {
    for (const [userId, timestamps] of this.requestsByUser) {
      const activeTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < DAY_WINDOW_MS,
      );
      if (activeTimestamps.length === 0) {
        this.requestsByUser.delete(userId);
      } else {
        this.requestsByUser.set(userId, activeTimestamps);
      }
    }
  }
}
