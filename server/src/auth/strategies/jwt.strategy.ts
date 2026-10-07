import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../../users/users.service.js";
import type { PublicUser } from "../../users/users.service.js";
import { getJwtAccessSecret } from "../auth.config.js";
import type { AccessTokenPayload } from "../auth.service.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtAccessSecret(configService),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<PublicUser> {
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findPublicById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
