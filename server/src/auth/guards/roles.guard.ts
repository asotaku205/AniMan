import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../../users/user-role.enum.js";
import { ROLES_METADATA_KEY } from "../decorators/roles.decorator.js";

interface RequestWithRole {
  user?: {
    role?: UserRole;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithRole>();
    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
