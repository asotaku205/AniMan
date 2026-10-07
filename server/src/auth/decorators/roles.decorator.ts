import { SetMetadata } from "@nestjs/common";
import { UserRole } from "../../users/user-role.enum.js";

export const ROLES_METADATA_KEY = "required_roles";

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_METADATA_KEY, roles);
