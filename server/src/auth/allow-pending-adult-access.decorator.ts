import { SetMetadata } from "@nestjs/common";

export const ALLOW_PENDING_ADULT_ACCESS = "allowPendingAdultAccess";

export const AllowPendingAdultAccess = () =>
  SetMetadata(ALLOW_PENDING_ADULT_ACCESS, true);
