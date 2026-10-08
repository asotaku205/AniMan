import { Injectable } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { isObservable, lastValueFrom } from "rxjs";
import { ALLOW_PENDING_ADULT_ACCESS } from "../allow-pending-adult-access.decorator.js";
import { assertAdultAccessConfirmed } from "../adult-access.policy.js";
import type { PublicUser } from "../../users/users.service.js";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = super.canActivate(context);
    const authenticated = isObservable(result)
      ? await lastValueFrom(result)
      : await result;
    if (!authenticated) {
      return false;
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_ADULT_ACCESS,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<{ user?: PublicUser }>();
    assertAdultAccessConfirmed(request.user, allowPending === true);
    return true;
  }
}
