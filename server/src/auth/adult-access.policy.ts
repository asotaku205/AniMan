import { ForbiddenException } from "@nestjs/common";
import type { PublicUser } from "../users/users.service.js";

export function assertAdultAccessConfirmed(
  user: Pick<PublicUser, "adultAccessConfirmedAt"> | undefined,
  allowPending: boolean,
): void {
  if (!allowPending && !(user?.adultAccessConfirmedAt instanceof Date)) {
    throw new ForbiddenException(
      "Confirm that you are at least 18 years old before using AniMan",
    );
  }
}
